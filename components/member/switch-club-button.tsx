"use client";

import { switchClub } from "@/lib/actions/member";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";

export function SwitchClubButton({ tenantId }: { tenantId: string }) {
  return (
    <ActionForm action={switchClub}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <ActionSubmitButton size="sm">Buka</ActionSubmitButton>
    </ActionForm>
  );
}
