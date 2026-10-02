import type { BookingRow, Resource, ResourceHour } from "@/lib/booking";

export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

export function addDays(dateStr: string, days: number): string {
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export function mondayOf(dateStr: string): string {
  const wd = weekdayOf(dateStr);
  return addDays(dateStr, wd === 0 ? -6 : 1 - wd);
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function iso(dateStr: string, minutes: number): string {
  if (minutes >= 1440) return `${addDays(dateStr, 1)}T${String(Math.floor((minutes - 1440) / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00+07:00`;
  return `${dateStr}T${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00+07:00`;
}

export interface GridBooking {
  id: string;
  label: string;
  status: BookingRow["status"];
  source: BookingRow["source"];
  price: number;
  phone: string | null;
}

export interface GridCell {
  start: string;
  end: string;
  startLabel: string;
  endLabel: string;
  bookings: GridBooking[];
}

export interface GridColumn {
  key: string;
  title: string;
  subtitle: string;
  resource: Resource;
  cells: GridCell[];
}

function label(b: BookingRow): string {
  if (b.source === "class") return "Kelas";
  return b.memberName ?? b.guestName ?? "Tamu";
}

export function buildCells(dateStr: string, resource: Resource, hours: ResourceHour[], bookings: BookingRow[]): GridCell[] {
  const h = hours.find((x) => x.weekday === weekdayOf(dateStr));
  if (!h) return [];
  const opens = toMinutes(h.opens);
  const closes = toMinutes(h.closes);
  const cells: GridCell[] = [];
  for (let m = opens; m + resource.slotMinutes <= closes; m += resource.slotMinutes) {
    const start = iso(dateStr, m);
    const end = iso(dateStr, m + resource.slotMinutes);
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const inside = bookings
      .filter((b) => b.resourceId === resource.id && new Date(b.startTime).getTime() < e && new Date(b.endTime).getTime() > s)
      .map((b) => ({ id: b.id, label: label(b), status: b.status, source: b.source, price: b.price, phone: b.guestPhone }));
    cells.push({
      start,
      end,
      startLabel: `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
      endLabel: `${String(Math.floor((m + resource.slotMinutes) / 60) % 24).padStart(2, "0")}:${String((m + resource.slotMinutes) % 60).padStart(2, "0")}`,
      bookings: inside,
    });
  }
  return cells;
}
