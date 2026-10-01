"use client";

import { switchTenant } from "@/lib/actions/owner";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";

export function SwitchTenantButton({ tenantId }: { tenantId: string }) {
  return (
    <ActionForm action={switchTenant}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <ActionSubmitButton size="sm" variant="outline">
        Buka
      </ActionSubmitButton>
    </ActionForm>
  );
}
