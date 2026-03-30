'use client';

import { useState } from 'react';
import { PRAKRITI_QUIZ, scoreDoshaQuiz } from '@/domain/ayurveda';
import type { WizardMemberDraft, HealthCondition, HealthGoal, Dosha, IntermittentFastingSchedule } from '@/types';

const DOSHA_INFO: Record<Dosha, { label: string; emoji: string; description: string; color: string }> = {
  vata:        { label: 'Vata',        emoji: '🌬️',   description: 'Air & Space — Creative, quick, tends toward dryness', color: '#7B9EC4' },
  pitta:       { label: 'Pitta',       emoji: '🔥',    description: 'Fire & Water — Ambitious, sharp, tends toward heat', color: '#E8793A' },
  kapha:       { label: 'Kapha',       emoji: '🌊',    description: 'Water & Earth — Steady, nurturing, tends toward weight gain', color: '#4A7C59' },
  vata_pitta:  { label: 'Vata-Pitta',  emoji: '🌬️🔥', description: 'Dual: Air + Fire constitution', color: '#9B72CF' },
  pitta_kapha: { label: 'Pitta-Kapha', emoji: '🔥🌊', description: 'Dual: Fire + Water-Earth constitution', color: '#C2546E' },
  vata_kapha:  { label: 'Vata-Kapha',  emoji: '🌬️🌊', description: 'Dual: Air + Water-Earth constitution', color: '#5B8DD9' },
};

const HEALTH_CONDITIONS: { value: HealthCondition; label: string; emoji: string }[] = [
  { value: 'diabetes',           label: 'Diabetes / Pre-diabetes',  emoji: '🩸' },
  { value: 'hypertension',       label: 'High Blood Pressure',       emoji: '💓' },
  { value: 'high_cholesterol',   label: 'High Cholesterol',          emoji: '🧪' },
  { value: 'pcos',               label: 'PCOS / PCOD',               emoji: '🌺' },
  { value: 'thyroid',            label: 'Thyroid Issues',            emoji: '🦋' },
  { value: 'anaemia',            label: 'Anaemia',                   emoji: '💊' },
  { value: 'ibs',                label: 'IBS / Gut Issues',          emoji: '🫁' },
  { value: 'pregnancy',          label: 'Pregnant / Nursing',        emoji: '🤱' },
  { value: 'heart_disease',      label: 'Heart Disease',             emoji: '🫀' },
  { value: 'kidney_disease',     label: 'Kidney Issues',             emoji: '🫘' },
  { value: 'lactose_intolerant', label: 'Lactose Intolerant',        emoji: '🥛' },
  { value: 'gluten_intolerant',  label: 'Gluten Intolerant',         emoji: '🌾' },
  { value: 'nut_allergy',        label: 'Nut Allergy',               emoji: '🥜' },
];

const HEALTH_GOALS: { value: HealthGoal; label: string; emoji: string; description: string }[] = [
  { value: 'weight_loss',         label: 'Weight Loss',            emoji: '⚖️',  description: 'Calorie-controlled, high-protein meals' },
  { value: 'weight_gain',         label: 'Weight Gain',            emoji: '💪',  description: 'Calorie-dense, nutrient-rich meals' },
  { value: 'energy',              label: 'Energy & Vitality',      emoji: '⚡',  description: 'Balanced carbs, adaptogens, iron-rich foods' },
  { value: 'gut_health',          label: 'Gut Health & Digestion', emoji: '🌿',  description: 'Probiotic-rich, fibre-forward meals' },
  { value: 'hormonal_balance',    label: 'Hormonal Balance',       emoji: '🌺',  description: 'Anti-inflammatory, phytoestrogen-aware meals' },
  { value: 'muscle_gain',         label: 'Muscle Building',        emoji: '🏋️', description: 'High protein with strength training support' },
  { value: 'diabetes_management', label: 'Blood Sugar Control',    emoji: '🩸',  description: 'Low GI, complex carb meals' },
  { value: 'heart_health',        label: 'Heart Health',           emoji: '🫀',  description: 'Low sodium, healthy fats, omega-3 rich' },
];

