import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { trialEndsAtFromToday } from "@/lib/data/platform-plan";
import { registerClubSchema } from "@/lib/validations/onboarding";

const TRIAL_PLAN_NAME = "Trial";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerClubSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
      { status: 400 }
    );
  }
  const { tenantName, tenantSlug, adminFullName, adminEmail, password } = parsed.data;

  const supabase = createAdminSupabaseClient();

  const { data: trialPlan } = await supabase
    .from("platform_plans")
    .select("id")
    .eq("name", TRIAL_PLAN_NAME)
    .eq("is_active", true)
    .maybeSingle();

  if (!trialPlan) {
    return NextResponse.json(
      { error: "Pendaftaran klub sedang ditutup. Coba lagi nanti." },
      { status: 503 }
    );
  }

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({ name: tenantName, slug: tenantSlug })
    .select("id")
    .single();

  if (tenantError || !tenant) {
    if (tenantError?.code === "23505") {
      return NextResponse.json({ error: "Kode klub sudah dipakai. Pilih kode lain." }, { status: 409 });
    }
    return NextResponse.json({ error: "Gagal mendaftarkan klub" }, { status: 500 });
  }

  const rollback = async (profileId?: string) => {
    if (profileId) await supabase.from("profiles").delete().eq("id", profileId);
    await supabase.from("tenants").delete().eq("id", tenant.id);
  };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({ tenant_id: tenant.id, role: "admin", full_name: adminFullName, email: adminEmail })
    .select("id")
    .single();

  if (profileError || !profile) {
    await rollback();
    return NextResponse.json({ error: "Gagal membuat akun admin" }, { status: 500 });
  }

  const { error: credError } = await supabase
    .from("auth_credentials")
    .insert({ profile_id: profile.id, password_hash: await hashPassword(password) });

  if (credError) {
    await rollback(profile.id);
    return NextResponse.json({ error: "Gagal membuat kredensial admin" }, { status: 500 });
  }

  const { error: subscriptionError } = await supabase.from("platform_subscriptions").insert({
    tenant_id: tenant.id,
    plan_id: trialPlan.id,
    status: "trial",
    trial_ends_at: trialEndsAtFromToday(),
  });

  if (subscriptionError) {
    await rollback(profile.id);
    return NextResponse.json({ error: "Gagal memulai masa trial" }, { status: 500 });
  }

  await createSession({
    id: profile.id,
    email: adminEmail,
    fullName: adminFullName,
    role: "admin",
    tenantId: tenant.id,
  });

  return NextResponse.json({ redirectTo: "/admin" });
}
