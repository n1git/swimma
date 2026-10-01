"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadminAction } from "@/lib/auth/superadmin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { trialEndsAtFromToday } from "@/lib/data/platform-plan";
import {
  tenantSubscriptionSchema,
  organizationLimitSchema,
  ownerActiveSchema,
  activateOrganizationSchema,
  organizationStatusSchema,
  extendTrialSchema,
  clubLimitOverrideSchema,
  planEditSchema,
} from "@/lib/validations/superadmin";
import { getJakartaDateString } from "@/lib/format";
import { type ActionState } from "./types";

export async function updateTenantSubscription(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let superadmin;
  try {
    superadmin = await requireSuperadminAction();
  } catch {
    return { ok: false, error: "Sesi Anda berakhir. Masuk ulang sebagai admin platform." };
  }

  const parsed = tenantSubscriptionSchema.safeParse({
    tenantId: formData.get("tenantId"),
    planId: formData.get("planId"),
    status: formData.get("status"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }
  const { tenantId, planId, status, notes } = parsed.data;

  const supabase = createAdminSupabaseClient();
  const { data: existing } = await supabase
    .from("platform_subscriptions")
    .select("status, trial_ends_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const { error: subscriptionError } = await supabase.from("platform_subscriptions").upsert(
    {
      tenant_id: tenantId,
      plan_id: planId,
      status,
      notes: notes ?? null,
      ...(status === "trial" && !existing?.trial_ends_at ? { trial_ends_at: trialEndsAtFromToday() } : {}),
      ...(status === "active" && existing?.status !== "active"
        ? { activated_at: new Date().toISOString(), activated_by: superadmin.email }
        : {}),
    },
    { onConflict: "tenant_id" }
  );

  if (subscriptionError) {
    return { ok: false, error: "Gagal menyimpan langganan klub" };
  }

  const { error: tenantError } = await supabase
    .from("tenants")
    .update({ is_active: status === "trial" || status === "active" })
    .eq("id", tenantId);

  if (tenantError) {
    return { ok: false, error: "Langganan tersimpan, tetapi status akses klub gagal diperbarui. Simpan ulang." };
  }

  revalidatePath("/superadmin");
  return { ok: true, message: "Langganan klub diperbarui" };
}

export async function updateOrganizationLimit(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireSuperadminAction();
  } catch {
    return { ok: false, error: "Sesi Anda berakhir. Masuk ulang sebagai admin platform." };
  }

  const parsed = organizationLimitSchema.safeParse({
    organizationId: formData.get("organizationId"),
    maxTenants: formData.get("maxTenants"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { error } = await createAdminSupabaseClient()
    .from("organizations")
    .update({ max_tenants: parsed.data.maxTenants })
    .eq("id", parsed.data.organizationId);
  if (error) return { ok: false, error: "Gagal menyimpan batas klub" };

  revalidatePath("/superadmin");
  return { ok: true, message: "Batas klub diperbarui" };
}

export async function toggleOwnerActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireSuperadminAction();
  } catch {
    return { ok: false, error: "Sesi Anda berakhir. Masuk ulang sebagai admin platform." };
  }

  const parsed = ownerActiveSchema.safeParse({
    ownerId: formData.get("ownerId"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { error } = await createAdminSupabaseClient()
    .from("org_owners")
    .update({ is_active: parsed.data.isActive === "true" })
    .eq("id", parsed.data.ownerId);
  if (error) return { ok: false, error: "Gagal memperbarui status pemilik" };

  revalidatePath("/superadmin");
  return { ok: true, message: parsed.data.isActive === "true" ? "Pemilik diaktifkan" : "Pemilik dinonaktifkan" };
}

const SESSION_ENDED: ActionState = { ok: false, error: "Sesi Anda berakhir. Masuk ulang sebagai admin platform." };

async function superadminOrNull() {
  try {
    return await requireSuperadminAction();
  } catch {
    return null;
  }
}

export async function activateOrganization(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const superadmin = await superadminOrNull();
  if (!superadmin) return SESSION_ENDED;

  const parsed = activateOrganizationSchema.safeParse({
    organizationId: formData.get("organizationId"),
    periodStart: formData.get("periodStart") || undefined,
    periodEnd: formData.get("periodEnd") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { error } = await createAdminSupabaseClient().rpc("set_organization_status", {
    p_organization_id: parsed.data.organizationId,
    p_status: "active",
    p_actor: superadmin.email,
    p_period_start: parsed.data.periodStart ?? getJakartaDateString(),
    p_period_end: parsed.data.periodEnd ?? null,
  });
  if (error) return { ok: false, error: "Gagal mengaktifkan langganan" };

  revalidatePath("/superadmin");
  return { ok: true, message: "Langganan diaktifkan" };
}

export async function setOrganizationStatus(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const superadmin = await superadminOrNull();
  if (!superadmin) return SESSION_ENDED;

  const parsed = organizationStatusSchema.safeParse({
    organizationId: formData.get("organizationId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { error } = await createAdminSupabaseClient().rpc("set_organization_status", {
    p_organization_id: parsed.data.organizationId,
    p_status: parsed.data.status,
    p_actor: superadmin.email,
  });
  if (error) return { ok: false, error: "Gagal mengubah status langganan" };

  revalidatePath("/superadmin");
  return { ok: true, message: "Status langganan diperbarui" };
}

export async function extendTrial(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await superadminOrNull())) return SESSION_ENDED;

  const parsed = extendTrialSchema.safeParse({
    organizationId: formData.get("organizationId"),
    trialEndsAt: formData.get("trialEndsAt"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { data, error } = await createAdminSupabaseClient()
    .from("organization_subscriptions")
    .update({ trial_ends_at: parsed.data.trialEndsAt })
    .eq("organization_id", parsed.data.organizationId)
    .eq("status", "trial")
    .select("organization_id");
  if (error || !data?.length) return { ok: false, error: "Gagal memperpanjang trial. Pastikan statusnya Trial." };

  revalidatePath("/superadmin");
  return { ok: true, message: "Masa trial diperbarui" };
}

export async function setClubLimitOverride(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await superadminOrNull())) return SESSION_ENDED;

  const parsed = clubLimitOverrideSchema.safeParse({
    organizationId: formData.get("organizationId"),
    clubLimitOverride: formData.get("clubLimitOverride") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { error } = await createAdminSupabaseClient()
    .from("organization_subscriptions")
    .update({ club_limit_override: parsed.data.clubLimitOverride ?? null })
    .eq("organization_id", parsed.data.organizationId);
  if (error) return { ok: false, error: error.code === "SW004" ? error.message : "Gagal menyimpan batas klub" };

  revalidatePath("/superadmin");
  return { ok: true, message: "Batas klub diperbarui" };
}

export async function updatePlan(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await superadminOrNull())) return SESSION_ENDED;

  const parsed = planEditSchema.safeParse({
    code: formData.get("code"),
    pricePerUserMonth: formData.get("pricePerUserMonth"),
    clubLimit: formData.get("clubLimit") ?? undefined,
    trialDays: formData.get("trialDays"),
    yearlyFreeMonths: formData.get("yearlyFreeMonths"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { error } = await createAdminSupabaseClient()
    .from("subscription_plans")
    .update({
      price_per_user_month: parsed.data.pricePerUserMonth,
      club_limit: parsed.data.clubLimit ?? null,
      trial_days: parsed.data.trialDays,
      yearly_free_months: parsed.data.yearlyFreeMonths,
      is_active: parsed.data.isActive === "true",
    })
    .eq("code", parsed.data.code);
  if (error) return { ok: false, error: "Gagal menyimpan paket" };

  revalidatePath("/superadmin");
  revalidatePath("/");
  return { ok: true, message: "Paket diperbarui" };
}
