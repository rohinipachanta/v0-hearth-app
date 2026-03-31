// ─────────────────────────────────────────────
// Shared wizard utilities
// ─────────────────────────────────────────────

import type { WizardMemberDraft } from '@/types'

/**
 * Returns a blank family member draft for use in the setup wizard.
 * Single source of truth — used by both SetupPage and StepFamily.
 */
export function blankMember(): WizardMemberDraft {
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
    if_schedule: undefined,
  }
}
