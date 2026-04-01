'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { calcAllProteinTargets } from '@/domain/protein';
import { formatWeekRange, getWeekStart } from '@/domain/lunar';
import type { MealPlan, FamilyMember, FastingDay, DayPlan, Meal, ProteinTarget } from '@/types';

// ─── Skeleton for a day row while loading ──────────────────────────────────────

function DayRowSkeleton({ date }: { date: Date }) {
  const dayName = date.toLocaleDateString('en-IN', { weekday: 'long' });
  const dayNum  = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden animate-pulse mb-4">
      <div className="px-5 py-3 bg-gray-50 flex items-center gap-3">
        <div className="w-20 h-4 bg-gray-200 rounded" />
        <div className="w-16 h-3 bg-gray-100 rounded" />
      </div>
      <div className="grid grid-cols-3 gap-3 p-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-xl bg-gray-100 h-24" />
        ))}
      </div>
    </div>
  );
}

// ─── Single meal card ──────────────────────────────────────────────────────────

function MealCard({ meal, onClick }: { meal: Meal; onClick: () => void }) {
  const emojiMap: Record<string, string> = {
    breakfast: '☀️', lunch: '🌤️', dinner: '🌙', snack: '🍎',
  };
  const n = meal.nutrition;
  return (
    <button onClick={onClick}
      className="w-full text-left p-3 rounded-xl bg-white active:bg-gray-50 hover:shadow-md transition-shadow duration-200 border border-gray-100 flex flex-col sm:h-full">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">{emojiMap[meal.meal_type ?? ''] ?? '🍽️'}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 capitalize">{meal.meal_type}</span>
        {meal.is_fasting_friendly && (
          <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full text-purple-700 shrink-0"
            style={{ background: '#F3EAF7', border: '1px solid #9B6BB5' }}>Fast</span>
        )}
      </div>
      {/* On mobile show full name; on desktop clamp to 2 lines */}
      <div className="font-semibold text-sm text-gray-800 leading-snug mb-1.5 sm:line-clamp-2">{meal.name}</div>
      {n && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-gray-400 mt-auto">
          {n.calories && <span>🔥 {n.calories} kcal</span>}
          {n.protein_g && <span style={{ color: '#5B8DD9' }}>💪 {n.protein_g}g</span>}
        </div>
      )}
    </button>
  );
}

// ─── A full day row (header + 3 meal cards) ────────────────────────────────────

