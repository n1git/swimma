import { z } from "zod";
import { longText, nameField } from "./limits";

export const packageSchema = z.discriminatedUnion("pricingMode", [
  z.object({
    pricingMode: z.literal("cycle"),
    name: nameField("Nama paket"),
    price: z.coerce.number().nonnegative("Harga tidak valid"),
    billingCycle: z.enum(["monthly", "quarterly", "yearly"]),
    description: longText("Deskripsi").optional(),
  }),
  z.object({
    pricingMode: z.literal("session_pack"),
    name: nameField("Nama paket"),
    price: z.coerce.number().nonnegative("Harga tidak valid"),
    sessionsIncluded: z.coerce.number().int().positive("Jumlah sesi tidak valid"),
    validityWeeks: z.coerce.number().int().positive("Masa berlaku tidak valid"),
    description: longText("Deskripsi").optional(),
  }),
]);

export const subscriptionSchema = z.object({
  memberId: z.string().uuid("Pilih anggota"),
  packageId: z.string().uuid("Pilih paket"),
  startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
});

export const generateInvoicesSchema = z
  .object({
    periodStart: z.string().min(1, "Awal periode wajib diisi"),
    periodEnd: z.string().min(1, "Akhir periode wajib diisi"),
    dueDate: z.string().min(1, "Tanggal jatuh tempo wajib diisi"),
  })
  .refine((v) => v.periodEnd >= v.periodStart, {
    message: "Akhir periode harus setelah awal periode",
    path: ["periodEnd"],
  });
