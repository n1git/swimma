"use server";

import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { memberSchema } from "@/lib/validations/members";
import { PLAN_LIMIT_CODES, type ActionState } from "./types";

export interface DuplicateMemberMatch {
  id: string;
  full_name: string;
  date_of_birth: string;
  contact_name: string | null;
  similarity: number;
}

export async function searchDuplicateMembers(
  fullName: string,
  dateOfBirth: string
): Promise<DuplicateMemberMatch[]> {
  await requireActionRole("admin");
  if (!fullName.trim()) return [];
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("search_similar_members", {
    p_full_name: fullName,
    p_date_of_birth: dateOfBirth || null,
  });
  if (error || !data) return [];
  return data as DuplicateMemberMatch[];
}

function parseMember(formData: FormData) {
  return memberSchema.safeParse({
    fullName: formData.get("fullName"),
    dateOfBirth: formData.get("dateOfBirth"),
    coachId: formData.get("coachId"),
    contactName: formData.get("contactName") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
    notes: formData.get("notes") || undefined,
    address: formData.get("address") || undefined,
    preferredLocationId: formData.get("preferredLocationId") || undefined,
  });
}

function memberColumns(input: NonNullable<ReturnType<typeof parseMember>["data"]>) {
  return {
    full_name: input.fullName,
    date_of_birth: input.dateOfBirth,
    coach_id: input.coachId,
    contact_name: input.contactName || null,
    contact_phone: input.contactPhone || null,
    notes: input.notes ?? null,
    address: input.address ?? null,
    preferred_location_id: input.preferredLocationId ?? null,
  };
}

export async function createMember(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("admin");

  const parsed = parseMember(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("members").insert(memberColumns(parsed.data));

  if (error) {
    return {
      ok: false,
      error: PLAN_LIMIT_CODES.has(error.code) ? error.message : "Gagal menyimpan data anggota",
    };
  }

  revalidatePath("/admin/members");
  return { ok: true, message: "Anggota berhasil ditambahkan" };
}

export async function updateMember(
  memberId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireActionRole("admin");

  const parsed = parseMember(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("members").update(memberColumns(parsed.data)).eq("id", memberId);

  if (error) {
    return { ok: false, error: "Gagal memperbarui data anggota" };
  }

  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${memberId}`);
  return { ok: true };
}

export async function toggleMemberActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("admin");
  const memberId = String(formData.get("memberId"));
  const isActive = formData.get("isActive") === "true";

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("members").update({ is_active: isActive }).eq("id", memberId);
  if (error) {
    return {
      ok: false,
      error: PLAN_LIMIT_CODES.has(error.code) ? error.message : "Gagal memperbarui status anggota",
    };
  }

  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${memberId}`);
  return { ok: true, message: isActive ? "Anggota diaktifkan kembali" : "Anggota dinonaktifkan" };
}
