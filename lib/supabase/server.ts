import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSessionToken } from "@/lib/auth/session";

export function createSupabaseClientWithToken(token: string | null): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    }
  );
}

export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  return createSupabaseClientWithToken(await getSessionToken());
}
