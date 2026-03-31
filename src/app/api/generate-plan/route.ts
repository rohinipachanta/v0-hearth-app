// ─────────────────────────────────────────────
// API Route: POST /api/generate-plan
// ─────────────────────────────────────────────
// Generates a batched meal plan using Gemini 2.5 Flash (direct REST API).
// Accepts startDay (0-6) and dayCount (1-7) for incremental generation.
// Merges new days into the existing DB plan for the week.

import { NextRequest, NextResponse } from 'next/server'

// Tell Next.js this route is allowed up to 60 seconds (Railway's request limit)
export const maxDuration = 60
import { createServerClientFromCookies } from '@/lib/supabase-server'
import { buildMealPlanPrompt, validateMealPlanResponse } from '@/domain/meal-plan'
import { getFastingDaysForWeek, getWeekStart } from '@/domain/lunar'
import type { FamilyMember, FastingPreferences } from '@/types'

// ── Direct REST call to Gemini — bypasses SDK entirely ──
async function callGeminiRest(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY is not set')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 8192,
    },
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 55_000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message ?? `Gemini HTTP ${res.status}`)
    }

    const data = await res.json()
    // Extract text from all non-thought parts
    const parts: Array<{ text?: string; thought?: boolean }> =
      data?.candidates?.[0]?.content?.parts ?? []
    const text = parts
      .filter(p => !p.thought && typeof p.text === 'string')
      .map(p => p.text)
      .join('')

    return text
  } catch (err: unknown) {
    clearTimeout(timer)
    if (err instanceof Error && err.name === 'AbortError') throw new Error('GEMINI_TIMEOUT')
    throw err
  }
}

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

    // ── Call Gemini via direct REST (no SDK) ──
    const rawResponse = await callGeminiRest(prompt)

    // ── Extract JSON boundaries just in case ──
    let cleaned = rawResponse.trim()
    const jsonStart = cleaned.indexOf('{')
    const jsonEnd = cleaned.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1)
    }

    // ── Parse and validate ──
    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('Gemini returned invalid JSON. Raw length:', rawResponse.length, 'Start:', rawResponse.slice(0, 300))
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
