"use client";

import { createStaff } from "@/lib/actions/staff";
import { ROLE_LABEL, STAFF_ROLES } from "@/lib/auth/roles";
import { AccountForm } from "@/components/shared/account-form";

const ROLE_OPTIONS = STAFF_ROLES.map((role) => ({ value: role, label: ROLE_LABEL[role] }));

export function StaffForm() {
  return <AccountForm action={createStaff} noun="staf" roleOptions={ROLE_OPTIONS} />;
}
