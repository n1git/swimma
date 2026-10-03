"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionRole } from "@/lib/auth/guard";
import { requireOwnerAction } from "@/lib/auth/owner";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { BILLING_PERIODS, PLAN_CODES } from "@/lib/pricing";
import { internalUserCostChange, type InternalUserCostChange } from "@/lib/data/platform-pricing";
import { logAudit } from "@/lib/audit";
import { PLAN_LIMIT_CODES, type ActionState } from "./types";

const changePlanSchema = z.object({
  planCode: z.enum(PLAN_CODES, { message: "Pilih paket" }),
  billingPeriod: z.enum(BILLING_PERIODS, { message: "Pilih periode" }),
});

export async function changePlan(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwnerAction();
  const parsed = changePlanSchema.safeParse({
    planCode: formData.get("planCode"),
    billingPeriod: formData.get("billingPeriod"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const supabase = createAdminSupabaseClient();
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("code")
    .eq("code", parsed.data.planCode)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan) return { ok: false, error: "Paket tidak tersedia" };

  const { error } = await supabase
    .from("organization_subscriptions")
    .update({ plan_code: parsed.data.planCode, billing_period: parsed.data.billingPeriod })
    .eq("organization_id", owner.organizationId);
  if (error) {
    return { ok: false, error: PLAN_LIMIT_CODES.has(error.code) ? error.message : "Gagal mengubah paket" };
  }

  await logAudit({
    action: "subscription.plan_change",
    targetType: "organization",
    targetId: owner.organizationId,
    details: { plan: parsed.data.planCode, period: parsed.data.billingPeriod },
    tenantId: owner.tenantId,
    organizationId: owner.organizationId,
    actorId: owner.profileId,
    actorRole: "admin",
  });
  revalidatePath("/admin/klub/langganan");
  revalidatePath("/admin/klub");
  return { ok: true, message: "Paket diperbarui. Penagihan dan aktivasi dilakukan oleh admin platform." };
}

export async function previewInternalUserCost(): Promise<InternalUserCostChange | null> {
  const session = await requireActionRole("admin");
  const { data: tenant } = await createAdminSupabaseClient()
    .from("tenants")
    .select("organization_id")
    .eq("id", session.tenant_id)
    .maybeSingle();
  if (!tenant) return null;
  return internalUserCostChange(tenant.organization_id as string);
}
