import { z } from "zod";
import { passwordSchema } from "./auth";

export const registerClubSchema = z.object({
  tenantName: z.string().trim().min(2, "Nama klub minimal 2 karakter").max(100, "Nama klub terlalu panjang"),
  tenantSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Kode klub minimal 3 karakter")
    .max(40, "Kode klub maksimal 40 karakter")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Kode klub hanya boleh huruf kecil, angka, dan tanda hubung di tengah"),
  adminFullName: z.string().trim().min(2, "Nama Anda minimal 2 karakter").max(100, "Nama terlalu panjang"),
  adminEmail: z.string().trim().email("Email tidak valid").max(254, "Email terlalu panjang"),
  password: passwordSchema,
});
