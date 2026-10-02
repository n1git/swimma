"use client";

import { createCoach } from "@/lib/actions/coaches";
import { AccountForm } from "@/components/shared/account-form";

export function CoachForm() {
  return <AccountForm action={createCoach} noun="pelatih" />;
}
