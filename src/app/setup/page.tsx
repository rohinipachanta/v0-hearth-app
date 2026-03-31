'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import StepFamily from '@/components/wizard/StepFamily';
import StepHealth from '@/components/wizard/StepHealth';
import StepPreferences from '@/components/wizard/StepPreferences';
import { blankMember } from '@/lib/wizard-utils';
import type { FastingType, WizardState, FamilyMember, WizardMemberDraft } from '@/types';

const STEPS = [
  { id: 1, label: 'Family',  icon: '👨‍👩‍👧‍👦', description: "Who's in your family?" },
  { id: 2, label: 'Health',  icon: '💚',         description: 'Body type, conditions & goals' },
  { id: 3, label: 'Cuisine', icon: '🍽️',         description: 'Food preferences & fasting' },
];

function memberToWizard(m: FamilyMember): WizardMemberDraft {
  const ifGoal = (m.health_goals ?? []).find((g: string) => g.startsWith('if_'));
  const baseGoals = (m.health_goals ?? []).filter((g: string) => !g.startsWith('if_'));
  return {
    id:                 m.id,
    name:               m.name,
    dob:                m.date_of_birth ?? '',
    weight_kg:          m.weight_kg ?? undefined,
    height_cm:          m.height_cm ?? undefined,
    gender:             m.gender,
    dietary_preference: m.dietary_preference ?? 'vegetarian',
    activity_level:     m.activity_level ?? 'moderate',
    dosha:              m.dosha ?? undefined,
    health_conditions:  (m.health_conditions ?? []) as WizardMemberDraft['health_conditions'],
    health_goals:       baseGoals as WizardMemberDraft['health_goals'],
    cuisines:           (m.cuisine_preferences ?? m.cuisines ?? []) as WizardMemberDraft['cuisines'],
    if_schedule:        ifGoal as WizardMemberDraft['if_schedule'],
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
  const supabase = createClient();
  const [state, setState] = useState<WizardState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoadingExisting(false); return; }

        const { data: members } = await supabase
          .from('family_members')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at');

        const { data: userData } = await supabase
          .from('users')
          .select('location_zip, location_country')
          .eq('id', user.id)
          .single();

        const { data: fastingData } = await supabase
          .from('fasting_preferences')
          .select('fasting_types')
          .eq('user_id', user.id)
          .single();

        if (members && members.length > 0) {
          setIsEditing(true);
          setState({
            step:          1,
            members:       (members as FamilyMember[]).map(memberToWizard),
            zip:           userData?.location_zip ?? '',
            country:       (userData?.location_country ?? 'in').toLowerCase(),
            fasting_types: (fastingData?.fasting_types ?? []) as FastingType[],
          });
        }
      } catch (e) {
        console.error('Error loading existing profile:', e);
      } finally {
        setLoadingExisting(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const validateStep = (): string | null => {
    if (state.step === 1) {
      if (state.members.length === 0) return 'Please add at least one family member.';
      const invalid = state.members.find(m => !m.name.trim() || !m.dob);
      if (invalid) return 'Please fill in name and date of birth for all family members.';
    }
    if (state.step === 3) {
      if (!state.zip.trim()) return 'Please enter your ZIP/PIN code for accurate fasting calendar.';
      if ((state.members[0]?.cuisines?.length ?? 0) === 0) return 'Please select at least one cuisine preference.';
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError(null);
    setState(s => ({ ...s, step: Math.min(s.step + 1, STEPS.length) }));
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
          members:             state.members,
          cuisine_preferences: state.members[0]?.cuisines ?? [],
          location_zip:        state.zip,
          location_country:    state.country,
          fasting_types:       state.fasting_types,
          fasting_strictness:  'standard',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Setup failed');
      router.push(isEditing ? '/profile' : '/home');
    } catch (e: unknown) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  };

  if (loadingExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFFDF8' }}>
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🌿</div>
          <p className="text-gray-400 text-sm">Loading your profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#FFFDF8' }}>
      <header className="border-b border-amber-100 px-4 h-14 flex items-center sticky top-0 z-40"
        style={{ background: 'rgba(255,253,248,0.95)', backdropFilter: 'blur(8px)' }}>
        <div className="max-w-lg mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌿</span>
            <span className="font-bold" style={{ color: '#E8793A' }}>Sattvic</span>
            <span className="text-xs text-gray-400 ml-1">
              · {isEditing ? 'Edit Profile' : 'Family Setup'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isEditing && (
              <a href="/profile" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Cancel
              </a>
            )}
            <button onClick={handleSignOut}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        {isEditing && (
          <div className="mb-5 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
            style={{ background: '#FEF0E6', border: '1px solid #FDDCB9', color: '#C25E1A' }}>
            ✏️ Editing your family profile — changes will be saved when you finish.
          </div>
        )}

        {/* Step indicators */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, idx) => {
            const done   = state.step > step.id;
            const active = state.step === step.id;
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all"
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
                  <div className="flex-1 h-0.5 mx-2 rounded-full mb-4"
                    style={{ background: state.step > step.id ? '#4A7C59' : '#F5E9D6' }} />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-700"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            ⚠️ {error}
          </div>
        )}

        <div className="mb-8">
          {state.step === 1 && (
            <StepFamily
              members={state.members}
              onChange={members => setState(s => ({ ...s, members }))}
            />
          )}
          {state.step === 2 && (
            <StepHealth
              members={state.members}
              onChange={members => setState(s => ({ ...s, members }))}
            />
          )}
          {state.step === 3 && (
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

        <div className="flex items-center justify-between">
          {state.step > 1 ? (
            <button onClick={prev}
              className="px-5 py-2.5 text-sm font-medium text-gray-500 border hover:bg-gray-50 transition-colors"
              style={{ borderRadius: '50px', border: '1.5px solid #E5E7EB' }}>
              ← Back
            </button>
          ) : <div />}

          {state.step < STEPS.length ? (
            <button onClick={next}
              className="px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: '#E8793A', borderRadius: '50px' }}>
              Continue →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              className="px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: '#E8793A', borderRadius: '50px' }}>
              {submitting ? '✨ Saving…' : isEditing ? '💾 Save Changes' : '🌿 Save & Get My Meal Plan'}
            </button>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Step {state.step} of {STEPS.length} — {STEPS[state.step - 1].description}
        </p>
      </div>
    </div>
  );
}
