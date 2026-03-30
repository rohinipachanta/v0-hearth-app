// ─────────────────────────────────────────────
// Sattvic — Core TypeScript Types
// ─────────────────────────────────────────────

// ── Enums ────────────────────────────────────

export type Dosha =
  | 'vata' | 'pitta' | 'kapha'
  | 'vata_pitta' | 'pitta_kapha' | 'vata_kapha'

export type ActivityLevel =
  | 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

export type DietaryPreference =
  | 'vegetarian' | 'vegan' | 'eggetarian' | 'non_vegetarian' | 'jain'

export type HealthCondition =
  | 'diabetes' | 'diabetes_type1' | 'diabetes_type2'
  | 'hypertension' | 'high_bp' | 'high_cholesterol'
  | 'pcos' | 'thyroid' | 'hypothyroidism' | 'hyperthyroidism'
  | 'anaemia' | 'ibs' | 'pregnancy' | 'heart_disease' | 'kidney_disease'
  | 'lactose_intolerant' | 'lactose_intolerance'
  | 'gluten_intolerant' | 'gluten_sensitivity'
  | 'nut_allergy' | 'weight_management'

export type HealthGoal =
  | 'weight_loss' | 'weight_gain'
  | 'energy' | 'gut_health' | 'hormonal_balance'
  | 'muscle_gain' | 'diabetes_management' | 'heart_health'

export type Cuisine =
  | 'north_indian' | 'south_indian' | 'gujarati' | 'maharashtrian'
  | 'bengali' | 'rajasthani' | 'kerala' | 'tamil'
  | 'mediterranean' | 'continental' | 'thai' | 'chinese'
  | 'pan_indian' | 'asian'

export type FastingType =
  | 'ekadashi' | 'navratri'
  | 'monday' | 'thursday' | 'saturday'
  | 'pradosh' | 'pradosham'
  | 'amavasya' | 'purnima'
  | 'monday_fast' | 'thursday_fast'

export type FastingStrictness = 'standard' | 'phalahar' | 'dairy_only'

export type AyurvedicSeason =
  | 'vasanta' | 'greeshma' | 'varsha'
  | 'sharad' | 'hemanta' | 'shishira'

export type AyurvedicGuna = 'sattvik' | 'rajasic' | 'tamasic'

// ── Database Entities ─────────────────────────

export interface User {
  id: string
  email: string
  name?: string
  google_id?: string
  created_at: string
  location_zip: string | null
  location_lat: number | null
  location_lng: number | null
  location_city: string | null
  location_country: string | null
  location_timezone: string | null
}

export interface FamilyMember {
  id: string
  user_id: string
  name: string
  date_of_birth: string          // ISO date string
  gender?: 'male' | 'female' | 'other'
  weight_kg: number | null       // used for protein target
  height_cm: number | null
  dosha: Dosha | null
  activity_level: ActivityLevel
  dietary_preference: DietaryPreference
  health_conditions: HealthCondition[]
  health_goals: HealthGoal[]
  cuisine_preferences?: Cuisine[]
  cuisines?: Cuisine[]           // alias used in wizard
  created_at: string
  updated_at?: string
}

export interface FastingPreferences {
  id: string
  user_id: string
  fasting_types: FastingType[]
  strictness_level?: FastingStrictness
}

// ── Nutrition ─────────────────────────────────

export interface Nutrition {
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fibre_g?: number
  fiber_g?: number
  sodium_mg?: number
}

// ── Meal Plan Types ───────────────────────────

export interface Accompaniment {
  name: string
  benefit?: string              // short UI description
  reason?: string               // domain-level reason
  dosha_benefit?: string
  optional?: boolean
}

export interface Meal {
  id?: string
  name: string
  meal_type?: string            // 'breakfast' | 'lunch' | 'dinner' | 'snack'
  date?: string
  cuisine?: Cuisine | string
  description?: string
  is_fasting_friendly?: boolean
  ayurvedic_guna?: AyurvedicGuna
  dosha_effect?: string
  health_notes?: string
  goal_alignment?: HealthGoal[]
  ayurvedic_notes?: string
  ingredients?: string[]
  instructions?: string[]
  accompaniments?: Accompaniment[]
  nutrition?: Nutrition
  // Flat nutrition fields (legacy, Gemini may return either)
  protein_g?: number
  calories?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
  sodium_mg?: number
  // Per-member protein breakdown (optional)
  member_portions?: Record<string, { protein_g: number }>
}

export interface DayMeals {
  breakfast?: Meal
  lunch?: Meal
  dinner?: Meal
  snacks?: Meal[]
}

export interface DayPlan {
  date: string                   // ISO date string
  day?: string                   // "Monday" etc.
  is_fasting?: boolean
  fasting_type?: FastingType
  meals: Meal[]                  // array form (used in UI)
  meals_map?: DayMeals          // object form (legacy)
  daily_totals?: {
    protein_g: number
    calories: number
    carbs_g: number
    fat_g: number
    fiber_g?: number
  }
}

export interface MealPlan {
  id?: string
  user_id?: string
  week_start_date?: string
  generated_at?: string
  days?: DayPlan[]              // UI-facing array form
  fasting_days?: FastingDay[]
  // Nested form (legacy/Supabase storage)
  plan_data?: {
    week?: DayPlan[]
    days?: DayPlan[]
    fasting_days?: FastingDay[]
  }
}

// ── Fasting Day ───────────────────────────────

export interface FastingDay {
  date: string
  fastingType: FastingType      // used in UI components
  type?: FastingType            // legacy alias
  name?: string                 // "Ekadashi", "Navratri Day 3" etc.
  day_number?: number           // for Navratri (1–9)
  allowed_foods?: string[]
  restricted_foods?: string[]
  protein_sources?: string[]
  protein_note?: string
}

// ── Location ──────────────────────────────────

export interface Location {
  zip: string
  lat: number
  lng: number
  city: string
  country: string
  timezone: string
}

// ── Protein Target ────────────────────────────

export interface ProteinTarget {
  member_id: string             // DB field name
  memberId?: string             // UI alias
  member_name: string
  target_g: number              // daily target in grams
  dailyTargetG?: number         // UI alias
  multiplier: number            // g per kg used
  multiplierUsed?: number       // UI alias
  rationale: string             // human-readable reason
  basis?: string                // UI alias
  weight_kg: number | null
}

// ── Wizard State (frontend) ───────────────────

export interface WizardMemberDraft {
  id: string                    // local UUID for keying list
  name: string
  dob: string                   // date string, maps to date_of_birth
  date_of_birth?: string        // alias
  gender?: 'male' | 'female' | 'other'
  weight_kg?: number
  height_cm?: number
  dietary_preference: DietaryPreference
  dosha?: Dosha
  health_conditions: HealthCondition[]
  health_goals: HealthGoal[]
  activity_level: ActivityLevel
  cuisines: Cuisine[]           // shared cuisine preference
}

export interface WizardState {
  step: number
  members: WizardMemberDraft[]
  zip: string
  country: string
  fasting_types: FastingType[]
  // Legacy fields
  cuisine_preferences?: Cuisine[]
  fasting_strictness?: FastingStrictness
  location_zip?: string
  location_country?: string
}
