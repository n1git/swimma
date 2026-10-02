import { z } from "zod";
import { STAFF_ROLES } from "@/lib/auth/roles";

export const staffSchema = z.object({
  fullName: z.string().trim().min(2, "Nama wajib diisi"),
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  phone: z.string().optional(),
  role: z.enum(STAFF_ROLES, { message: "Pilih peran" }),
});
