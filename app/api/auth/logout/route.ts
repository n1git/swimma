import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST() {
  const session = await getSession();
  if (session) {
    const supabase = createAdminSupabaseClient();
    const validAfter = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, owner_id, member_account_id")
      .eq("id", session.sub)
      .maybeSingle();
    if (profile) {
      const update = supabase.from("profiles").update({ sessions_valid_after: validAfter });
      if (profile.owner_id) await update.eq("owner_id", profile.owner_id);
      else if (profile.member_account_id) await update.eq("member_account_id", profile.member_account_id);
      else await update.eq("id", profile.id);
    }
  }
  await clearSession();
  return NextResponse.json({ ok: true });
}
