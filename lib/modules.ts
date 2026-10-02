import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function isModuleReady(code: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("platform_modules").select("status").eq("code", code).maybeSingle();
  return data?.status === "ready";
}

export async function requireModule(code: string) {
  if (!(await isModuleReady(code))) notFound();
}
