import { getJakartaDateString } from "@/lib/format";

export type CertificationStatus = "valid" | "expiring" | "expired";

const EXPIRY_WARNING_DAYS = 30;

export function certificationWarningDate(today: string = getJakartaDateString()): string {
  const ms = Date.parse(`${today}T00:00:00Z`) + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function certificationStatus(validUntil: string | null, today: string = getJakartaDateString()): CertificationStatus {
  if (!validUntil) return "valid";
  if (validUntil < today) return "expired";
  return validUntil <= certificationWarningDate(today) ? "expiring" : "valid";
}
