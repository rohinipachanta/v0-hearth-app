import { NextRequest, NextResponse } from 'next/server';

// Tell Next.js this route is allowed up to 60 seconds (Railway's request limit)
export const maxDuration = 60
import { createServerClientFromCookies } from '@/lib/supabase-server';
import { getJsonModel, callGeminiWithTimeout } from '@/lib/gemini';
import { getCurrentSeason } from '@/domain/ayurveda';
import { getWeekStart } from '@/domain/lunar';
import type { FamilyMember, Meal, MealPlan } from '@/types';

export async function POST(req: NextRequest) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { mealId, date, mealType } = body as { mealId: string; date: string; mealType: string };

  if (!mealId || !date || !mealType) {
    return NextResponse.json({ error: 'mealId, date, and mealType are required' }, { status: 400 });
  }

  // Load family members
  const { data: membersData } = await supabase
    .from('family_members').select('*').eq('user_id', user.id);
  const members = (membersData ?? []) as FamilyMember[];
  if (!members.length) return NextResponse.json({ error: 'No family members configured' }, { status: 400 });

  // Load current meal plan
  const weekStart = getWeekStart(new Date());
  const weekKey = weekStart.toISOString().split('T')[0];
  const { data: planData } = await supabase
    .from('meal_plans').select('*').eq('user_id', user.id).eq('week_start_date', weekKey).single();

  if (!planData) return NextResponse.json({ error: 'No meal plan found for this week' }, { status: 404 });

  const mealPlan = planData.plan_data as MealPlan;
  const season = getCurrentSeason(new Date());

  // Build a targeted prompt for a single meal
  const memberProfiles = members.map(m => {
    const age = m.date_of_birth
      ? Math.floor((Date.now() - new Date(m.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
      : null;
    return `${m.name} (${age ? age + ' yrs' : 'age unknown'}, ${m.dietary_preference}, ${m.dosha ?? 'unknown dosha'}, conditions: ${m.health_conditions?.join(', ') || 'none'}, goals: ${m.health_goals?.join(', ') || 'none'})`;
  }).join('\n');

  const cuisines = members[0]?.cuisines?.join(', ') || 'North Indian';

  const prompt = `You are a nutritionist specialising in Indian Ayurvedic cuisine.

Regenerate a single ${mealType} meal for ${date} for the following family:
${memberProfiles}

Current Ayurvedic season: ${season.name} (${season.guidance}).
Preferred cuisines: ${cuisines}.

The previous meal was not suitable — please suggest something fresh and different.

Return ONLY valid JSON matching this exact structure:
{
  "id": "meal_${Date.now()}",
  "name": "Meal Name",
  "meal_type": "${mealType}",
  "date": "${date}",
  "cuisine": "cuisine_type",
  "description": "Brief description",
  "is_fasting_friendly": false,
  "ingredients": ["ingredient 1", "ingredient 2"],
  "instructions": ["Step 1", "Step 2"],
  "nutrition": {
    "calories": 350,
    "protein_g": 18,
    "carbs_g": 45,
    "fat_g": 12,
    "fibre_g": 6
  },
  "accompaniments": [
    { "name": "accompaniment name", "benefit": "dosha-balancing benefit" }
  ]
}`;

  try {
    const model = getJsonModel();
    const result = await callGeminiWithTimeout<Meal>(async () => {
      const res = await model.generateContent(prompt);
      const text = res.response.text().trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
      return JSON.parse(text) as Meal;
    }, 55_000);

    const newMeal = result;

    // Update the meal plan in place
    const updatedDays = mealPlan.days?.map(day => {
      if (day.date !== date) return day;
      return {
        ...day,
        meals: day.meals.map(m => m.id === mealId ? newMeal : m),
      };
    });

    const updatedPlan = { ...mealPlan, days: updatedDays };

    await supabase
      .from('meal_plans')
      .update({ plan_data: updatedPlan })
      .eq('user_id', user.id)
      .eq('week_start_date', weekKey);

    return NextResponse.json({ meal: newMeal });
  } catch (e: any) {
    console.error('Regenerate meal error:', e);
    return NextResponse.json({ error: e.message ?? 'Regeneration failed' }, { status: 500 });
  }
}
