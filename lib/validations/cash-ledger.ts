import { z } from "zod";

export const manualAdjustmentSchema = z.object({
  direction: z.enum(["in", "out"]),
  amount: z.coerce.number().positive("Jumlah harus lebih dari 0"),
  reason: z.string().trim().min(3, "Alasan wajib diisi").max(2000, "Alasan maksimal 2.000 karakter"),
});
