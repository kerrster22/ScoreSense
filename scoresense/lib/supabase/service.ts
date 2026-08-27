import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { supabaseSecretKey, supabaseUrl } from "./env"

/**
 * Service-role Supabase client. Bypasses Row Level Security entirely — it
 * authenticates as the project itself, not as any particular user.
 *
 * Only import this from trusted server-only code that has no user-supplied
 * filtering to get wrong (currently: the Stripe webhook handler, and the
 * checkout-session action's initial customer-id write, both of which run
 * with no user session to scope a normal RLS-respecting client to). Never
 * import from a client component, and never let request input control which
 * row this client touches.
 */
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
