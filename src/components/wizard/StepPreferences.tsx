'use client';

import { useEffect, useState } from 'react';
import type { WizardMemberDraft, FastingType, Cuisine } from '@/types';

const CUISINES: { value: Cuisine; label: string; emoji: string }[] = [
  { value: 'north_indian', label: 'North Indian', emoji: '🫓' },
  { value: 'south_indian', label: 'South Indian', emoji: '🫙' },
  { value: 'gujarati', label: 'Gujarati', emoji: '🥘' },
  { value: 'maharashtrian', label: 'Maharashtrian', emoji: '🫕' },
  { value: 'bengali', label: 'Bengali', emoji: '🍛' },
  { value: 'rajasthani', label: 'Rajasthani', emoji: '🍲' },
  { value: 'kerala', label: 'Kerala / Malabar', emoji: '🥥' },
  { value: 'tamil', label: 'Tamil', emoji: '🍚' },
  { value: 'mediterranean', label: 'Mediterranean', emoji: '🫒' },
  { value: 'continental', label: 'Continental', emoji: '🥗' },
  { value: 'thai', label: 'Thai', emoji: '🌶️' },
  { value: 'chinese', label: 'Indo-Chinese', emoji: '🥢' },
];

const FASTING_TYPES: { value: FastingType; label: string; emoji: string; description: string }[] = [
  { value: 'ekadashi', label: 'Ekadashi', emoji: '🌙', description: '11th lunar day, twice a month' },
  { value: 'navratri', label: 'Navratri', emoji: '🌸', description: '9-night festival fasting' },
  { value: 'monday', label: 'Monday Fast', emoji: '📅', description: 'Dedicated to Lord Shiva' },
  { value: 'thursday', label: 'Thursday Fast', emoji: '📅', description: 'Dedicated to Vishnu / Guru' },
  { value: 'saturday', label: 'Saturday Fast', emoji: '📅', description: 'Dedicated to Saturn / Hanuman' },
  { value: 'pradosh', label: 'Pradosh Vrat', emoji: '🌗', description: '13th lunar day fasting' },
  { value: 'amavasya', label: 'Amavasya', emoji: '🌑', description: 'New moon day' },
  { value: 'purnima', label: 'Purnima', emoji: '🌕', description: 'Full moon day' },
];

interface Props {
  members: WizardMemberDraft[];
  onChange: (members: WizardMemberDraft[]) => void;
  zip: string;
  country: string;
  fastingTypes: FastingType[];
  onZipChange: (zip: string) => void;
  onCountryChange: (country: string) => void;
  onFastingChange: (types: FastingType[]) => void;
}

