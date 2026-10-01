import { z } from "zod";

export const PLATFORM_SUBSCRIPTION_STATUSES = ["trial", "active", "suspended", "cancelled"] as const;

export type PlatformSubscriptionStatus = (typeof PLATFORM_SUBSCRIPTION_STATUSES)[number];

export const tenantSubscriptionSchema = z.object({
  tenantId: z.string().uuid("Klub tidak valid"),
  planId: z.string().uuid("Pilih paket"),
  status: z.enum(PLATFORM_SUBSCRIPTION_STATUSES),
  notes: z.string().trim().max(500, "Catatan maksimal 500 karakter").optional(),
});

export const STATUS_LABEL: Record<PlatformSubscriptionStatus, string> = {
  trial: "Trial",
  active: "Aktif",
  suspended: "Ditangguhkan",
  cancelled: "Dibatalkan",
};

export const organizationLimitSchema = z.object({
  organizationId: z.string().uuid("Organisasi tidak valid"),
  maxTenants: z.coerce.number().int("Batas klub tidak valid").min(1, "Batas klub minimal 1").max(1000, "Batas klub terlalu besar"),
});

export const ownerActiveSchema = z.object({
  ownerId: z.string().uuid("Pemilik tidak valid"),
  isActive: z.enum(["true", "false"]),
});
