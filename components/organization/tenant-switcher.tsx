"use client";

import { switchTenant } from "@/lib/actions/owner";
import { ActionForm } from "@/components/shared/action-form";
import { Select } from "@/components/ui/select";

export function TenantSwitcher({
  tenants,
  currentId,
}: {
  tenants: { id: string; name: string }[];
  currentId: string;
}) {
  return (
    <ActionForm action={switchTenant}>
      <Select
        name="tenantId"
        aria-label="Pindah klub"
        defaultValue={currentId}
        className="h-8 w-44"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
    </ActionForm>
  );
}
