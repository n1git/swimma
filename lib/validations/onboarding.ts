import { z } from "zod";
import { passwordSchema } from "./auth";

const tenantNameSchema = z.string().trim().min(2, "Nama klub minimal 2 karakter").max(100, "Nama klub terlalu panjang");

export const registerClubSchema = z.object({
  tenantName: tenantNameSchema,
  ownerFullName: z.string().trim().min(2, "Nama Anda minimal 2 karakter").max(100, "Nama terlalu panjang"),
  ownerEmail: z.string().trim().toLowerCase().email("Email tidak valid").max(254, "Email terlalu panjang"),
  password: passwordSchema,
});

export const createTenantSchema = z.object({ tenantName: tenantNameSchema });
