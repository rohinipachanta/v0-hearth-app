'use client';
export const dynamic = 'force-dynamic';
;

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { calcAllProteinTargets } from '@/domain/protein';
import { formatWeekRange, getWeekStart } from '@/domain/lunar';
import type { MealPlan, FamilyMember, FastingDay, DayPlan, Meal, ProteinTarget } from '@/types';

// ─── Skeleton card (shown while a day's meals are still loading) ───────────────

function DayColumnSkeleton({ date }: { date: Date }) {
  const dayName = date.toLocaleDateString('en-IN', { weekday: 'short' });
  const dayNum  = date.getDate();
  return (
    <div className="min-w-[160px] flex-1 animate-pulse">
      <div className="text-center py-2 mb-2 rounded-xl bg-gray-100">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{dayName}</div>
        <div className="text-lg font-bold text-gray-300">{dayNum}</div>
      </div>
      {[0, 1, 2].map(i => (
        <div key={i} className="w-full rounded-xl bg-gray-100 mb-2 h-16" />
      ))}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function FastingBanner({ fastingDays }: { fastingDays: FastingDay[] }) {
  if (!fastingDays.length) return null;
  const names = fastingDays.map(d => d.fastingType.replace(/_/g, ' ')).join(', ');
  return (
    <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3"
      style={{ background: '#F3EAF7', border: '1px solid #9B6BB5' }}>
      <span className="text-xl">🙏</span>
      <div>
        <span className="font-semibold text-purple-800 text-sm">Fasting this week: </span>
        <span className="text-purple-700 text-sm">{names}</span>
      </div>
    </div>
  );
}

function ProteinBar({ member, target, achieved }: {
  member: FamilyMember;
  target: ProteinTarget;
  achieved: number;
}) {
  const pct = Math.min(100, Math.round((achieved / target.target_g) * 100));
  const color = pct >= 80 ? '#4A7C59' : pct >= 50 ? '#F5A623' : '#C2546E';
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-charcoal">{member.name}</span>
        <span className="text-xs text-gray-500">{achieved}g / {target.target_g}g</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-xs text-gray-400 mt-0.5">{pct}% of daily target</div>
    </div>
  );
}

function NutritionStrip({ meal }: { meal: Meal }) {
  if (!meal.nutrition) return null;
  const n = meal.nutrition;
  return (
    <div className="flex gap-3 text-xs text-gray-500 mt-1">
      {n.calories && <span>🔥 {n.calories} kcal</span>}
      {n.protein_g && <span style={{ color: '#5B8DD9' }}>💪 {n.protein_g}g protein</span>}
      {n.carbs_g && <span>🌾 {n.carbs_g}g carbs</span>}
      {n.fat_g && <span>🫒 {n.fat_g}g fat</span>}
    </div>
  );
}

function MealCard({ meal, onClick }: { meal: Meal; onClick: () => void }) {
  const emojiMap: Record<string, string> = {
    breakfast: '☀️', lunch: '🌤️', dinner: '🌙', snack: '🍎',
  };
  return (
    <button onClick={onClick}
      className="w-full text-left p-3 rounded-xl bg-white hover:shadow-md transition-shadow duration-200 border border-gray-100 mb-2">
      <div className="flex items-start gap-2">
        <span className="text-base">{emojiMap[meal.meal_type ?? ''] ?? '🍽️'}</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-charcoal truncate">{meal.name}</div>
          <div className="text-xs text-gray-400 capitalize">{meal.meal_type}</div>
          <NutritionStrip meal={meal} />
        </div>
        {meal.is_fasting_friendly && (
          <span className="text-xs px-1.5 py-0.5 rounded-full text-purple-700 shrink-0"
            style={{ background: '#F3EAF7', border: '1px solid #9B6BB5' }}>Fast</span>
        )}
      </div>
    </button>
  );
}

function DayColumn({ day, isFasting, onClick }: {
  day: DayPlan;
  isFasting: boolean;
  onClick: (meal: Meal) => void;
}) {
  const date = new Date(day.date);
  const dayName = date.toLocaleDateString('en-IN', { weekday: 'short' });
  const dayNum = date.getDate();
  const isToday = new Date().toDateString() === date.toDateString();

  return (
    <div className="min-w-[160px] flex-1">
      <div className={`text-center py-2 mb-2 rounded-xl ${isFasting ? 'text-purple-700' : isToday ? 'text-white' : 'text-charcoal'}`}
        style={{
          background: isFasting ? '#F3EAF7' : isToday ? '#E8793A' : '#FDF6EC',
          border: isFasting ? '1px solid #9B6BB5' : isToday ? 'none' : '1px solid #F5E9D6'
        }}>
        <div className="text-xs font-medium uppercase tracking-wide">{dayName}</div>
        <div className="text-lg font-bold">{dayNum}</div>
        {isFasting && <div className="text-xs">🙏 Fast</div>}
      </div>
      <div>
        {day.meals.map(meal => (
          <MealCard key={meal.id} meal={meal} onClick={() => onClick(meal)} />
        ))}
      </div>
    </div>
  );
}

function MealDetailModal({ meal, members, onClose, onRegenerate }: {
  meal: Meal;
  members: FamilyMember[];
  onClose: () => void;
  onRegenerate: (meal: Meal) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(44,36,22,0.5)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-charcoal">{meal.name}</h2>
            <span className="text-sm text-gray-500 capitalize">{meal.meal_type} · {meal.cuisine} cuisine</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {meal.description && (
          <p className="text-sm text-gray-600 mb-4">{meal.description}</p>
        )}

        {/* Nutrition */}
        {meal.nutrition && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Calories', value: meal.nutrition.calories, unit: 'kcal', color: '#E8793A' },
              { label: 'Protein', value: meal.nutrition.protein_g, unit: 'g', color: '#5B8DD9' },
              { label: 'Carbs', value: meal.nutrition.carbs_g, unit: 'g', color: '#F5A623' },
              { label: 'Fat', value: meal.nutrition.fat_g, unit: 'g', color: '#4A7C59' },
            ].map(n => n.value && (
              <div key={n.label} className="text-center p-2 rounded-xl" style={{ background: '#FDF6EC' }}>
                <div className="text-lg font-bold" style={{ color: n.color }}>{n.value}</div>
                <div className="text-xs text-gray-400">{n.unit}</div>
                <div className="text-xs text-gray-500">{n.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Ingredients */}
        {meal.ingredients && meal.ingredients.length > 0 && (
          <div className="mb-4">
            <h3 className="font-semibold text-sm text-charcoal mb-2">Ingredients</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              {meal.ingredients.map((ing, i) => <li key={i} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-saffron shrink-0" style={{ background: '#E8793A' }} />{ing}</li>)}
            </ul>
          </div>
        )}

        {/* Instructions */}
        {meal.instructions && meal.instructions.length > 0 && (
          <div className="mb-4">
            <h3 className="font-semibold text-sm text-charcoal mb-2">Instructions</h3>
            <ol className="text-sm text-gray-600 space-y-2">
              {meal.instructions.map((step, i) => <li key={i} className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold" style={{ background: '#E8793A' }}>{i + 1}</span><span>{step}</span></li>)}
            </ol>
          </div>
        )}

        {/* Accompaniments */}
        {meal.accompaniments && meal.accompaniments.length > 0 && (
          <div className="mb-4">
            <h3 className="font-semibold text-sm text-charcoal mb-2">Dosha-Balancing Accompaniments</h3>
            <div className="space-y-2">
              {meal.accompaniments.map((acc, i) => (
                <div key={i} className="text-sm p-2 rounded-lg" style={{ background: '#FDF6EC' }}>
                  <span className="font-medium">{acc.name}</span>
                  {acc.benefit && <span className="text-gray-500"> — {acc.benefit}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button onClick={() => onRegenerate(meal)}
            className="flex-1 py-2.5 rounded-pill text-sm font-semibold border transition-colors hover:bg-gray-50"
            style={{ border: '1.5px solid #E8793A', color: '#E8793A', borderRadius: '50px' }}>
            🔄 Regenerate Meal
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-pill text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: '#E8793A', borderRadius: '50px' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const supabase = createClient();

  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [fastingDays, setFastingDays] = useState<FastingDay[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [proteinTargets, setProteinTargets] = useState<ProteinTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  // partialDays: 7-slot array used while generating. null slot = skeleton placeholder.
  const [partialDays, setPartialDays] = useState<(DayPlan | null)[] | null>(null);

  const weekStart = getWeekStart(new Date());
  const weekLabel = formatWeekRange(weekStart);
  // Pre-compute the 7 dates for skeleton headers
  const weekDayDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  /**
   * Normalize raw plan data into a consistent MealPlan shape for the UI.
   * Handles two storage variants:
   *   - Full DB row: { plan_data: { week: [...] } }
   *   - Raw plan object: { week: [...] } or { days: [...] }
   */
  const normalizePlan = (raw: unknown): MealPlan => {
    const r = raw as Record<string, unknown>;
    // If it's a full DB row (has plan_data), unwrap it first
    const planData = (r?.plan_data ?? r) as Record<string, unknown>;
    const days = (planData?.days ?? planData?.week ?? []) as MealPlan['days'];
    const fastingDays = (planData?.fasting_days ?? []) as FastingDay[];
    return { ...(planData as MealPlan), days, fasting_days: fastingDays };
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users').select('*').eq('id', user.id).single();
      if (userData) setUserName(userData.name?.split(' ')[0] ?? '');

      const { data: membersData } = await supabase
        .from('family_members').select('*').eq('user_id', user.id).order('created_at');
      const mems = (membersData ?? []) as FamilyMember[];
      setMembers(mems);
      setProteinTargets(calcAllProteinTargets(mems).filter(Boolean) as ProteinTarget[]);

      const weekKey = weekStart.toISOString().split('T')[0];
      const { data: planData } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start_date', weekKey)
        .single();

      if (planData) {
        const normalized = normalizePlan(planData.plan_data);
        setPlan(normalized);
        setFastingDays(normalized.fasting_days ?? []);
      }
    } catch (e) {
      console.error('Load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const generatePlan = async () => {
    setGenerating(true);
    setError(null);
    setPlan(null);

    // Initialize 7 skeleton placeholders immediately so the UI shows them
    const collected: (DayPlan | null)[] = Array(7).fill(null);
    setPartialDays([...collected]);

    const weekKey = weekStart.toISOString().split('T')[0];
    let weekFastingDays: FastingDay[] = [];

    const fetchBatch = async (startDay: number, dayCount: number) => {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: weekKey, startDay, dayCount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Days ${startDay}–${startDay + dayCount - 1} failed`);
      (json.days as DayPlan[]).forEach((day, i) => { collected[startDay + i] = day; });
      setPartialDays([...collected]);
      return json;
    };

    try {
      // ── Batch 0: days 0–1 (show these first so user sees something quickly) ──
      const json0 = await fetchBatch(0, 2);
      weekFastingDays = json0.fastingDays ?? [];
      setFastingDays(weekFastingDays);

      // ── Batches 1–3: fire in parallel for days 2–6 ──
      await Promise.all([
        fetchBatch(2, 2),
        fetchBatch(4, 2),
        fetchBatch(6, 1),
      ]);

      // ── All done: fold into plan state ──
      const allDays = collected.filter(Boolean) as DayPlan[];
      setPlan({ days: allDays, fasting_days: weekFastingDays });
      setPartialDays(null);

    } catch (e: unknown) {
      setError((e as Error).message);
      setPartialDays(null);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async (meal: Meal) => {
    setSelectedMeal(null);
    setError(null);
    try {
      const res = await fetch('/api/regenerate-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealId: meal.id, date: meal.date, mealType: meal.meal_type }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Meal regeneration failed. Please try again.');
      // Refresh plan data to show the updated meal
      await loadData();
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  };

  const exportCalendar = async () => {
    const weekKey = weekStart.toISOString().split('T')[0];
    window.location.href = `/api/export-calendar?weekStart=${weekKey}`;
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  // Calculate total protein achieved for today from plan
  const getTodayProtein = (memberId: string): number => {
    if (!plan) return 0;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayPlan = plan.days?.find(d => d.date === todayStr);
    if (!todayPlan) return 0;
    return todayPlan.meals.reduce((sum, meal) => {
      const memberMeals = meal.member_portions?.[memberId];
      return sum + (memberMeals?.protein_g ?? meal.nutrition?.protein_g ?? 0);
    }, 0);
  };

  const fastingDayDates = new Set(fastingDays.map(f => f.date));

  return (
    <div className="min-h-screen" style={{ background: '#FFFDF8' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-amber-100" style={{ background: 'rgba(255,253,248,0.95)', backdropFilter: 'blur(8px)' }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <span className="font-bold text-xl" style={{ color: '#E8793A' }}>Sattvic</span>
          </div>
          <div className="flex items-center gap-3">
            {userName && <span className="text-sm text-gray-500">Namaste, {userName} 🙏</span>}
            <a href="/profile" className="text-sm text-gray-500 hover:text-charcoal transition-colors">Profile</a>
            <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Week Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-charcoal">This Week's Meals</h1>
            <p className="text-sm text-gray-500 mt-0.5">{weekLabel}</p>
          </div>
          <div className="flex gap-2">
            {plan && (
              <button onClick={exportCalendar}
                className="px-4 py-2 rounded-pill text-sm font-medium border transition-colors hover:bg-gray-50"
                style={{ border: '1.5px solid #E8793A', color: '#E8793A', borderRadius: '50px' }}>
                📅 Export Calendar
              </button>
            )}
            <button onClick={generatePlan} disabled={generating}
              className="px-5 py-2 rounded-pill text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: '#E8793A', borderRadius: '50px' }}>
              {generating ? '✨ Generating...' : plan ? '🔄 Regenerate' : '✨ Generate Plan'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-red-700 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            ⚠️ {error}
          </div>
        )}

        <FastingBanner fastingDays={fastingDays} />

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-4xl mb-3 animate-pulse">🌿</div>
              <p className="text-gray-400 text-sm">Loading your meal plan…</p>
            </div>
          </div>
        ) : !plan && !partialDays ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-5xl mb-4">🍽️</div>
            <h2 className="text-xl font-semibold text-charcoal mb-2">No meal plan yet</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-xs">
              Generate your personalised weekly meal plan based on your family's health profiles and doshas.
            </p>
            <button onClick={generatePlan} disabled={generating}
              className="px-6 py-3 rounded-pill text-white font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: '#E8793A', borderRadius: '50px' }}>
              {generating ? '✨ Generating your plan…' : '✨ Generate My Meal Plan'}
            </button>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Main week grid — scrollable */}
            <div className="flex-1 overflow-x-auto">
              <div className="flex gap-3 min-w-max pb-4">
                {(partialDays ?? plan?.days?.map(d => d as DayPlan | null) ?? []).map((day, i) =>
                  day ? (
                    <DayColumn
                      key={day.date}
                      day={day}
                      isFasting={fastingDayDates.has(day.date)}
                      onClick={setSelectedMeal}
                    />
                  ) : (
                    <DayColumnSkeleton key={i} date={weekDayDates[i]} />
                  )
                )}
              </div>
            </div>

            {/* Sidebar — protein panel */}
            {proteinTargets.length > 0 && plan && (
              <div className="w-64 shrink-0">
                <div className="rounded-2xl p-4 sticky top-24" style={{ background: '#FDF6EC', border: '1px solid #F5E9D6' }}>
                  <h3 className="font-bold text-sm text-charcoal mb-3">Today's Protein</h3>
                  {members.map((m) => {
                    const target = proteinTargets.find(t => t.member_id === m.id);
                    if (!target) return null;
                    return <ProteinBar key={m.id} member={m} target={target} achieved={getTodayProtein(m.id)} />;
                  })}
                  <p className="text-xs text-gray-400 mt-3">Tap any meal to see full nutrition details.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Meal detail modal */}
      {selectedMeal && (
        <MealDetailModal
          meal={selectedMeal}
          members={members}
          onClose={() => setSelectedMeal(null)}
          onRegenerate={handleRegenerate}
        />
      )}
    </div>
  );
}
