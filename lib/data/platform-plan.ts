import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getJakartaDateString } from "@/lib/format";
import { TRIAL_DAYS } from "@/lib/config";
import type { PlatformSubscriptionStatus } from "@/lib/validations/superadmin";

export interface PlatformPlan {
  id: string;
  name: string;
  price: number;
  billingCycle: "monthly" | "yearly";
  memberLimit: number | null;
  locationLimit: number | null;
}

export interface OwnSubscription {
  status: PlatformSubscriptionStatus;
  trialEndsAt: string | null;
  plan: PlatformPlan | null;
}

interface PlanRow {
  id: string;
  name: string;
  price: number | string;
  billing_cycle: "monthly" | "yearly";
  member_limit: number | null;
  location_limit: number | null;
}

const PLAN_COLUMNS = "id, name, price, billing_cycle, member_limit, location_limit";

function toPlan(row: PlanRow): PlatformPlan {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    billingCycle: row.billing_cycle,
    memberLimit: row.member_limit,
    locationLimit: row.location_limit,
  };
}

export function trialEndsAtFromToday(): string {
  return getJakartaDateString(new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000));
}

const DEFAULT_PLANS: PlatformPlan[] = [
  { id: "default-trial", name: "Trial", price: 0, billingCycle: "monthly", memberLimit: 20, locationLimit: 1 },
  { id: "default-starter", name: "Starter", price: 300000, billingCycle: "monthly", memberLimit: 75, locationLimit: 1 },
  { id: "default-growth", name: "Growth", price: 750000, billingCycle: "monthly", memberLimit: 250, locationLimit: 3 },
  { id: "default-pro", name: "Pro", price: 1500000, billingCycle: "monthly", memberLimit: null, locationLimit: null },
];

export async function getActivePlans(): Promise<PlatformPlan[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("platform_plans")
      .select(PLAN_COLUMNS)
      .eq("is_active", true)
      .order("price");
    return data?.length ? (data as PlanRow[]).map(toPlan) : DEFAULT_PLANS;
  } catch {
    return DEFAULT_PLANS;
  }
}

export async function getOwnSubscription(): Promise<OwnSubscription | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("platform_subscriptions")
    .select(`status, trial_ends_at, platform_plans(${PLAN_COLUMNS})`)
    .maybeSingle();
  if (!data) return null;
  const plan = data.platform_plans as unknown as PlanRow | null;
  return {
    status: data.status as PlatformSubscriptionStatus,
    trialEndsAt: data.trial_ends_at,
    plan: plan ? toPlan(plan) : null,
  };
}
