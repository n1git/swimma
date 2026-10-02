import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { APP_ROLES, canAccessPath, roleHome, type AppRole } from "@/lib/auth/roles";

const COOKIE_NAME = "app_session";
const SUPERADMIN_COOKIE_NAME = "superadmin_session";
const SUPERADMIN_AUDIENCE = "swimma-superadmin";
const PROTECTED_PREFIXES = ["/admin", "/coach", "/member", "/change-password"];
const GUEST_ONLY_PREFIXES = ["/login", "/daftar"];

function getSecret() {
  return new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
}

async function readAppRole(request: NextRequest): Promise<AppRole | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const role = payload.app_role as AppRole;
    return APP_ROLES.includes(role) ? role : null;
  } catch {
    return null;
  }
}

async function hasSuperadminSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SUPERADMIN_COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { audience: SUPERADMIN_AUDIENCE });
    return payload.superadmin === true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/superadmin" || pathname.startsWith("/superadmin/")) {
    if (pathname === "/superadmin/login" || (await hasSuperadminSession(request))) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/superadmin/login", request.url));
  }

  const appRole = await readAppRole(request);

  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && !appRole) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (GUEST_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && appRole) {
    return NextResponse.redirect(new URL(roleHome(appRole), request.url));
  }

  if (appRole && !canAccessPath(appRole, pathname)) {
    return NextResponse.redirect(new URL(roleHome(appRole), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
