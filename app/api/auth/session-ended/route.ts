import { NextResponse, type NextRequest } from "next/server";
import { clearSession } from "@/lib/auth/session";

const REASONS = new Set(["deactivated", "suspended"]);

export async function GET(request: NextRequest) {
  await clearSession();
  const reason = request.nextUrl.searchParams.get("reason");
  const url = new URL("/login", request.url);
  if (reason && REASONS.has(reason)) url.searchParams.set(reason, "1");
  return NextResponse.redirect(url);
}
