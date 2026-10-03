import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createSuperadminSession, readSuperadminChallenge } from "@/lib/auth/superadmin";
import { generateRecoveryCodes, hashRecoveryCode, openSecret, sealSecret, verifyTotp } from "@/lib/auth/totp";
import { clientIp, isKeyLocked, recordFailure } from "@/lib/auth/rate-limit";

const FAIL_LIMIT = 5;
const FAIL_WINDOW = 900;
const schema = z.object({
  code: z.string().max(20).optional(),
  recoveryCode: z.string().max(20).optional(),
});
const invalid = () => NextResponse.json({ error: "Kode tidak valid" }, { status: 401 });
const expired = () => NextResponse.json({ error: "Sesi masuk berakhir. Masukkan email dan kata sandi lagi.", restart: true }, { status: 401 });

export async function POST(request: Request) {
  const superadminId = await readSuperadminChallenge();
  if (!superadminId) return expired();

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (!parsed.data.code && !parsed.data.recoveryCode)) return invalid();

  const failKey = `superadmin-mfa:${clientIp(request)}:${superadminId}`;
  if (await isKeyLocked(failKey, FAIL_LIMIT, FAIL_WINDOW)) return invalid();

  const supabase = createAdminSupabaseClient();
  const { data: superadmin } = await supabase
    .from("superadmins")
    .select("id, is_active, totp_secret, totp_pending_secret, totp_enabled_at")
    .eq("id", superadminId)
    .maybeSingle();
  if (!superadmin?.is_active) return expired();

  if (!superadmin.totp_enabled_at) {
    const pending = superadmin.totp_pending_secret ? openSecret(superadmin.totp_pending_secret) : null;
    if (!pending || !parsed.data.code || !verifyTotp(pending, parsed.data.code)) {
      await recordFailure(failKey, FAIL_WINDOW);
      return invalid();
    }
    const codes = generateRecoveryCodes();
    await supabase.from("superadmin_recovery_codes").delete().eq("superadmin_id", superadmin.id);
    await supabase
      .from("superadmin_recovery_codes")
      .insert(codes.map((code) => ({ superadmin_id: superadmin.id, code_hash: hashRecoveryCode(code) })));
    await supabase
      .from("superadmins")
      .update({
        totp_secret: sealSecret(pending),
        totp_pending_secret: null,
        totp_enabled_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      })
      .eq("id", superadmin.id);
    await createSuperadminSession(superadmin.id);
    return NextResponse.json({ redirectTo: "/superadmin", recoveryCodes: codes });
  }

  let ok = false;
  if (parsed.data.code) {
    const secret = superadmin.totp_secret ? openSecret(superadmin.totp_secret) : null;
    ok = Boolean(secret && verifyTotp(secret, parsed.data.code));
  } else if (parsed.data.recoveryCode) {
    const { data: used } = await supabase
      .from("superadmin_recovery_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("superadmin_id", superadmin.id)
      .eq("code_hash", hashRecoveryCode(parsed.data.recoveryCode))
      .is("used_at", null)
      .select("id");
    ok = Boolean(used?.length);
  }
  if (!ok) {
    await recordFailure(failKey, FAIL_WINDOW);
    return invalid();
  }

  await supabase.from("superadmins").update({ last_login_at: new Date().toISOString() }).eq("id", superadmin.id);
  await createSuperadminSession(superadmin.id);
  return NextResponse.json({ redirectTo: "/superadmin" });
}
