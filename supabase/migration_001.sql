-- Migration 001: Fix family_members schema to match app
-- Run this in Supabase SQL Editor

-- 1. Add height_cm column
alter table family_members
  add column if not exists height_cm numeric(5,1);

-- 2. Make gender nullable (wizard doesn't collect it)
alter table family_members
  alter column gender drop not null;

-- 3. Expand activity_level to include 'light' and 'very_active'
alter table family_members
  drop constraint if exists family_members_activity_level_check;
alter table family_members
  add constraint family_members_activity_level_check
  check (activity_level in ('sedentary','light','moderate','active','very_active'));

-- 4. Expand dietary_preference to include 'vegan' and 'jain'
alter table family_members
  drop constraint if exists family_members_dietary_preference_check;
alter table family_members
  add constraint family_members_dietary_preference_check
  check (dietary_preference in ('vegetarian','vegan','eggetarian','non_vegetarian','jain'));
