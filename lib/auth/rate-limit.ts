import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const RATE_LIMIT_ERROR = "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.";

export function clientIp(request: Request): string {
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function isKeyRateLimited(
  key: string,
  limit: number,
  windowSeconds: number,
  failClosed = false
): Promise<boolean> {
  const { data, error } = await createAdminSupabaseClient().rpc("hit_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) return failClosed;
  return data === false;
}

export function isRateLimited(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
  failClosed = false
): Promise<boolean> {
  return isKeyRateLimited(`${scope}:${clientIp(request)}`, limit, windowSeconds, failClosed);
}

export async function isKeyLocked(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createAdminSupabaseClient().rpc("rate_limit_exceeded", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  return Boolean(error) || data === true;
}

export async function recordFailure(key: string, windowSeconds: number): Promise<void> {
  await createAdminSupabaseClient().rpc("hit_rate_limit", {
    p_key: key,
    p_limit: 1_000_000,
    p_window_seconds: windowSeconds,
  });
}
