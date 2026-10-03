export const RESOURCE_KINDS = [
  { value: "court", label: "Lapangan" },
  { value: "lane", label: "Lintasan" },
  { value: "studio", label: "Studio" },
  { value: "room", label: "Ruangan" },
  { value: "floor", label: "Area" },
  { value: "other", label: "Lainnya" },
] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number]["value"];

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  confirmed: "Terkonfirmasi",
  cancelled: "Dibatalkan",
  completed: "Selesai",
  no_show: "Tidak hadir",
};

export const WEEKDAY_LABEL = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function bookingErrorMessage(error: { code?: string; message?: string }, fallback: string): string {
  if ((error.code?.startsWith("RB") || error.code === "SW003") && error.message) return error.message;
  if (error.code === "42501") return "Anda tidak memiliki akses untuk aksi ini";
  return fallback;
}

export interface Resource {
  id: string;
  locationId: string;
  locationName: string;
  name: string;
  kind: ResourceKind;
  capacity: number;
  slotMinutes: number;
  pricePerSlot: number;
  advanceDays: number;
  cancelHours: number;
  isActive: boolean;
}

export interface ResourceHour {
  weekday: number;
  opens: string;
  closes: string;
}

export interface BookingRow {
  id: string;
  resourceId: string;
  memberId: string | null;
  memberName: string | null;
  guestName: string | null;
  guestPhone: string | null;
  classId: string | null;
  startTime: string;
  endTime: string;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
  price: number;
  source: "staff" | "member" | "class";
}

export interface AvailabilitySlot {
  start: string;
  end: string;
  remaining: number;
  bookable: boolean;
  mine: boolean;
}
