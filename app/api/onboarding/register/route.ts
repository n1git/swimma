import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { OWNER_HOME } from "@/lib/auth/roles";
import { serverQuote } from "@/lib/data/platform-pricing";
import { registerClubSchema } from "@/lib/validations/onboarding";
import { isRateLimited, RATE_LIMIT_ERROR } from "@/lib/auth/rate-limit";

export async function POST(request: Request) {
  if (await isRateLimited(request, "register", 5, 3600)) {
    return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = registerClubSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 }
    );
  }
  const { tenantName, ownerFullName, ownerEmail, password, planCode, billingPeriod, estimatedUsers } = parsed.data;

  const quote = await serverQuote(planCode, billingPeriod, estimatedUsers);
  if (!quote) {
    return NextResponse.json({ error: "Paket tidak tersedia" }, { status: 400 });
  }

  const { data, error } = await createAdminSupabaseClient().rpc("register_organization", {
    p_organization_name: tenantName,
    p_tenant_name: tenantName,
    p_owner_name: ownerFullName,
    p_owner_email: ownerEmail,
    p_password_hash: await hashPassword(password),
    p_plan: planCode,
    p_period: billingPeriod,
  });

  const created = (data as { organization_id: string; tenant_id: string; profile_id: string }[] | null)?.[0];
  if (error || !created) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Email sudah terdaftar. Masuk dengan email tersebut." }, { status: 409 });
    }
    if (error?.message.includes("plan not available")) {
      return NextResponse.json({ error: "Paket tidak tersedia" }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal mendaftarkan klub" }, { status: 500 });
  }

  await createSession({
    id: created.profile_id,
    email: ownerEmail,
    fullName: ownerFullName,
    role: "admin",
    tenantId: created.tenant_id,
    orgId: created.organization_id,
  });

  return NextResponse.json({ redirectTo: OWNER_HOME, quote });
}
