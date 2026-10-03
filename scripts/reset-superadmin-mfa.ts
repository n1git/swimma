import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run superadmin:reset-mfa -- <email>");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: superadmin } = await supabase.from("superadmins").select("id").eq("email", email).maybeSingle();
  if (!superadmin) {
    console.error(`No superadmin with email ${email}.`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  const results = await Promise.all([
    supabase
      .from("superadmins")
      .update({ totp_secret: null, totp_pending_secret: null, totp_enabled_at: null })
      .eq("id", superadmin.id),
    supabase.from("superadmin_recovery_codes").delete().eq("superadmin_id", superadmin.id),
    supabase.from("superadmin_sessions").update({ revoked_at: now }).eq("superadmin_id", superadmin.id).is("revoked_at", null),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error(failed.error.message);
    process.exit(1);
  }
  console.log(`MFA reset for ${email}. All sessions revoked; enrolment is required at the next login.`);
}

main();
