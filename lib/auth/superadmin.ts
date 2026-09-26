import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface SuperadminSessionClaims {
  sub: string;
  superadmin: true;
  email: string;
  full_name: string;
}

export const SUPERADMIN_COOKIE_NAME = "superadmin_session";
export const SUPERADMIN_AUDIENCE = "swimma-superadmin";
const SESSION_DURATION = "7d";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error("SUPABASE_JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function verifySuperadminToken(token: string): Promise<SuperadminSessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { audience: SUPERADMIN_AUDIENCE });
    if (payload.superadmin !== true || typeof payload.sub !== "string") return null;
    return payload as unknown as SuperadminSessionClaims;
  } catch {
    return null;
  }
}

export async function createSuperadminSession(user: { id: string; email: string; fullName: string }) {
  const token = await new SignJWT({ superadmin: true, email: user.email, full_name: user.fullName })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setAudience(SUPERADMIN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SUPERADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSuperadminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SUPERADMIN_COOKIE_NAME);
}

export async function getSuperadminSession(): Promise<SuperadminSessionClaims | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SUPERADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySuperadminToken(token);
}

async function loadActiveSuperadmin() {
  const session = await getSuperadminSession();
  if (!session) return null;

  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("superadmins")
    .select("id, email, full_name, is_active")
    .eq("id", session.sub)
    .maybeSingle();

  if (!data || !data.is_active) return null;
  return { id: data.id as string, email: data.email as string, fullName: data.full_name as string };
}

export async function requireSuperadmin() {
  const superadmin = await loadActiveSuperadmin();
  if (!superadmin) redirect("/superadmin/login");
  return superadmin;
}

export async function requireSuperadminAction() {
  const superadmin = await loadActiveSuperadmin();
  if (!superadmin) throw new Error("Sesi admin platform tidak valid");
  return superadmin;
}
