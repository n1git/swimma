import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkSession } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildMemberExport, jsonDownload } from "@/lib/data/member-export";

export async function GET() {
  const session = await getSession();
  if (!session || session.app_role !== "member" || session.club_pending) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }
  const check = await checkSession(session);
  if (!check.ok || check.mustChangePassword) return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });

  const supabase = await createServerSupabaseClient();
  const { data: memberId } = await supabase.rpc("current_member_id");
  if (!memberId) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
  const data = await buildMemberExport(supabase, memberId as string);
  if (!data) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
  return jsonDownload(data, "data-saya.json");
}
