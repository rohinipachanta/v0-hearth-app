// ─────────────────────────────────────────────
// API Route: GET /api/export-calendar?weekStart=YYYY-MM-DD
// ─────────────────────────────────────────────
// Generates a .ics calendar file for the week's meal plan.
// Works with Google Calendar, Apple Calendar, and Outlook.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClientFromCookies } from '@/lib/supabase-server'
import { createEvents, EventAttributes } from 'ics'
import type { DayPlan } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClientFromCookies()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const weekStart = searchParams.get('weekStart')
    if (!weekStart) return NextResponse.json({ error: 'weekStart required' }, { status: 400 })

    const { data: plan } = await supabase
      .from('meal_plans')
      .select('plan_data')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStart)
      .single()

    if (!plan) return NextResponse.json({ error: 'No plan found for this week' }, { status: 404 })

    const week: DayPlan[] = plan.plan_data.week
    const events: EventAttributes[] = []

    for (const day of week) {
      const dateParts = day.date.split('-').map(Number) as [number, number, number]

      if (day.is_fasting) {
        // Fasting day → all-day event
        const config = day.fasting_type
        events.push({
          title: `🌙 ${day.fasting_type === 'ekadashi' ? 'Ekadashi' : 'Navratri'} — Fasting Day`,
          start: dateParts,
          duration: { days: 1 },
          description: [
            `Fasting today — ${day.fasting_type}`,
            '',
            `🌅 Breakfast: ${day.meals.breakfast.name}`,
            `☀️  Lunch: ${day.meals.lunch.name}`,
            `🌙 Dinner: ${day.meals.dinner.name}`,
            '',
            `Protein today: ${day.daily_totals.protein_g}g`,
          ].join('\n'),
          categories: ['Sattvic', 'Fasting'],
          status: 'CONFIRMED',
        })
      } else {
        // Regular day → 3 meal events
        const mealSlots: [string, string, [number, number, number, number, number]][] = [
          ['Breakfast', day.meals.breakfast.name, [...dateParts, 8, 0] as [number, number, number, number, number]],
          ['Lunch', day.meals.lunch.name, [...dateParts, 13, 0] as [number, number, number, number, number]],
          ['Dinner', day.meals.dinner.name, [...dateParts, 19, 30] as [number, number, number, number, number]],
        ]

        for (const [type, name, startTime] of mealSlots) {
          const mealKey = type.toLowerCase() as 'breakfast' | 'lunch' | 'dinner'
          const meal = day.meals[mealKey]
          const emoji = type === 'Breakfast' ? '🌅' : type === 'Lunch' ? '☀️' : '🌙'

          events.push({
            title: `${emoji} ${type} — ${name}`,
            start: startTime,
            duration: { minutes: 30 },
            description: [
              `🌿 ${meal.ayurvedic_guna} · ${meal.dosha_effect}`,
              `💪 Protein: ${meal.protein_g}g · Calories: ${meal.calories} kcal`,
              meal.accompaniments.length > 0
                ? `💡 Suggestion: ${meal.accompaniments[0].name} — ${meal.accompaniments[0].reason}`
                : '',
              '',
              `Ingredients: ${meal.ingredients.slice(0, 5).join(', ')}`,
            ].filter(Boolean).join('\n'),
            categories: ['Sattvic', 'Meal'],
            status: 'CONFIRMED',
          })
        }
      }
    }

    const { value, error } = createEvents(events)
    if (error || !value) {
      return NextResponse.json({ error: 'Failed to generate calendar file' }, { status: 500 })
    }

    return new NextResponse(value, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="sattvic-${weekStart}.ics"`,
      },
    })
  } catch (err) {
    console.error('export-calendar error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