const IF_SCHEDULES: { value: IntermittentFastingSchedule; label: string; hours: string; description: string; badge?: string }[] = [
  { value: 'if_12_12',     label: '12:12',         hours: '12 hr fast',     description: 'Gentle start — great for beginners',                       badge: 'Beginner' },
  { value: 'if_14_10',     label: '14:10',         hours: '14 hr fast',     description: 'Mild window, easy to fit into most routines' },
  { value: 'if_16_8',      label: '16:8',          hours: '16 hr fast',     description: 'Most popular — proven for weight & metabolism',             badge: 'Popular' },
  { value: 'if_18_6',      label: '18:6',          hours: '18 hr fast',     description: 'Moderate — enhances fat burning and mental focus' },
  { value: 'if_20_4',      label: '20:4',          hours: '20 hr fast',     description: 'Warrior Diet — one large evening meal window' },
  { value: 'if_omad',      label: 'OMAD',          hours: '23 hr fast',     description: 'One Meal A Day — advanced, requires high discipline',       badge: 'Advanced' },
  { value: 'if_5_2',       label: '5:2',           hours: '2 days/week',    description: '5 normal days + 2 days at ~500–600 kcal' },
  { value: 'if_4_3',       label: '4:3',           hours: '3 days/week',    description: '4 normal days + 3 calorie-restricted days' },
  { value: 'if_adf',       label: 'ADF',           hours: 'Every other day',description: 'Alternate Day Fasting — alternate normal and restricted' },
  { value: 'if_ete',       label: 'Eat-Stop-Eat',  hours: '24 hr, 1–2×/wk',description: 'Complete 24-hour fast once or twice a week' },
  { value: 'if_crescendo', label: 'Crescendo',     hours: '2–3×/week',      description: '12–16 hr fast on 2–3 non-consecutive days — PCOS-friendly', badge: 'PCOS' },
];

function ToggleChip({ selected, onClick, emoji, label }: { selected: boolean; onClick: () => void; emoji: string; label: string }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
      style={{
        border: selected ? '1.5px solid #E8793A' : '1.5px solid #F0E8DC',
        background: selected ? '#FEF0E6' : 'white',
        color: selected ? '#E8793A' : '#555',
      }}>
      <span>{emoji}</span><span>{label}</span>
    </button>
  );
}

