"use client";

import { useActionState } from "react";
import { resetUserPassword } from "@/lib/actions/accounts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { TempPasswordNotice } from "@/components/shared/temp-password-notice";

export function ResetPasswordForm({ profileId, label }: { profileId: string; label: string }) {
  const [state, formAction, pending] = useActionState(resetUserPassword, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="profileId" value={profileId} />
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <TempPasswordNotice password={state.tempPassword} />
      <ActionSubmitButton
        variant="outline"
        className="w-fit"
        disabled={pending}
        confirmMessage={`Atur ulang kata sandi ${label}? Kata sandi lama langsung tidak berlaku dan semua sesinya keluar.`}
      >
        {pending ? "Memproses..." : `Atur ulang kata sandi ${label}`}
      </ActionSubmitButton>
    </form>
  );
}
