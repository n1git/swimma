import { z } from "zod";
import { RESOURCE_KINDS } from "@/lib/booking";

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Jam tidak valid");

export const resourceSchema = z
  .object({
    locationId: z.string().uuid("Pilih lokasi"),
    name: z.string().trim().min(2, "Nama minimal 2 karakter").max(80, "Nama terlalu panjang"),
    kind: z.enum(RESOURCE_KINDS.map((k) => k.value) as [string, ...string[]]),
    capacity: z.coerce.number().int().min(1, "Kapasitas minimal 1").max(1000, "Kapasitas terlalu besar"),
    slotMinutes: z.coerce.number().int().min(15, "Durasi slot minimal 15 menit").max(480, "Durasi slot maksimal 480 menit"),
    pricePerSlot: z.coerce.number().min(0, "Harga tidak boleh negatif"),
    advanceDays: z.coerce.number().int().min(0, "Tidak valid").max(365, "Maksimal 365 hari"),
    cancelHours: z.coerce.number().int().min(0, "Tidak valid").max(720, "Maksimal 720 jam"),
    opens: time,
    closes: z.string().regex(/^(\d{2}:\d{2}(:\d{2})?)$/, "Jam tidak valid"),
  })
  .refine((v) => v.closes > v.opens, { message: "Jam tutup harus setelah jam buka", path: ["closes"] });

export const hoursSchema = z
  .array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      opens: time,
      closes: time,
    })
  )
  .max(7)
  .refine((rows) => rows.every((r) => r.closes > r.opens), { message: "Jam tutup harus setelah jam buka" })
  .refine((rows) => new Set(rows.map((r) => r.weekday)).size === rows.length, { message: "Hari ganda" });

export const isoSchema = z.string().datetime({ offset: true, message: "Waktu tidak valid" });
