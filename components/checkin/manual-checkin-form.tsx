"use client";

import { manualCheckin } from "@/lib/actions/checkin";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function ManualCheckinForm({
  memberId,
  members,
  points,
}: {
  memberId?: string;
  members?: { id: string; name: string }[];
  points?: { id: string; name: string }[];
}) {
  return (
    <ActionForm action={manualCheckin} className="flex flex-col gap-4">
      {memberId ? (
        <input type="hidden" name="memberId" value={memberId} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manual-member">Anggota</Label>
          <Select id="manual-member" name="memberId" required defaultValue="">
            <option value="" disabled>
              Pilih anggota
            </option>
            {(members ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      {points && points.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manual-point">Titik check-in (opsional)</Label>
          <Select id="manual-point" name="pointId" defaultValue="">
            <option value="">— Tanpa titik —</option>
            {points.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <ActionSubmitButton className="w-fit">Catat check-in</ActionSubmitButton>
    </ActionForm>
  );
}
