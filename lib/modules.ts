import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function isModuleReady(code: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc("current_club_has_module", { p_module: code });
  return data === true;
}

export async function requireModule(code: string) {
  if (!(await isModuleReady(code))) notFound();
}

export interface ClubModule {
  code: string;
  name: string;
  description: string | null;
  status: "ready" | "soon";
  inType: boolean;
  override: boolean | null;
  effective: boolean;
}

export async function getClubModules(): Promise<ClubModule[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc("current_club_modules");
  return ((data ?? []) as Record<string, unknown>[]).map((m) => ({
    code: m.code as string,
    name: m.name as string,
    description: (m.description as string | null) ?? null,
    status: m.status as "ready" | "soon",
    inType: Boolean(m.in_type),
    override: (m.override as boolean | null) ?? null,
    effective: Boolean(m.effective),
  }));
}

export async function getEnabledModules(): Promise<Set<string>> {
  return new Set((await getClubModules()).filter((m) => m.effective).map((m) => m.code));
}
