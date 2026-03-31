// ─────────────────────────────────────────────
// API Route: POST /api/generate-plan
// ─────────────────────────────────────────────
// Generates a batched meal plan using Gemini 2.5 Flash.
// Accepts startDay (0-6) and dayCount (1-7) for incremental generation.
// Merges new days into the existing DB plan for the week.

import { NextRequest, NextResponse } from 'next/server'

// Tell Next.js this route is allowed up to 60 seconds (Railway's request limit)
export const maxDuration = 60
import { createServerClientFromCookies } from '@/lib/supabase-server'
import { getJsonModel, callGeminiWithTimeout } from '@/lib/gemini'
import { buildMealPlanPrompt, validateMealPlanResponse } from '@/domain/meal-plan'
import { getFastingDaysForWeek, getWeekStart } from '@/domain/lunar'
import type { FamilyMember, FastingPreferences } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClientFromCookies()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    // Body is optional — frontend may POST with no body when using defaults
    let body: { weekStart?: string; startDay?: number; dayCount?: number } = {}
    try { body = await request.json() } catch { /* empty body is fine */ }
    const weekStartDate: string | undefined = body.weekStart
    const startDay = typeof body.startDay === 'number' ? body.startDay : 0
    const dayCount = typeof body.dayCount === 'number' ? body.dayCount : 2

    // ── Load user data from Supabase ──
    const [membersResult, fastingResult, userResult] = await Promise.all([
      supabase.from('family_members')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at'),
      supabase.from('fasting_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single(),
      supabase.from('users')
        .select('location_lat, location_lng, location_timezone, location_country')
        .eq('id', user.id)
        .single(),
    ])

    const members = (membersResult.data ?? []) as FamilyMember[]
    const fasting = fastingResult.data as FastingPreferences | null
    const userLocation = userResult.data

    if (members.length === 0) {
      return NextResponse.json(
        { error: 'No family members found. Please complete setup first.' },
        { status: 400 }
      )
    }

    // ── Determine week start ──
    const weekStart = weekStartDate
      ? new Date(weekStartDate)
      : getWeekStart()

    // ── Get fasting days ──
    const fastingDays = getFastingDaysForWeek(
      weekStart,
      fasting?.fasting_types ?? ['ekadashi'],
      {
        lat: userLocation?.location_lat ?? 20.0,
        lng: userLocation?.location_lng ?? 78.0,
        timezone: userLocation?.location_timezone ?? 'Asia/Kolkata',
      }
    )

    // ── Detect hemisphere ──
    const lat = userLocation?.location_lat ?? 20.0
    const hemisphere = lat >= 0 ? 'north' : 'south'

    // ── Build prompt for just the requested day range ──
    const prompt = buildMealPlanPrompt({
      familyMembers: members,
      fastingDays,
      weekStart,
      hemisphere,
      cuisines: members.flatMap(m => m.cuisine_preferences)
        .filter((v, i, arr) => arr.indexOf(v) === i) as never[],
      startDay,
      dayCount,
    })

    // ── Call Gemini with 55s timeout (safely under Railway's 60s limit) ──
    const model = getJsonModel()
    const rawResponse = await callGeminiWithTimeout(async () => {
      const result = await model.generateContent(prompt)
      return result.response.text()
    }, 55_000)

    // ── Parse and validate ──
    // gemini-2.5-flash may prepend thinking tokens — strip them before parsing
    let cleaned = rawResponse.trim()
    // Remove <thinking>...</thinking> blocks if present
    cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim()
    // Extract the outermost JSON object in case there's any prefix/suffix text
    const jsonStart = cleaned.indexOf('{')
    const jsonEnd = cleaned.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('Gemini returned invalid JSON:', rawResponse.slice(0, 500))
      return NextResponse.json(
        { error: 'Meal plan generation failed — invalid response. Please try again.' },
        { status: 500 }
      )
    }

    const validated = validateMealPlanResponse(parsed)
    if (!validated) {
      return NextResponse.json(
        { error: 'Meal plan structure was unexpected. Please try again.' },
        { status: 500 }
      )
    }

    // ── Merge new days into any existing plan for this week ──
    const weekStartStr = weekStart.toISOString().split('T')[0]
    const newDays = validated.week

    // Load the existing plan (if any) so we can merge rather than overwrite
    const { data: existingRow } = await supabase
      .from('meal_plans')
      .select('plan_data')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStartStr)
      .single()

    const existingDays: typeof newDays =
      (existingRow?.plan_data as Record<string, unknown> | null)?.week as typeof newDays ??
      (existingRow?.plan_data as Record<string, unknown> | null)?.days as typeof newDays ??
      []

    // Replace or append each new day by date
    const dayMap = new Map(existingDays.map(d => [d.date, d]))
    for (const day of newDays) dayMap.set(day.date, day)
    const mergedDays = Array.from(dayMap.values()).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    )

    const { error: saveError } = await supabase
      .from('meal_plans')
      .upsert({
        user_id:         user.id,
        week_start_date: weekStartStr,
        generated_at:    new Date().toISOString(),
        plan_data:       { week: mergedDays },
      }, { onConflict: 'user_id,week_start_date' })

    if (saveError) {
      console.error('Error saving meal plan:', saveError)
      return NextResponse.json({ error: 'Failed to save meal plan.' }, { status: 500 })
    }

    // Return only the newly generated days (frontend merges them into state)
    return NextResponse.json({ days: newDays, fastingDays })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'GEMINI_TIMEOUT') {
      return NextResponse.json(
        { error: 'Meal plan generation timed out. Please try again.' },
        { status: 504 }
      )
    }
    console.error('generate-plan error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
