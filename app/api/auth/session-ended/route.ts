import { NextResponse, type NextRequest } from "next/server";
import { clearSession, getSession } from "@/lib/auth/session";
import { checkSession } from "@/lib/auth/guard";
import { roleHome } from "@/lib/auth/roles";

export async function GET(request: NextRequest) {
  const session = await getSession();
  const url = new URL("/login", request.url);
  if (session) {
    const check = await checkSession(session);
    if (check.ok) return NextResponse.redirect(new URL(roleHome(session.app_role), request.url));
    url.searchParams.set(check.reason, "1");
  }
  await clearSession();
  return NextResponse.redirect(url);
}
