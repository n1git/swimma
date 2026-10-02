"use client";

import { useActionState } from "react";
import { updateCoach, toggleCoachActive } from "@/lib/actions/coaches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActionToast } from "@/components/shared/use-action-toast";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { ResetPasswordForm } from "@/components/shared/reset-password-form";
import { ActionForm } from "@/components/shared/action-form";

export interface CoachDetail {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  specialization: string | null;
  session_rate: number | string | null;
  is_head_coach: boolean;
}

export function CoachEditForm({ coach }: { coach: CoachDetail }) {
  const updateCoachWithId = updateCoach.bind(null, coach.id);
  const [state, formAction, pending] = useActionState(updateCoachWithId, {});
  useActionToast(state, "Perubahan disimpan");

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Nama Pelatih</Label>
          <Input id="fullName" name="fullName" defaultValue={coach.full_name} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Telepon</Label>
          <Input id="phone" name="phone" defaultValue={coach.phone ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="specialization">Spesialisasi</Label>
          <Input id="specialization" name="specialization" defaultValue={coach.specialization ?? ""} placeholder="mis. Renang anak, gaya bebas" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sessionRate">Tarif per Sesi (Rp)</Label>
          <Input
            id="sessionRate"
            name="sessionRate"
            type="number"
            min={0}
            step={1000}
            defaultValue={coach.session_rate === null ? "" : Number(coach.session_rate)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isHeadCoach" defaultChecked={coach.is_head_coach} className="size-4" />
          Kepala pelatih (melihat semua anggota dan kelas, menetapkan pelatih pengganti)
        </label>
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </form>

      <ResetPasswordForm profileId={coach.id} label="pelatih" />

      <ActionForm action={toggleCoachActive}>
        <input type="hidden" name="coachId" value={coach.id} />
        <input type="hidden" name="isActive" value={(!coach.is_active).toString()} />
        <ActionSubmitButton
          variant={coach.is_active ? "destructive" : "secondary"}
          confirmMessage={
            coach.is_active
              ? "Nonaktifkan pelatih ini? Pelatih tidak akan bisa login sampai diaktifkan kembali."
              : undefined
          }
        >
          {coach.is_active ? "Nonaktifkan Pelatih" : "Aktifkan Kembali"}
        </ActionSubmitButton>
      </ActionForm>
    </div>
  );
}
