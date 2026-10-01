"use client";

import { useActionState, useRef, useState } from "react";
import { createCoach } from "@/lib/actions/coaches";
import { previewInternalUserCost } from "@/lib/actions/subscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useActionToast } from "@/components/shared/use-action-toast";
import { TempPasswordNotice } from "@/components/shared/temp-password-notice";
import { formatRupiah, PERIOD_LABEL } from "@/lib/pricing";
import type { InternalUserCostChange } from "@/lib/data/platform-pricing";

export function CoachForm() {
  const [state, formAction, pending] = useActionState(createCoach, {});
  useActionToast(state, "Pelatih berhasil ditambahkan");
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const [change, setChange] = useState<InternalUserCostChange | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (confirmed.current) {
      confirmed.current = false;
      return;
    }
    event.preventDefault();
    setChecking(true);
    const preview = await previewInternalUserCost();
    setChecking(false);
    if (!preview) {
      confirmed.current = true;
      formRef.current?.requestSubmit();
      return;
    }
    setChange(preview);
  }

  function confirm() {
    setChange(null);
    confirmed.current = true;
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <TempPasswordNotice password={state.tempPassword} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName">Nama Pelatih</Label>
        <Input id="fullName" name="fullName" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Telepon</Label>
        <Input id="phone" name="phone" />
      </div>
      {change ? (
        <Alert variant="warning">
          <AlertTitle>Biaya langganan akan naik</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>
              Menambah pelatih menambah satu pengguna internal ({change.usersBefore} → {change.usersAfter}). Paket{" "}
              {change.planName} ({PERIOD_LABEL[change.period]}): {formatRupiah(change.perMonthBefore)}/bulan menjadi{" "}
              {formatRupiah(change.perMonthAfter)}/bulan, naik {formatRupiah(change.perMonthAfter - change.perMonthBefore)}/bulan.
            </span>
            <span className="flex gap-2">
              <Button type="button" size="sm" onClick={confirm}>
                Ya, tambahkan
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setChange(null)}>
                Batal
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : (
        <Button type="submit" disabled={pending || checking} className="w-fit">
          {pending || checking ? "Memproses..." : "Tambah Pelatih"}
        </Button>
      )}
    </form>
  );
}
