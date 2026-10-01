import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { roleHome, OWNER_HOME, type AppRole } from "@/lib/auth/roles";
import { loginSchema } from "@/lib/validations/auth";
import { isRateLimited, RATE_LIMIT_ERROR } from "@/lib/auth/rate-limit";
import { APP_NAME } from "@/lib/config";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;
const GENERIC_ERROR = "Email atau kata sandi salah";
const DEACTIVATED_ERROR = `Akses klub Anda sedang dinonaktifkan. Data klub tetap tersimpan. Hubungi admin platform ${APP_NAME} untuk mengaktifkannya kembali.`;

interface LoginAccount {
  table: "org_owners" | "auth_credentials";
  key: "id" | "profile_id";
  id: string;
  passwordHash: string;
  failedCount: number;
  lockedUntil: string | null;
}

interface SessionTarget {
  profileId: string;
  email: string;
  fullName: string;
  role: AppRole;
  tenantId: string;
  orgId: string;
  redirectTo: string;
}

type TenantJoin = { is_active: boolean; organization_id: string; created_at: string } | null;

export async function POST(request: Request) {
  if (await isRateLimited(request, "login", 20, 600)) {
    return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const supabase = createAdminSupabaseClient();

  let account: LoginAccount | null = null;
  let resolveTarget: () => Promise<SessionTarget | "deactivated">;

  const { data: owner } = await supabase
    .from("org_owners")
    .select("id, organization_id, is_active, password_hash, failed_login_count, locked_until")
    .eq("email", email)
    .maybeSingle();

  if (owner) {
    if (!owner.is_active) return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    account = {
      table: "org_owners",
      key: "id",
      id: owner.id,
      passwordHash: owner.password_hash,
      failedCount: owner.failed_login_count,
      lockedUntil: owner.locked_until,
    };
    resolveTarget = async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, tenant_id, tenants(is_active, organization_id, created_at)")
        .eq("owner_id", owner.id)
        .eq("is_active", true);
      const rows = (profiles ?? [])
        .map((p) => ({ ...p, tenant: p.tenants as unknown as TenantJoin }))
        .filter((p) => p.tenant?.is_active)
        .sort((a, b) => a.tenant!.created_at.localeCompare(b.tenant!.created_at));
      const profile = rows[0];
      if (!profile) return "deactivated";
      return {
        profileId: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: "admin",
        tenantId: profile.tenant_id,
        orgId: owner.organization_id,
        redirectTo: OWNER_HOME,
      };
    };
  } else {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, email, full_name, is_active, tenant_id, tenants(is_active, organization_id, created_at)")
      .eq("email", email)
      .is("owner_id", null)
      .maybeSingle();

    if (!profile || !profile.is_active) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const { data: credentials } = await supabase
      .from("auth_credentials")
      .select("password_hash, failed_login_count, locked_until")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (!credentials) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }
    account = {
      table: "auth_credentials",
      key: "profile_id",
      id: profile.id,
      passwordHash: credentials.password_hash,
      failedCount: credentials.failed_login_count,
      lockedUntil: credentials.locked_until,
    };
    resolveTarget = async () => {
      const tenant = profile.tenants as unknown as TenantJoin;
      if (!tenant?.is_active) return "deactivated";
      return {
        profileId: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role as AppRole,
        tenantId: profile.tenant_id,
        orgId: tenant.organization_id,
        redirectTo: roleHome(profile.role as AppRole),
      };
    };
  }

  if (account.lockedUntil && new Date(account.lockedUntil) > new Date()) {
    return NextResponse.json(
      { error: "Akun terkunci sementara karena terlalu banyak percobaan. Coba lagi nanti." },
      { status: 423 }
    );
  }

  const valid = await verifyPassword(password, account.passwordHash);
  if (!valid) {
    const nextCount = account.failedCount + 1;
    await supabase
      .from(account.table)
      .update({
        failed_login_count: nextCount,
        locked_until:
          nextCount >= LOCKOUT_THRESHOLD
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
            : null,
      })
      .eq(account.key, account.id);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const target = await resolveTarget();
  if (target === "deactivated") {
    return NextResponse.json({ error: DEACTIVATED_ERROR }, { status: 403 });
  }

  await supabase
    .from(account.table)
    .update({
      failed_login_count: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
    })
    .eq(account.key, account.id);

  await createSession({
    id: target.profileId,
    email: target.email,
    fullName: target.fullName,
    role: target.role,
    tenantId: target.tenantId,
    orgId: target.orgId,
  });

  return NextResponse.json({ redirectTo: target.redirectTo });
}
