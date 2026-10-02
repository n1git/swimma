import { z } from "zod";

export const coachSchema = z.object({
  fullName: z.string().min(2, "Nama pelatih wajib diisi"),
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  phone: z.string().optional(),
});

export const coachUpdateSchema = z.object({
  fullName: z.string().min(2, "Nama pelatih wajib diisi"),
  phone: z.string().optional(),
  specialization: z.string().trim().max(200, "Spesialisasi terlalu panjang").optional(),
  sessionRate: z.coerce.number().nonnegative("Tarif per sesi tidak valid").optional(),
  isHeadCoach: z.boolean(),
});

export const certificationSchema = z.object({
  coachId: z.string().uuid("Pelatih tidak valid"),
  name: z.string().trim().min(2, "Nama sertifikasi wajib diisi").max(200, "Nama sertifikasi terlalu panjang"),
  number: z.string().trim().max(100, "Nomor sertifikat terlalu panjang").optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid").optional(),
});
