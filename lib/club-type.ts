import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface ClubType {
  code: string;
  name: string;
}

export interface ClubTerms {
  member: string;
  coach: string;
  visit: string;
  resource: string;
  session: string;
  location: string;
}

const DEFAULT_TERMS: ClubTerms = {
  member: "Anggota",
  coach: "Pelatih",
  visit: "Kunjungan",
  resource: "Fasilitas",
  session: "Sesi",
  location: "Lokasi",
};

export function mergeTerms(raw: unknown): ClubTerms {
  const terms = { ...DEFAULT_TERMS };
  if (raw && typeof raw === "object") {
    for (const key of Object.keys(DEFAULT_TERMS) as (keyof ClubTerms)[]) {
      const value = (raw as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) terms[key] = value;
    }
  }
  return terms;
}

export async function getClubTerms(): Promise<ClubTerms> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("tenants").select("club_types(terms)").maybeSingle();
  const clubType = data?.club_types as unknown as { terms: unknown } | null;
  return mergeTerms(clubType?.terms);
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
