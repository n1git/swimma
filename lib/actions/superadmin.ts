"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadminAction } from "@/lib/auth/superadmin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { trialEndsAtFromToday } from "@/lib/data/platform-plan";
import { tenantSubscriptionSchema } from "@/lib/validations/superadmin";
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
