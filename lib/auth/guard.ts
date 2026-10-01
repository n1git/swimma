import { redirect } from "next/navigation";
import { getSession } from "./session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { roleHome, type AppRole } from "./roles";

export class UnauthorizedError extends Error {}

export async function requireRole(role: AppRole) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.app_role !== role) redirect(roleHome(session.app_role));

  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_active, must_change_password, full_name, sessions_valid_after, owner_id, tenants(is_active)")
    .eq("id", session.sub)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    redirect("/api/auth/session-ended?reason=deactivated");
  }
  if (
    profile.sessions_valid_after &&
    (session.iat ?? 0) < Math.floor(Date.parse(profile.sessions_valid_after) / 1000)
  ) {
    redirect("/api/auth/session-ended?reason=revoked");
  }
  const tenant = profile.tenants as unknown as { is_active: boolean } | null;
  if (!tenant?.is_active) {
    redirect("/api/auth/session-ended?reason=suspended");
  }
  if (profile.owner_id) {
    const { data: owner } = await createAdminSupabaseClient()
      .from("org_owners")
      .select("is_active")
      .eq("id", profile.owner_id)
      .maybeSingle();
    if (!owner?.is_active) redirect("/api/auth/session-ended?reason=deactivated");
  }
  if (profile.must_change_password) {
    redirect("/change-password");
  }

  return {
    id: session.sub,
    email: session.email,
    role: session.app_role,
    tenantId: session.tenant_id,
    orgId: session.org_id,
    fullName: profile.full_name as string,
  };
}

export async function requireActionRole(role: AppRole | AppRole[]) {
  const session = await getSession();
  if (!session) throw new UnauthorizedError("Anda harus login");
  const roles = Array.isArray(role) ? role : [role];
  if (!roles.includes(session.app_role)) {
    throw new UnauthorizedError("Anda tidak memiliki akses untuk aksi ini");
  }
  return session;
}
