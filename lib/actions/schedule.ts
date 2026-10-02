"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActionRole } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseJakartaLocalInput } from "@/lib/format";
import { classSchema } from "@/lib/validations/schedule";
import { type ActionState } from "./types";

export async function createClass(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireActionRole("admin");

  const parsed = classSchema.safeParse({
    instructorId: formData.get("instructorId"),
    locationId: formData.get("locationId"),
    classTypeId: formData.get("classTypeId"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    capacity: formData.get("capacity"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }
  const input = parsed.data;
  const startIso = parseJakartaLocalInput(input.startTime);
  const endIso = parseJakartaLocalInput(input.endTime);

  const supabase = await createServerSupabaseClient();

  const { data: overlapping } = await supabase
    .from("classes")
    .select("id")
    .eq("instructor_id", input.instructorId)
    .lt("start_time", endIso)
    .gt("end_time", startIso)
    .limit(1);

  if (overlapping && overlapping.length > 0) {
    return { ok: false, error: "Pelatih sudah memiliki kelas lain pada waktu tersebut" };
  }

  const { error } = await supabase.from("classes").insert({
    instructor_id: input.instructorId,
    location_id: input.locationId,
    class_type_id: input.classTypeId,
    start_time: startIso,
    end_time: endIso,
    capacity: input.capacity,
  });

  if (error) {
    if (error.code === "23P01") {
      return { ok: false, error: "Pelatih sudah memiliki kelas lain pada waktu tersebut" };
    }
    return { ok: false, error: "Gagal menyimpan jadwal" };
  }

  revalidatePath("/admin/schedule");
  return { ok: true };
}

export async function deleteClass(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("admin");
  const classId = String(formData.get("classId"));
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("classes").delete().eq("id", classId).select("id");
  if (error || !data?.length) return { ok: false, error: "Gagal menghapus kelas" };
  revalidatePath("/admin/schedule");
  redirect("/admin/schedule");
}

export async function addBooking(
  classId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireActionRole(["admin", "receptionist"]);
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) {
    return { ok: false, error: "Pilih anggota yang akan didaftarkan" };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("bookings").insert({ member_id: memberId, class_id: classId });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Anggota ini sudah terdaftar di kelas ini" };
    }
    if (error.message?.includes("class is full")) {
      return { ok: false, error: "Kelas sudah penuh" };
    }
    return { ok: false, error: "Gagal menambahkan anggota ke kelas" };
  }

  revalidatePath(`/admin/schedule/${classId}`);
  return { ok: true };
}

export async function removeBooking(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole(["admin", "receptionist"]);
  const bookingId = String(formData.get("bookingId"));
  const classId = String(formData.get("classId"));
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("bookings").delete().eq("id", bookingId).select("id");
  if (error || !data?.length) return { ok: false, error: "Gagal mengeluarkan anggota dari kelas" };
  revalidatePath(`/admin/schedule/${classId}`);
  return { ok: true, message: "Anggota dikeluarkan dari kelas" };
}

const substituteSchema = z.object({
  classId: z.string().uuid("Kelas tidak valid"),
  substituteId: z.union([z.literal(""), z.string().uuid("Pelatih tidak valid")]),
});

export async function setClassSubstitute(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole(["admin", "coach"]);
  const parsed = substituteSchema.safeParse({
    classId: formData.get("classId"),
    substituteId: formData.get("substituteId") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("classes")
    .update({ substitute_id: parsed.data.substituteId || null })
    .eq("id", parsed.data.classId)
    .select("id");
  if (error) {
    if (error.code === "23P01") {
      return { ok: false, error: "Pelatih pengganti sudah mengajar kelas lain pada waktu tersebut" };
    }
    return { ok: false, error: "Gagal menyimpan pelatih pengganti" };
  }
  if (!data?.length) return { ok: false, error: "Anda tidak memiliki akses untuk mengubah kelas ini" };

  revalidatePath("/admin/schedule");
  revalidatePath(`/admin/schedule/${parsed.data.classId}`);
  revalidatePath("/coach", "layout");
  return { ok: true, message: parsed.data.substituteId ? "Pelatih pengganti disimpan" : "Pelatih pengganti dihapus" };
}
