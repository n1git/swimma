import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const RATE_LIMIT_ERROR = "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.";

function clientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function isRateLimited(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const { data, error } = await createAdminSupabaseClient().rpc("hit_rate_limit", {
    p_key: `${scope}:${clientIp(request)}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  return !error && data === false;
}
