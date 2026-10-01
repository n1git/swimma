"use server";

import { z } from "zod";
import { requireActionRole } from "@/lib/auth/guard";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";
import { type ActionState } from "./types";

const resetSchema = z.object({ profileId: z.string().uuid("Akun tidak valid") });

export async function resetUserPassword(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireActionRole("admin");
  const parsed = resetSchema.safeParse({ profileId: formData.get("profileId") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const supabase = createAdminSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", parsed.data.profileId)
    .eq("tenant_id", session.tenant_id)
    .eq("role", "coach")
    .maybeSingle();
  if (!profile) return { ok: false, error: "Akun tidak ditemukan" };

  const tempPassword = generateTempPassword();
  const { error: credError } = await supabase
    .from("auth_credentials")
    .upsert({
      profile_id: profile.id,
      password_hash: await hashPassword(tempPassword),
      failed_login_count: 0,
      locked_until: null,
    });
  if (credError) return { ok: false, error: "Gagal mengatur ulang kata sandi" };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ must_change_password: true, sessions_valid_after: new Date().toISOString() })
    .eq("id", profile.id);
  if (profileError) return { ok: false, error: "Gagal mengatur ulang kata sandi" };

  return { ok: true, message: "Kata sandi sementara baru dibuat", tempPassword };
}
