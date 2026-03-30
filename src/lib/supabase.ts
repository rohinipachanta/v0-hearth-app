// ── Browser client (safe to import in client components) ──
import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SUPABASE_SRK  = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON)
}

export function createAdminClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_SRK)
}
