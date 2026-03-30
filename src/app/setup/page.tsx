'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StepFamily from '@/components/wizard/StepFamily';
import StepDosha from '@/components/wizard/StepDosha';
import StepHealth from '@/components/wizard/StepHealth';
import StepPreferences from '@/components/wizard/StepPreferences';
import type { WizardMemberDraft, FastingType, WizardState } from '@/types';

const STEPS = [
  { id: 1, label: 'Family', icon: '👨‍👩‍👧‍👦', description: 'Who\'s in your family?' },
  { id: 2, label: 'Dosha', icon: '🧘', description: 'Ayurvedic body type' },
  { id: 3, label: 'Health', icon: '💚', description: 'Conditions & goals' },
  { id: 4, label: 'Cuisine', icon: '🍽️', description: 'Food & fasting prefs' },
];

function blankMember(): WizardMemberDraft {
  return {
    id: crypto.randomUUID(),
    name: '',
    dob: '',
    weight_kg: undefined,
    height_cm: undefined,
    dietary_preference: 'vegetarian',
    activity_level: 'moderate',
    dosha: undefined,
    health_conditions: [],
    health_goals: [],
    cuisines: [],
  };
}

const initialState: WizardState = {
  step: 1,
  members: [blankMember()],
  zip: '',
  country: 'in',
  fasting_types: [],
};

export default function SetupPage() {
  const router = useRouter();
  const [state, setState] = useState<WizardState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate current step before advancing
  const validateStep = (): string | null => {
    if (state.step === 1) {
      const invalid = state.members.find(m => !m.name.trim() || !m.dob);
      if (invalid) return `Please fill in name and date of birth for all family members.`;
      if (state.members.length === 0) return 'Please add at least one family member.';
    }
    if (state.step === 4) {
      if (!state.zip.trim()) return 'Please enter your ZIP/PIN code for accurate fasting calendar.';
      if (state.members[0]?.cuisines.length === 0) return 'Please select at least one cuisine preference.';
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError(null);
    setState(s => ({ ...s, step: Math.min(s.step + 1, 4) }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prev = () => {
    setError(null);
    setState(s => ({ ...s, step: Math.max(s.step - 1, 1) }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          members: state.members,
          cuisine_preferences: state.members[0]?.cuisines ?? [],
          location_zip:        state.zip,
          location_country:    state.country,
          fasting_types:       state.fasting_types,
          fasting_strictness:  'moderate',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Setup failed');
      router.push('/home');
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  const progress = ((state.step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#FFFDF8' }}>
      {/* Header */}
      <header className="border-b border-amber-100 px-4 h-14 flex items-center"
        style={{ background: 'rgba(255,253,248,0.95)' }}>
        <div className="max-w-lg mx-auto w-full flex items-center gap-2">
          <span className="text-xl">🌿</span>
          <span className="font-bold" style={{ color: '#E8793A' }}>Sattvic</span>
          <span className="text-xs text-gray-400 ml-1">· Family Setup</span>
        </div>
      </header>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        {/* Step indicators */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, idx) => {
            const done = state.step > step.id;
            const active = state.step === step.id;
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                    style={{
                      background: done ? '#4A7C59' : active ? '#E8793A' : '#F5E9D6',
                      color: done || active ? 'white' : '#999',
                    }}>
                    {done ? '✓' : step.icon}
                  </div>
                  <div className="text-xs mt-1 font-medium"
                    style={{ color: active ? '#E8793A' : done ? '#4A7C59' : '#999' }}>
                    {step.label}
                  </div>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2 rounded-full"
                    style={{ background: state.step > step.id ? '#4A7C59' : '#F5E9D6' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-700"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Step content */}
        <div className="mb-8">
          {state.step === 1 && (
            <StepFamily
              members={state.members}
              onChange={members => setState(s => ({ ...s, members }))}
            />
          )}
          {state.step === 2 && (
            <StepDosha
              members={state.members}
              onChange={members => setState(s => ({ ...s, members }))}
            />
          )}
          {state.step === 3 && (
            <StepHealth
              members={state.members}
              onChange={members => setState(s => ({ ...s, members }))}
            />
          )}
          {state.step === 4 && (
            <StepPreferences
              members={state.members}
              onChange={members => setState(s => ({ ...s, members }))}
              zip={state.zip}
              country={state.country}
              fastingTypes={state.fasting_types}
              onZipChange={zip => setState(s => ({ ...s, zip }))}
              onCountryChange={country => setState(s => ({ ...s, country }))}
              onFastingChange={fasting_types => setState(s => ({ ...s, fasting_types }))}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          {state.step > 1 ? (
            <button onClick={prev}
              className="px-5 py-2.5 rounded-pill text-sm font-medium text-gray-500 border hover:bg-gray-50 transition-colors"
              style={{ borderRadius: '50px', border: '1.5px solid #E5E7EB' }}>
              ← Back
            </button>
          ) : <div />}

          {state.step < 4 ? (
            <button onClick={next}
              className="px-6 py-2.5 rounded-pill text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: '#E8793A', borderRadius: '50px' }}>
              Continue →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              className="px-6 py-2.5 rounded-pill text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: '#E8793A', borderRadius: '50px' }}>
              {submitting ? '✨ Saving…' : '🌿 Save & Get My Meal Plan'}
            </button>
          )}
        </div>

        {/* Step hint */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Step {state.step} of {STEPS.length} — {STEPS[state.step - 1].description}
        </p>
      </div>
    </div>
  );
}