function DoshaQuiz({ memberName, onComplete, onCancel }: { memberName: string; onComplete: (d: Dosha) => void; onCancel: () => void }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentQ, setCurrentQ] = useState(0);

  const handleAnswer = (qIdx: number, aIdx: number) => {
    const next = { ...answers, [qIdx]: aIdx };
    setAnswers(next);
    if (qIdx < PRAKRITI_QUIZ.length - 1) {
      setTimeout(() => setCurrentQ(qIdx + 1), 280);
    } else {
      onComplete(scoreDoshaQuiz(PRAKRITI_QUIZ.map((_, i) => next[i] ?? 0)));
    }
  };

  const pct = Math.round((Object.keys(answers).length / PRAKRITI_QUIZ.length) * 100);

  return (
    <div className="mt-2 rounded-2xl p-3" style={{ background: '#F8F3FF', border: '1.5px solid #C9A8E0' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-purple-800">Prakriti Quiz — {memberName}</p>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">✕ Cancel</button>
      </div>
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Q {Math.min(currentQ + 1, PRAKRITI_QUIZ.length)} of {PRAKRITI_QUIZ.length}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1 rounded-full bg-purple-100">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#9B6BB5' }} />
        </div>
      </div>
      <p className="text-xs font-medium text-charcoal mb-2">{PRAKRITI_QUIZ[currentQ].question}</p>
      <div className="space-y-1.5">
        {PRAKRITI_QUIZ[currentQ].answers.map((ans, i) => (
          <button key={i} onClick={() => handleAnswer(currentQ, i)}
            className="w-full text-left px-3 py-2 rounded-xl text-xs transition-all"
            style={{
              border: answers[currentQ] === i ? '1.5px solid #9B6BB5' : '1.5px solid #DDD0E8',
              background: answers[currentQ] === i ? 'rgba(155,107,181,0.1)' : 'white',
              color: answers[currentQ] === i ? '#7B3FA0' : '#2C2416',
            }}>
            <span className="font-semibold mr-1">{String.fromCharCode(65 + i)}.</span>{ans.text}
          </button>
        ))}
      </div>
      {currentQ > 0 && (
        <button onClick={() => setCurrentQ(q => q - 1)} className="mt-2 text-xs text-gray-400 hover:text-gray-600">← Previous</button>
      )}
    </div>
  );
}

interface Props {
  members: WizardMemberDraft[];
  onChange: (members: WizardMemberDraft[]) => void;
}

export default function StepHealth({ members, onChange }: Props) {
  const [quizFor, setQuizFor] = useState<string | null>(null);

  const toggle = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value];

  const updateMember = (id: string, patch: Partial<WizardMemberDraft>) =>
    onChange(members.map(m => m.id === id ? { ...m, ...patch } : m));

  const setDosha = (id: string, dosha: Dosha) => { updateMember(id, { dosha }); setQuizFor(null); };

  return (
    <div>
      <h2 className="text-xl font-bold text-charcoal mb-1">Health & Ayurveda</h2>
      <p className="text-sm text-gray-500 mb-5">
        Tell us about each family member's body type, health conditions, goals, and fasting schedule.
      </p>

      <div className="space-y-6">
        {members.map(member => (
          <div key={member.id} className="rounded-2xl p-4" style={{ background: '#FDF6EC', border: '1.5px solid #F5E9D6' }}>
            <h3 className="font-semibold text-charcoal text-sm mb-4">{member.name || 'Member'}</h3>

            {/* Dosha */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">🧘 Ayurvedic Body Type (Dosha)</p>
              {member.dosha ? (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                  style={{ background: DOSHA_INFO[member.dosha].color + '18', border: `1.5px solid ${DOSHA_INFO[member.dosha].color}40` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{DOSHA_INFO[member.dosha].emoji}</span>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: DOSHA_INFO[member.dosha].color }}>{DOSHA_INFO[member.dosha].label}</p>
                      <p className="text-xs text-gray-500">{DOSHA_INFO[member.dosha].description}</p>
                    </div>
                  </div>
                  <button onClick={() => updateMember(member.id, { dosha: undefined })} className="text-xs text-gray-400 hover:text-gray-600 ml-2 shrink-0">Reset</button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(Object.entries(DOSHA_INFO) as [Dosha, typeof DOSHA_INFO[Dosha]][]).map(([key, info]) => (
                      <button key={key} onClick={() => setDosha(member.id, key)}
                        className="px-2.5 py-1.5 rounded-full text-xs font-medium transition-all hover:shadow-sm"
                        style={{ border: `1.5px solid ${info.color}60`, color: info.color, background: info.color + '12' }}>
                        {info.emoji} {info.label}
                      </button>
                    ))}
                  </div>
                  {quizFor === member.id ? (
                    <DoshaQuiz memberName={member.name || 'this member'} onComplete={d => setDosha(member.id, d)} onCancel={() => setQuizFor(null)} />
                  ) : (
                    <button onClick={() => setQuizFor(member.id)}
                      className="w-full py-2 rounded-xl text-xs font-medium text-center transition-colors hover:bg-purple-50"
                      style={{ border: '1.5px dashed #9B6BB5', color: '#7B3FA0' }}>
                      🔮 Take 8-question Prakriti Quiz to find out
                    </button>
                  )}
                  <p className="text-xs text-gray-400 mt-1.5 text-center">Not sure? Skip — Gemini will use a balanced approach.</p>
                </>
              )}
            </div>

            {/* Health Conditions */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Health Conditions</p>
              <div className="flex flex-wrap gap-2">
                {HEALTH_CONDITIONS.map(cond => (
                  <ToggleChip key={cond.value}
                    selected={member.health_conditions.includes(cond.value)}
                    onClick={() => updateMember(member.id, { health_conditions: toggle(member.health_conditions, cond.value) })}
                    emoji={cond.emoji} label={cond.label} />
                ))}
              </div>
              {member.health_conditions.length === 0 && <p className="text-xs text-gray-300 mt-1.5">None — leave blank if not applicable</p>}
            </div>

            {/* Health Goals */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Health Goals</p>
              <div className="space-y-1.5">
                {HEALTH_GOALS.map(goal => {
                  const selected = member.health_goals.includes(goal.value);
                  return (
                    <button key={goal.value}
                      onClick={() => updateMember(member.id, { health_goals: toggle(member.health_goals, goal.value) })}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                      style={{ border: selected ? '1.5px solid #E8793A' : '1.5px solid #F0E8DC', background: selected ? '#FEF0E6' : 'white' }}>
                      <span className="text-base">{goal.emoji}</span>
                      <div className="flex-1">
                        <p className="text-xs font-medium" style={{ color: selected ? '#E8793A' : '#2C2416' }}>{goal.label}</p>
                        <p className="text-xs text-gray-400">{goal.description}</p>
                      </div>
                      <div className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                        style={{ borderColor: selected ? '#E8793A' : '#ddd', background: selected ? '#E8793A' : 'transparent' }}>
                        {selected && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Intermittent Fasting */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">⏱️ Intermittent Fasting Schedule</p>
              <p className="text-xs text-gray-400 mb-2">Optional — Gemini will time meals to fit the eating window.</p>
              <div className="space-y-1.5">
                {IF_SCHEDULES.map(ifs => {
                  const selected = member.if_schedule === ifs.value;
                  return (
                    <button key={ifs.value}
                      onClick={() => updateMember(member.id, { if_schedule: selected ? undefined : ifs.value })}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                      style={{ border: selected ? '1.5px solid #2D9D6E' : '1.5px solid #D4EDE4', background: selected ? '#EAF7F1' : 'white' }}>
                      <div className="w-16 shrink-0 text-center border-r pr-2" style={{ borderColor: selected ? '#2D9D6E40' : '#E8E8E8' }}>
                        <p className="text-xs font-bold" style={{ color: selected ? '#1A7A53' : '#555' }}>{ifs.label}</p>
                        <p className="text-xs text-gray-400">{ifs.hours}</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs" style={{ color: selected ? '#1A7A53' : '#2C2416' }}>
                          {ifs.description}
                          {ifs.badge && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs"
                              style={{ background: selected ? '#2D9D6E20' : '#F5F5F5', color: selected ? '#1A7A53' : '#888' }}>
                              {ifs.badge}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                        style={{ borderColor: selected ? '#2D9D6E' : '#ddd', background: selected ? '#2D9D6E' : 'transparent' }}>
                        {selected && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
