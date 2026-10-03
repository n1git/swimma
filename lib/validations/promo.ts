import { z } from "zod";
import { longText, nameField } from "./limits";

export const promoSchema = z
  .object({
    title: nameField("Judul"),
    body: longText("Isi").min(2, "Isi wajib diisi"),
    activeFrom: z.string().min(1, "Tanggal mulai wajib diisi"),
    activeUntil: z.string().optional(),
  })
  .refine((v) => !v.activeUntil || v.activeUntil >= v.activeFrom, {
    message: "Tanggal berakhir tidak boleh sebelum tanggal mulai",
    path: ["activeUntil"],
  });
