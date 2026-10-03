export const PAYMENT_METHODS = [
  { value: "cash", label: "Tunai" },
  { value: "transfer", label: "Transfer" },
  { value: "qris", label: "QRIS" },
  { value: "other", label: "Lainnya" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export const PAYMENT_METHOD_LABEL: Record<string, string> = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]));

export const ORDER_STATUS_LABEL: Record<string, string> = {
  open: "Belum lunas",
  paid: "Lunas",
  void: "Dibatalkan",
};

export function commerceErrorMessage(error: { code?: string; message?: string }, fallback: string): string {
  if ((error.code?.startsWith("PS") || error.code === "SW003") && error.message) return error.message;
  if (error.code === "42501") return "Anda tidak memiliki akses untuk aksi ini";
  return fallback;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  price: number;
  trackStock: boolean;
  stockQty: number;
  isActive: boolean;
}

export interface OrderRow {
  id: string;
  number: string;
  memberId: string | null;
  memberName: string | null;
  customerName: string | null;
  status: "open" | "paid" | "void";
  total: number;
  paid: number;
  createdAt: string;
  paidAt: string | null;
}

export interface OrderItemRow {
  id: string;
  kind: "product" | "booking";
  description: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderPaymentRow {
  id: string;
  method: string;
  amount: number;
  reference: string | null;
  paidAt: string;
}

export interface OrderDetail extends OrderRow {
  items: OrderItemRow[];
  payments: OrderPaymentRow[];
}

export interface UnpaidBooking {
  id: string;
  memberId: string | null;
  memberName: string | null;
  guestName: string | null;
  resourceName: string;
  startTime: string;
  price: number;
}
