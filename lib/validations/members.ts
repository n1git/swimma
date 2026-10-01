import { z } from "zod";

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

export const memberSchema = z.object({
  fullName: z.string().trim().min(2, "Nama anggota wajib diisi"),
  dateOfBirth: z.string().min(1, "Tanggal lahir wajib diisi"),
  coachId: z.string().uuid("Pilih pelatih"),
  contactName: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
  notes: z.string().optional(),
  address: z.string().optional(),
  preferredLocationId: optionalId,
});