function DayRow({ day, isFasting, onClick }: {
  day: DayPlan;
  isFasting: boolean;
  onClick: (meal: Meal) => void;
}) {
  const date    = new Date(day.date + 'T12:00:00');
  const dayName = date.toLocaleDateString('en-IN', { weekday: 'long' });
  const dayNum  = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const isToday = new Date().toDateString() === date.toDateString();

  const headerStyle = isFasting
    ? { background: '#F3EAF7', borderBottom: '1px solid #9B6BB5' }
    : isToday
    ? { background: '#E8793A', borderBottom: 'none' }
    : { background: '#FDF6EC', borderBottom: '1px solid #F5E9D6' };

  const headerText = isFasting ? 'text-purple-800' : isToday ? 'text-white' : 'text-gray-700';

  return (
    <div className="rounded-2xl overflow-hidden mb-4" style={{ border: '1px solid #F0E8D8' }}>
      <div className={`px-5 py-3 flex items-center gap-3 ${headerText}`} style={headerStyle}>
        <span className="font-bold text-base">{dayName}</span>
        <span className="text-sm opacity-75">{dayNum}</span>
        {isToday && <span className="ml-1 text-xs font-semibold opacity-90 bg-white bg-opacity-25 px-2 py-0.5 rounded-full">Today</span>}
        {isFasting && <span className="ml-auto text-sm">🙏 Fasting day</span>}
      </div>
      {/* Mobile: stacked meals; Desktop: 3-column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 p-3 sm:p-4" style={{ background: '#FFFDF8' }}>
        {(['breakfast', 'lunch', 'dinner'] as const).map(type => {
          const meal = day.meals.find(m => m.meal_type === type);
          return meal
            ? <MealCard key={type} meal={meal} onClick={() => onClick(meal)} />
            : <div key={type} className="rounded-xl bg-gray-50 border border-gray-100 h-16 sm:h-24 flex items-center justify-center text-xs text-gray-300">No {type}</div>;
        })}
      </div>
    </div>
  );
}

// ─── Meal detail modal ─────────────────────────────────────────────────────────

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

        {meal.nutrition && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Calories', value: meal.nutrition.calories, unit: 'kcal', color: '#E8793A' },
              { label: 'Protein',  value: meal.nutrition.protein_g, unit: 'g',   color: '#5B8DD9' },
              { label: 'Carbs',    value: meal.nutrition.carbs_g,  unit: 'g',   color: '#F5A623' },
              { label: 'Fat',      value: meal.nutrition.fat_g,    unit: 'g',   color: '#4A7C59' },
            ].map(n => n.value && (
              <div key={n.label} className="text-center p-2 rounded-xl" style={{ background: '#FDF6EC' }}>
                <div className="text-lg font-bold" style={{ color: n.color }}>{n.value}</div>
                <div className="text-xs text-gray-400">{n.unit}</div>
                <div className="text-xs text-gray-500">{n.label}</div>
              </div>
            ))}
          </div>
        )}

        {meal.ingredients && meal.ingredients.length > 0 && (
          <div className="mb-4">
            <h3 className="font-semibold text-sm text-charcoal mb-2">Ingredients</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              {meal.ingredients.map((ing, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#E8793A' }} />
                  {ing}
                </li>
              ))}
            </ul>
          </div>
        )}

        {meal.instructions && meal.instructions.length > 0 && (
          <div className="mb-4">
            <h3 className="font-semibold text-sm text-charcoal mb-2">Instructions</h3>
            <ol className="text-sm text-gray-600 space-y-2">
              {meal.instructions.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold"
                    style={{ background: '#E8793A' }}>{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

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
            className="flex-1 py-2.5 text-sm font-semibold border transition-colors hover:bg-gray-50"
            style={{ border: '1.5px solid #E8793A', color: '#E8793A', borderRadius: '50px' }}>
            🔄 Regenerate Meal
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
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

  const [plan, setPlan]                   = useState<MealPlan | null>(null);
  const [fastingDays, setFastingDays]     = useState<FastingDay[]>([]);
  const [members, setMembers]             = useState<FamilyMember[]>([]);
  const [proteinTargets, setProteinTargets] = useState<ProteinTarget[]>([]);
  const [loading, setLoading]             = useState(false);
  const [generating, setGenerating]       = useState(false);
  const [selectedMeal, setSelectedMeal]   = useState<Meal | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [userName, setUserName]           = useState('');
  // partialDays: 7-slot array used while generating. null = still loading.
  const [partialDays, setPartialDays]     = useState<(DayPlan | null)[] | null>(null);

  const weekStart  = getWeekStart(new Date());
  const weekLabel  = formatWeekRange(weekStart);
  const weekDayDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  useEffect(() => { loadData(); }, []);

  const normalizePlan = (raw: unknown): MealPlan => {
    const r = raw as Record<string, unknown>;
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
        .from('meal_plans').select('*')
        .eq('user_id', user.id).eq('week_start_date', weekKey).single();

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

    // Start with 7 null slots — each fills in as batches return
    const collected: (DayPlan | null)[] = Array(7).fill(null);
    setPartialDays([...collected]);

    const weekKey = weekStart.toISOString().split('T')[0];
    let weekFastingDays: FastingDay[] = [];

    const fetchBatch = async (startDay: number, dayCount: number, avoidMeals: string[] = []) => {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: weekKey, startDay, dayCount, avoidMeals }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Days ${startDay}–${startDay + dayCount - 1} failed`);
      (json.days as DayPlan[]).forEach((day, i) => { collected[startDay + i] = day; });
      setPartialDays([...collected]);
      return json;
    };

    try {
      // First 2 days — show these first so user sees something quickly
      const json0 = await fetchBatch(0, 2);
      weekFastingDays = json0.fastingDays ?? [];
      setFastingDays(weekFastingDays);

      // Extract meal names from batch 0 to avoid repetition in later batches
      const usedMeals: string[] = (json0.days as DayPlan[])
        .flatMap(d => d.meals.map(m => m.name))
        .filter(Boolean);

      // Next batches in parallel — pass used meals so AI avoids repeating them
      await Promise.all([
        fetchBatch(2, 2, usedMeals),
        fetchBatch(4, 2, usedMeals),
        fetchBatch(6, 1, usedMeals),
      ]);

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
  // Rows to render — either partial (while generating) or full plan
  const displayRows: (DayPlan | null)[] =
    partialDays ?? plan?.days?.map(d => d as DayPlan | null) ?? [];

  return (
    <div className="min-h-screen" style={{ background: '#FFFDF8' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-amber-100"
        style={{ background: 'rgba(255,253,248,0.95)', backdropFilter: 'blur(8px)' }}>
        <div className="max-w-4xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl">🌿</span>
            <span className="font-bold text-lg sm:text-xl" style={{ color: '#E8793A' }}>Sattvic</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {userName && <span className="hidden sm:inline text-sm text-gray-500">Namaste, {userName} 🙏</span>}
            <a href="/profile" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">Profile</a>
            <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Week header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: '#2C2416' }}>This Week's Meals</h1>
            <p className="text-sm text-gray-500 mt-0.5">{weekLabel}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            {plan && (
              <button onClick={exportCalendar}
                className="px-3 sm:px-4 py-2 text-sm font-medium border transition-colors hover:bg-gray-50"
                style={{ border: '1.5px solid #E8793A', color: '#E8793A', borderRadius: '50px' }}>
                📅 <span className="hidden sm:inline">Export</span>
              </button>
            )}
            <button onClick={generatePlan} disabled={generating}
              className="px-4 sm:px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: '#E8793A', borderRadius: '50px' }}>
              {generating ? '✨ Generating...' : plan ? '🔄 Regenerate' : '✨ Generate Plan'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-red-700 text-sm"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            ⚠️ {error}
          </div>
        )}

        {generating && (
          <div className="mb-4 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2"
            style={{ background: '#FDF6EC', border: '1px solid #F5E9D6', color: '#92703A' }}>
            <span className="animate-spin">✨</span>
            Generating your meal plan 2 days at a time — your first days will appear in seconds…
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-4xl mb-3 animate-pulse">🌿</div>
              <p className="text-gray-400 text-sm">Loading your meal plan…</p>
            </div>
          </div>
        ) : displayRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-5xl mb-4">🍽️</div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C2416' }}>No meal plan yet</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-xs">
              Generate your personalised weekly meal plan based on your family's health profiles and doshas.
            </p>
            <button onClick={generatePlan} disabled={generating}
              className="px-6 py-3 text-white font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: '#E8793A', borderRadius: '50px' }}>
              {generating ? '✨ Generating your plan…' : '✨ Generate My Meal Plan'}
            </button>
          </div>
        ) : (
          {/* Mobile protein strip — shown only on small screens */}
          {proteinTargets.length > 0 && plan && (
            <div className="sm:hidden flex gap-3 mb-4 overflow-x-auto pb-1">
              {members.map(m => {
                const target = proteinTargets.find(t => t.member_id === m.id);
                if (!target) return null;
                const achieved = getTodayProtein(m.id);
                const pct = Math.min(100, Math.round((achieved / target.target_g) * 100));
                const color = pct >= 80 ? '#4A7C59' : pct >= 50 ? '#F5A623' : '#C2546E';
                return (
                  <div key={m.id} className="rounded-xl p-3 shrink-0 min-w-[140px]"
                    style={{ background: '#FDF6EC', border: '1px solid #F5E9D6' }}>
                    <div className="text-xs font-semibold mb-1" style={{ color: '#2C2416' }}>{m.name} — Today's protein</div>
                    <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden mb-1">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <div className="text-xs text-gray-500">{achieved}g / {target.target_g}g ({pct}%)</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-6 items-start">
            {/* Day rows — vertical stack */}
            <div className="flex-1">
              {displayRows.map((day, i) =>
                day ? (
                  <DayRow
                    key={day.date}
                    day={day}
                    isFasting={fastingDayDates.has(day.date)}
                    onClick={setSelectedMeal}
                  />
                ) : (
                  <DayRowSkeleton key={i} date={weekDayDates[i]} />
                )
              )}
            </div>

            {/* Sidebar — protein panel (desktop only) */}
            {proteinTargets.length > 0 && plan && (
              <div className="hidden sm:block w-56 shrink-0">
                <div className="rounded-2xl p-4 sticky top-24"
                  style={{ background: '#FDF6EC', border: '1px solid #F5E9D6' }}>
                  <h3 className="font-bold text-sm mb-3" style={{ color: '#2C2416' }}>Today's Protein</h3>
                  {members.map(m => {
                    const target = proteinTargets.find(t => t.member_id === m.id);
                    if (!target) return null;
                    const achieved = getTodayProtein(m.id);
                    const pct = Math.min(100, Math.round((achieved / target.target_g) * 100));
                    const color = pct >= 80 ? '#4A7C59' : pct >= 50 ? '#F5A623' : '#C2546E';
                    return (
                      <div key={m.id} className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium" style={{ color: '#2C2416' }}>{m.name}</span>
                          <span className="text-xs text-gray-500">{achieved}g / {target.target_g}g</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{pct}% of daily target</div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-gray-400 mt-3">Tap any meal for full details.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

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
