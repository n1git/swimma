import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface ClubType {
  code: string;
  name: string;
}

export interface ClubTerms {
  member: string;
  coach: string;
  visit: string;
}

const DEFAULT_TYPE = "swimming";

const CLUB_TERMS: Record<string, ClubTerms> = {
  swimming: { member: "Anggota", coach: "Pelatih", visit: "Kunjungan" },
  gym: { member: "Member", coach: "Personal Trainer", visit: "Kunjungan" },
};

export function termsFor(clubType: string | null | undefined): ClubTerms {
  return CLUB_TERMS[clubType ?? DEFAULT_TYPE] ?? CLUB_TERMS[DEFAULT_TYPE];
}

export async function getClubTerms(): Promise<ClubTerms> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("tenants").select("club_type").maybeSingle();
  return termsFor(data?.club_type as string | undefined);
}

export async function getReadyClubTypes(): Promise<ClubType[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.from("club_types").select("code, name").eq("status", "ready").order("sort");
    return (data ?? []) as ClubType[];
  } catch {
    return [];
  }
}
