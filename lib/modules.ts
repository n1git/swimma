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
