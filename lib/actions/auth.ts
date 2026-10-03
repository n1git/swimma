"use server";

import { logAudit } from "@/lib/audit";
import { redirect } from "next/navigation";
import { getSession, createSession } from "@/lib/auth/session";
import { checkSession, sessionEndedPath } from "@/lib/auth/guard";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isKeyRateLimited, RATE_LIMIT_ERROR } from "@/lib/auth/rate-limit";
import { changePasswordSchema } from "@/lib/validations/auth";
import { roleHome } from "@/lib/auth/roles";

export interface ChangePasswordState {
  error?: string;
}

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await getSession();
  if (!session) redirect("/login");
  const check = await checkSession(session);
  if (!check.ok) redirect(sessionEndedPath(check.reason));
  const { ownerId, memberAccountId } = check.profile;

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? undefined,
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Kata sandi tidak valid" };
  }

  const supabase = createAdminSupabaseClient();
  const hashQuery = memberAccountId
    ? supabase.from("member_accounts").select("password_hash").eq("id", memberAccountId)
    : ownerId
      ? supabase.from("org_owners").select("password_hash").eq("id", ownerId)
      : supabase.from("auth_credentials").select("password_hash").eq("profile_id", session.sub);
  const { data: current } = await hashQuery.maybeSingle();
  if (!current?.password_hash) return { error: "Akun tidak ditemukan" };

  if (!check.mustChangePassword) {
    if (await isKeyRateLimited(`change-password:${session.sub}`, 10, 900)) return { error: RATE_LIMIT_ERROR };
    if (!parsed.data.currentPassword || !(await verifyPassword(parsed.data.currentPassword, current.password_hash))) {
      return { error: "Kata sandi saat ini salah" };
    }
  }
  if (await verifyPassword(parsed.data.newPassword, current.password_hash)) {
    return { error: "Kata sandi baru harus berbeda dari kata sandi saat ini" };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  const validAfter = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();

  if (memberAccountId) {
    await supabase
      .from("member_accounts")
      .update({ password_hash: passwordHash, must_change_password: false })
      .eq("id", memberAccountId);
    await supabase.from("profiles").update({ sessions_valid_after: validAfter }).eq("member_account_id", memberAccountId);
  } else if (ownerId) {
    await supabase.from("org_owners").update({ password_hash: passwordHash }).eq("id", ownerId);
    await supabase
      .from("profiles")
      .update({ must_change_password: false, sessions_valid_after: validAfter })
      .eq("owner_id", ownerId);
  } else {
    await supabase.from("auth_credentials").update({ password_hash: passwordHash }).eq("profile_id", session.sub);
    await supabase
      .from("profiles")
      .update({ must_change_password: false, sessions_valid_after: validAfter })
      .eq("id", session.sub);
  }

  await logAudit({
    action: "password.change",
    targetType: "profile",
    targetId: session.sub,
    tenantId: session.tenant_id,
    actorId: session.sub,
    actorRole: session.app_role,
  });

  await createSession({
    id: session.sub,
    email: session.email,
    fullName: session.full_name,
    role: session.app_role,
    tenantId: session.tenant_id,
    orgId: session.org_id,
    clubPending: session.club_pending,
  });

  redirect(roleHome(session.app_role));
}
