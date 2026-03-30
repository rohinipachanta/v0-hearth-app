// ─────────────────────────────────────────────
// API Route: POST /api/setup
// ─────────────────────────────────────────────
// Saves the wizard data after first-time setup:
//   - Family members (with health goals, dosha, weight)
//   - Fasting preferences
//   - Resolved location (from zip code)

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientFromCookies } from '@/lib/supabase/server'
import { resolveZipToLocation } from '@/domain/lunar'
import type { WizardState } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClientFromCookies()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const body: WizardState = await request.json()
    const { members, cuisine_preferences, fasting_types, fasting_strictness,
            location_zip, location_country } = body

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

    // ── 4. Insert all family members ──
    // Map activity_level values to what the DB CHECK constraint allows
    const activityMap: Record<string, string> = {
      sedentary:   'sedentary',
      light:       'sedentary',   // closest allowed value
      moderate:    'moderate',
      active:      'active',
      very_active: 'active',      // closest allowed value
    }
    // Map dietary_preference values to what the DB CHECK constraint allows
    const dietMap: Record<string, string> = {
      vegetarian:     'vegetarian',
      vegan:          'vegetarian',   // closest allowed value
      eggetarian:     'eggetarian',
      non_vegetarian: 'non_vegetarian',
      jain:           'vegetarian',   // closest allowed value
    }

    const memberRows = members.map(m => ({
      user_id:            user.id,
      name:               m.name.trim(),
      date_of_birth:      m.dob || m.date_of_birth || null,
      gender:             m.gender ?? 'other',                          // NOT NULL in schema
      weight_kg:          m.weight_kg ? Number(m.weight_kg) : null,
      dosha:              m.dosha ?? null,
      activity_level:     activityMap[m.activity_level] ?? 'moderate', // map to allowed values
      dietary_preference: dietMap[m.dietary_preference] ?? 'vegetarian',
      health_conditions:  m.health_conditions,
      health_goals:       m.health_goals,
      cuisine_preferences: cuisine_preferences ?? [],
      // height_cm omitted — column does not exist in DB yet (run migration to add it)
    }))

    const { error: membersError } = await supabase
      .from('family_members')
      .insert(memberRows)

    if (membersError) {
      console.error('Error inserting family members:', membersError)
      return NextResponse.json({ error: 'Failed to save family members.' }, { status: 500 })
    }

    // ── 5. Upsert fasting preferences ──
    await supabase.from('fasting_preferences').upsert({
      user_id:          user.id,
      fasting_types:    fasting_types,
      strictness_level: fasting_strictness,
    }, { onConflict: 'user_id' })

    return NextResponse.json({
      success: true,
      location: locationData
        ? `📍 Detected: ${locationData.city}, ${locationData.country}`
        : null,
    })

  } catch (err) {
    console.error('setup error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
