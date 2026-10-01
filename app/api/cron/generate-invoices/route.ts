import { NextResponse } from "next/server";
import { getJakartaMonthBounds } from "@/lib/format";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { start: periodStart, end: periodEnd } = getJakartaMonthBounds();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("generate_invoices_for_period", {
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_due_date: periodEnd,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ generated: (data as unknown[])?.length ?? 0 });
}
