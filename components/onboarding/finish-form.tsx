"use client";

import { completeOnboarding } from "@/lib/actions/onboarding";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";

export function FinishForm() {
  return (
    <ActionForm action={completeOnboarding}>
      <ActionSubmitButton>Selesai, buka dasbor</ActionSubmitButton>
    </ActionForm>
  );
}