export default function StepPreferences({
  members, onChange, zip, country, fastingTypes,
  onZipChange, onCountryChange, onFastingChange
}: Props) {
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [locationName, setLocationName] = useState('');

  const toggle = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value];

  // All members share same cuisine preferences — use first member's list as global
  const globalCuisines = members[0]?.cuisines ?? [];
  const setGlobalCuisines = (cuisines: Cuisine[]) =>
    onChange(members.map(m => ({ ...m, cuisines })));

  // Resolve zip on change
  useEffect(() => {
    if (!zip || zip.length < 4) { setLocationStatus('idle'); return; }
    const timer = setTimeout(async () => {
      setLocationStatus('loading');
      try {
        const res = await fetch(`/api/resolve-location?zip=${zip}&country=${country}`);
        const json = await res.json();
        const loc = json.location;
        if (loc?.city) {
          setLocationName(`${loc.city}, ${loc.country}`);
          setLocationStatus('ok');
        } else {
          setLocationStatus('error');
        }
      } catch {
        setLocationStatus('error');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [zip, country]);

  return (
    <div>
      <h2 className="text-xl font-bold text-charcoal mb-1">Cuisine & Fasting</h2>
      <p className="text-sm text-gray-500 mb-6">
        Choose preferred cuisines and any fasting observances your family follows.
      </p>

      {/* Location */}
      <div className="rounded-2xl p-4 mb-5" style={{ background: '#FDF6EC', border: '1.5px solid #F5E9D6' }}>
        <h3 className="font-semibold text-sm text-charcoal mb-3">📍 Your Location</h3>
        <p className="text-xs text-gray-500 mb-3">
          Used to calculate accurate lunar calendar fasting days for your timezone.
        </p>
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">ZIP / PIN Code</label>
            <input
              type="text" placeholder="e.g. 400001 or 10001"
              value={zip}
              onChange={e => onZipChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm border bg-white focus:outline-none"
              style={{ border: '1.5px solid #F5E9D6' }}
            />
          </div>
          <div className="w-28">
            <label className="block text-xs font-medium text-gray-500 mb-1">Country</label>
            <select
              value={country}
              onChange={e => onCountryChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm border bg-white focus:outline-none h-[42px]"
              style={{ border: '1.5px solid #F5E9D6' }}>
              <option value="in">🇮🇳 India</option>
              <option value="us">🇺🇸 USA</option>
              <option value="gb">🇬🇧 UK</option>
              <option value="au">🇦🇺 Australia</option>
              <option value="ca">🇨🇦 Canada</option>
              <option value="sg">🇸🇬 Singapore</option>
              <option value="ae">🇦🇪 UAE</option>
              <option value="nz">🇳🇿 New Zealand</option>
            </select>
          </div>
        </div>
        {locationStatus === 'loading' && <p className="text-xs text-gray-400">🔍 Looking up location…</p>}
        {locationStatus === 'ok' && <p className="text-xs" style={{ color: '#4A7C59' }}>✅ {locationName}</p>}
        {locationStatus === 'error' && <p className="text-xs text-red-400">⚠️ Could not find this zip code. Please check and try again.</p>}
      </div>

      {/* Cuisine selection */}
      <div className="rounded-2xl p-4 mb-5" style={{ background: '#FDF6EC', border: '1.5px solid #F5E9D6' }}>
        <h3 className="font-semibold text-sm text-charcoal mb-3">🍽️ Preferred Cuisines</h3>
        <div className="flex flex-wrap gap-2">
          {CUISINES.map(c => {
            const selected = globalCuisines.includes(c.value);
            return (
              <button key={c.value}
                onClick={() => setGlobalCuisines(toggle(globalCuisines, c.value))}
                className="flex items-center gap-1.5 px-3 py-2 rounded-pill text-xs font-medium transition-all"
                style={{
                  borderRadius: '50px',
                  border: selected ? '1.5px solid #E8793A' : '1.5px solid #F0E8DC',
                  background: selected ? '#FEF0E6' : 'white',
                  color: selected ? '#E8793A' : '#555',
                }}>
                {c.emoji} {c.label}
              </button>
            );
          })}
        </div>
        {globalCuisines.length === 0 && (
          <p className="text-xs text-gray-400 mt-2">Select at least one cuisine for best results.</p>
        )}
      </div>

      {/* Fasting observances */}
      <div className="rounded-2xl p-4" style={{ background: '#F3EAF7', border: '1.5px solid #9B6BB5' }}>
        <h3 className="font-semibold text-sm text-purple-800 mb-1">🙏 Fasting Observances</h3>
        <p className="text-xs text-gray-500 mb-3">
          Select fasting days your family observes. We'll adjust meals accordingly.
        </p>
        <div className="space-y-2">
          {FASTING_TYPES.map(ft => {
            const selected = fastingTypes.includes(ft.value);
            return (
              <button key={ft.value}
                onClick={() => onFastingChange(toggle(fastingTypes, ft.value))}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  border: selected ? '1.5px solid #9B6BB5' : '1.5px solid #DDD0E8',
                  background: selected ? 'rgba(155,107,181,0.1)' : 'white',
                }}>
                <span className="text-base">{ft.emoji}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium" style={{ color: selected ? '#7B3FA0' : '#2C2416' }}>
                    {ft.label}
                  </div>
                  <div className="text-xs text-gray-400">{ft.description}</div>
                </div>
                <div className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                  style={{ borderColor: selected ? '#9B6BB5' : '#ddd', background: selected ? '#9B6BB5' : 'transparent' }}>
                  {selected && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
