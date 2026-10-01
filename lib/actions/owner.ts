"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwnerAction } from "@/lib/auth/owner";
import { createSession } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createTenantSchema } from "@/lib/validations/onboarding";
import { PLAN_LIMIT_CODES, type ActionState } from "./types";

export async function createTenant(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwnerAction();
  const parsed = createTenantSchema.safeParse({ tenantName: formData.get("tenantName") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const { error } = await createAdminSupabaseClient().rpc("create_tenant_for_owner", {
    p_owner_id: owner.ownerId,
    p_tenant_name: parsed.data.tenantName,
  });
  if (error) {
    return { ok: false, error: PLAN_LIMIT_CODES.has(error.code) ? error.message : "Gagal menambah klub" };
  }

  revalidatePath("/admin/klub");
  return { ok: true, message: "Klub berhasil ditambahkan" };
}

export async function switchTenant(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwnerAction();
  const parsed = z.string().uuid().safeParse(formData.get("tenantId"));
  if (!parsed.success) return { ok: false, error: "Klub tidak valid" };

  const { data: target } = await createAdminSupabaseClient()
    .from("profiles")
    .select("id, email, full_name, is_active, tenants(is_active)")
    .eq("owner_id", owner.ownerId)
    .eq("tenant_id", parsed.data)
    .maybeSingle();
  const tenant = target?.tenants as unknown as { is_active: boolean } | null;
  if (!target || !target.is_active || !tenant?.is_active) {
    return { ok: false, error: "Klub tidak ditemukan atau sedang dinonaktifkan" };
  }

  await createSession({
    id: target.id,
    email: target.email,
    fullName: target.full_name,
    role: "admin",
    tenantId: parsed.data,
    orgId: owner.organizationId,
  });

  redirect("/admin");
}
