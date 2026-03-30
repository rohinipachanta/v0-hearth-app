'use client';

import type { WizardMemberDraft, HealthCondition, HealthGoal } from '@/types';

const HEALTH_CONDITIONS: { value: HealthCondition; label: string; emoji: string }[] = [
  { value: 'diabetes', label: 'Diabetes / Pre-diabetes', emoji: '🩸' },
  { value: 'hypertension', label: 'High Blood Pressure', emoji: '💓' },
  { value: 'pcos', label: 'PCOS / PCOD', emoji: '🌺' },
  { value: 'thyroid', label: 'Thyroid Issues', emoji: '🦋' },
  { value: 'anaemia', label: 'Anaemia', emoji: '💊' },
  { value: 'ibs', label: 'IBS / Gut Issues', emoji: '🫁' },
  { value: 'pregnancy', label: 'Pregnant / Nursing', emoji: '🤱' },
  { value: 'heart_disease', label: 'Heart Disease', emoji: '🫀' },
  { value: 'kidney_disease', label: 'Kidney Issues', emoji: '🫘' },
  { value: 'lactose_intolerant', label: 'Lactose Intolerant', emoji: '🥛' },
  { value: 'gluten_intolerant', label: 'Gluten Intolerant', emoji: '🌾' },
  { value: 'nut_allergy', label: 'Nut Allergy', emoji: '🥜' },
];

const HEALTH_GOALS: { value: HealthGoal; label: string; emoji: string; description: string }[] = [
  { value: 'weight_loss', label: 'Weight Loss', emoji: '⚖️', description: 'Calorie-controlled, high protein meals' },
  { value: 'weight_gain', label: 'Weight Gain', emoji: '💪', description: 'Calorie-dense, nutrient-rich meals' },
  { value: 'energy', label: 'Energy & Vitality', emoji: '⚡', description: 'Balanced carbs, adaptogens, iron-rich foods' },
  { value: 'gut_health', label: 'Gut Health & Digestion', emoji: '🫁', description: 'Probiotic-rich, fibre-forward meals' },
  { value: 'hormonal_balance', label: 'Hormonal Balance', emoji: '🌺', description: 'Anti-inflammatory, phytoestrogen-aware meals' },
  { value: 'muscle_gain', label: 'Muscle Building', emoji: '🏋️', description: 'High protein with strength training support' },
  { value: 'diabetes_management', label: 'Blood Sugar Control', emoji: '🩸', description: 'Low GI, complex carb meals' },
  { value: 'heart_health', label: 'Heart Health', emoji: '🫀', description: 'Low sodium, healthy fats, omega-3 rich' },
];

interface Props {
  members: WizardMemberDraft[];
  onChange: (members: WizardMemberDraft[]) => void;
}

function ToggleChip({
  selected, onClick, emoji, label,
}: { selected: boolean; onClick: () => void; emoji: string; label: string }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
      style={{
        border: selected ? '1.5px solid #E8793A' : '1.5px solid #F0E8DC',
        background: selected ? '#FEF0E6' : 'white',
        color: selected ? '#E8793A' : '#555',
      }}>
      <span>{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

export default function StepHealth({ members, onChange }: Props) {
  const toggle = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value];

  const updateMember = (id: string, patch: Partial<WizardMemberDraft>) =>
    onChange(members.map(m => m.id === id ? { ...m, ...patch } : m));

  return (
    <div>
      <h2 className="text-xl font-bold text-charcoal mb-1">Health & Goals</h2>
      <p className="text-sm text-gray-500 mb-6">
        Select any relevant health conditions and goals for each family member. This shapes protein targets and meal choices.
      </p>

      <div className="space-y-5">
        {members.map(member => (
          <div key={member.id} className="rounded-2xl p-4" style={{ background: '#FDF6EC', border: '1.5px solid #F5E9D6' }}>
            <h3 className="font-semibold text-charcoal text-sm mb-4">{member.name || 'Member'}</h3>

            {/* Health conditions */}
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Health Conditions</p>
              <div className="flex flex-wrap gap-2">
                {HEALTH_CONDITIONS.map(cond => (
                  <ToggleChip
                    key={cond.value}
                    selected={member.health_conditions.includes(cond.value)}
                    onClick={() => updateMember(member.id, {
                      health_conditions: toggle(member.health_conditions, cond.value)
                    })}
                    emoji={cond.emoji}
                    label={cond.label}
                  />
                ))}
              </div>
              {member.health_conditions.length === 0 && (
                <p className="text-xs text-gray-300 mt-1.5">None selected — leave blank if not applicable</p>
              )}
            </div>

            {/* Health goals */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Health Goals</p>
              <div className="space-y-2">
                {HEALTH_GOALS.map(goal => {
                  const selected = member.health_goals.includes(goal.value);
                  return (
                    <button key={goal.value}
                      onClick={() => updateMember(member.id, {
                        health_goals: toggle(member.health_goals, goal.value)
                      })}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                      style={{
                        border: selected ? '1.5px solid #E8793A' : '1.5px solid #F0E8DC',
                        background: selected ? '#FEF0E6' : 'white',
                      }}>
                      <span className="text-lg">{goal.emoji}</span>
                      <div className="flex-1">
                        <div className="text-sm font-medium" style={{ color: selected ? '#E8793A' : '#2C2416' }}>
                          {goal.label}
                        </div>
                        <div className="text-xs text-gray-400">{goal.description}</div>
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
          </div>
        ))}
      </div>
    </div>
  );
}
