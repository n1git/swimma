import { NextResponse } from "next/server";
import { isCrossSite } from "@/lib/auth/request";
import { clearSuperadminSession } from "@/lib/auth/superadmin";

export async function POST(request: Request) {
  if (isCrossSite(request)) return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 403 });
  await clearSuperadminSession();
  return NextResponse.json({ ok: true });
}
