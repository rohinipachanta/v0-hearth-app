// ─────────────────────────────────────────────
// API Route: POST /api/setup
// ─────────────────────────────────────────────
// Saves the wizard data after first-time setup:
//   - Family members (with health goals, dosha, weight)
//   - Fasting preferences
//   - Resolved location (from zip code)

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientFromCookies } from '@/lib/supabase'
import { resolveZipToLocation } from '@/domain/lunar'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClientFromCookies()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const body = await request.json()
    const {
      members,
      cuisine_preferences,
      fasting_types,
      fasting_strictness,
      location_zip,
      location_country,
    } = body

    // ── 1. Resolve zip → lat/long ──
    let locationData = null
    if (location_zip && location_country) {
      locationData = await resolveZipToLocation(location_zip, location_country)
    }

    // ── 2. Update user's location ──
    await supabase.from('users').update({
      location_zip:      location_zip || null,
      location_lat:      locationData?.lat ?? null,
      location_lng:      locationData?.lng ?? null,
      location_city:     locationData?.city ?? null,
      location_country:  locationData?.country ?? location_country ?? null,
      location_timezone: locationData?.timezone ?? null,
    }).eq('id', user.id)

    // ── 3. Delete existing family members (fresh setup) ──
    await supabase.from('family_members').delete().eq('user_id', user.id)

    // ── 4. Map extended values to DB-allowed CHECK constraint values ──
    const activityMap: Record<string, string> = {
      sedentary:   'sedentary',
      light:       'sedentary',
      moderate:    'moderate',
      active:      'active',
      very_active: 'active',
    }
    const dietMap: Record<string, string> = {
      vegetarian:     'vegetarian',
      vegan:          'vegetarian',
      eggetarian:     'eggetarian',
      non_vegetarian: 'non_vegetarian',
      jain:           'vegetarian',
    }

    // ── 5. Insert all family members ──
    const memberRows = members.map((m: any) => ({
      user_id:            user.id,
      name:               (m.name ?? '').trim(),
      // WizardMemberDraft uses 'dob'; DB column is 'date_of_birth'
      date_of_birth:      m.dob || m.date_of_birth || null,
      gender:             m.gender ?? 'other',
      weight_kg:          m.weight_kg ? parseFloat(String(m.weight_kg)) : null,
      dosha:              m.dosha ?? null,
      activity_level:     activityMap[m.activity_level] ?? 'moderate',
      dietary_preference: dietMap[m.dietary_preference] ?? 'vegetarian',
      health_conditions:  m.health_conditions ?? [],
      health_goals:       m.health_goals ?? [],
      cuisine_preferences: cuisine_preferences ?? [],
    }))

    console.log('Inserting member rows:', JSON.stringify(memberRows, null, 2))

    const { error: membersError } = await supabase
      .from('family_members')
      .insert(memberRows)

    if (membersError) {
      console.error('Supabase insert error:', membersError)
      return NextResponse.json(
        { error: `Failed to save family members: ${membersError.message}` },
        { status: 500 }
      )
    }

    // ── 6. Upsert fasting preferences ──
    await supabase.from('fasting_preferences').upsert({
      user_id:          user.id,
      fasting_types:    fasting_types ?? [],
      strictness_level: fasting_strictness ?? 'moderate',
    }, { onConflict: 'user_id' })

    return NextResponse.json({
      success: true,
      location: locationData
        ? `📍 Detected: ${locationData.city}, ${locationData.country}`
        : null,
    })

  } catch (err: any) {
    console.error('setup error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Internal server error' },
      { status: 500 }
    )
  }
}
