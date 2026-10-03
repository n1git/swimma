import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getJakartaDayRangeIso } from "@/lib/format";
import type { OrderDetail, OrderRow, Product, UnpaidBooking } from "@/lib/commerce";

type ProductRecord = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  price: number | string;
  track_stock: boolean;
  stock_qty: number;
  is_active: boolean;
};

function toProduct(p: ProductRecord): Product {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    price: Number(p.price),
    trackStock: p.track_stock,
    stockQty: p.stock_qty,
    isActive: p.is_active,
  };
}

export async function getProducts(options: { activeOnly?: boolean } = {}): Promise<Product[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("products").select("id, name, sku, category, price, track_stock, stock_qty, is_active").order("name");
  if (options.activeOnly) query = query.eq("is_active", true);
  const { data } = await query;
  return ((data ?? []) as ProductRecord[]).map(toProduct);
}

type OrderRecord = {
  id: string;
  number: string;
  member_id: string | null;
  customer_name: string | null;
  status: OrderRow["status"];
  total: number | string;
  created_at: string;
  paid_at: string | null;
  order_payments?: { amount: number | string }[];
};

async function memberNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("member_names").select("id, full_name").in("id", ids);
  return new Map((data ?? []).map((m) => [m.id as string, m.full_name as string]));
}

function toOrder(o: OrderRecord, names: Map<string, string>): OrderRow {
  return {
    id: o.id,
    number: o.number,
    memberId: o.member_id,
    memberName: o.member_id ? (names.get(o.member_id) ?? null) : null,
    customerName: o.customer_name,
    status: o.status,
    total: Number(o.total),
    paid: (o.order_payments ?? []).reduce((s, p) => s + Number(p.amount), 0),
    createdAt: o.created_at,
    paidAt: o.paid_at,
  };
}

export async function getOrders(
  filter: { status?: string; fromIso?: string; toIso?: string; from?: number; to?: number } = {}
): Promise<{ rows: OrderRow[]; total: number }> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("orders")
    .select("id, number, member_id, customer_name, status, total, created_at, paid_at, order_payments(amount)", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range(filter.from ?? 0, filter.to ?? 99);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.fromIso) query = query.gte("created_at", filter.fromIso);
  if (filter.toIso) query = query.lt("created_at", filter.toIso);
  const { data, count } = await query;
  const rows = (data ?? []) as unknown as OrderRecord[];
  const names = await memberNames(rows.map((r) => r.member_id).filter((x): x is string => Boolean(x)));
  return { rows: rows.map((r) => toOrder(r, names)), total: count ?? 0 };
}

export async function getOrderDetail(id: string): Promise<OrderDetail | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, number, member_id, customer_name, status, total, created_at, paid_at, order_payments(id, method, amount, reference, paid_at), order_items(id, kind, description, qty, unit_price, line_total)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const rec = data as unknown as OrderRecord & {
    order_payments: { id: string; method: string; amount: number | string; reference: string | null; paid_at: string }[];
    order_items: { id: string; kind: "product" | "booking"; description: string; qty: number; unit_price: number | string; line_total: number | string }[];
  };
  const names = await memberNames(rec.member_id ? [rec.member_id] : []);
  return {
    ...toOrder(rec, names),
    items: rec.order_items.map((i) => ({
      id: i.id,
      kind: i.kind,
      description: i.description,
      qty: i.qty,
      unitPrice: Number(i.unit_price),
      lineTotal: Number(i.line_total),
    })),
    payments: [...rec.order_payments]
      .sort((a, b) => a.paid_at.localeCompare(b.paid_at))
      .map((p) => ({ id: p.id, method: p.method, amount: Number(p.amount), reference: p.reference, paidAt: p.paid_at })),
  };
}

export async function getSalesToday(): Promise<{ count: number; total: number }> {
  const { start, end } = getJakartaDayRangeIso();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("orders").select("total").eq("status", "paid").gte("paid_at", start).lt("paid_at", end);
  return { count: data?.length ?? 0, total: (data ?? []).reduce((s, o) => s + Number(o.total), 0) };
}

export async function getUnpaidBookings(): Promise<UnpaidBooking[]> {
  const supabase = await createServerSupabaseClient();
  const { data: rows } = await supabase
    .from("resource_bookings")
    .select("id, member_id, guest_name, start_time, price, resources(name)")
    .eq("status", "confirmed")
    .is("class_id", null)
    .is("paid_at", null)
    .gt("price", 0)
    .order("start_time", { ascending: false })
    .limit(200);
  const list = (rows ?? []) as unknown as {
    id: string;
    member_id: string | null;
    guest_name: string | null;
    start_time: string;
    price: number | string;
    resources: { name: string } | { name: string }[] | null;
  }[];
  const { data: used } = await supabase
    .from("order_items")
    .select("booking_id, orders!inner(status)")
    .not("booking_id", "is", null)
    .neq("orders.status", "void");
  const taken = new Set((used ?? []).map((u) => u.booking_id as string));
  const names = await memberNames(list.map((b) => b.member_id).filter((x): x is string => Boolean(x)));
  return list
    .filter((b) => !taken.has(b.id))
    .map((b) => {
      const res = Array.isArray(b.resources) ? b.resources[0] : b.resources;
      return {
        id: b.id,
        memberId: b.member_id,
        memberName: b.member_id ? (names.get(b.member_id) ?? null) : null,
        guestName: b.guest_name,
        resourceName: res?.name ?? "",
        startTime: b.start_time,
        price: Number(b.price),
      };
    });
}

export async function getMyOrders(): Promise<OrderDetail[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("orders")
    .select("id, number, member_id, customer_name, status, total, created_at, paid_at, order_items(id, kind, description, qty, unit_price, line_total)")
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as unknown as (OrderRecord & {
    order_items: { id: string; kind: "product" | "booking"; description: string; qty: number; unit_price: number | string; line_total: number | string }[];
  })[];
  return rows.map((r) => ({
    ...toOrder(r, new Map()),
    items: r.order_items.map((i) => ({
      id: i.id,
      kind: i.kind,
      description: i.description,
      qty: i.qty,
      unitPrice: Number(i.unit_price),
      lineTotal: Number(i.line_total),
    })),
    payments: [],
  }));
}
