import { z } from "zod";
import { birthDateField, longText, nameField, phoneField } from "./limits";

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

export const memberSchema = z.object({
  fullName: nameField("Nama anggota"),
  dateOfBirth: birthDateField,
  coachId: z.string().uuid("Pilih pelatih"),
  contactName: z.string().trim().max(200, "Nama kontak maksimal 200 karakter").optional(),
  contactPhone: phoneField.optional(),
  notes: longText("Catatan").optional(),
  address: longText("Alamat").optional(),
  preferredLocationId: optionalId,
});
