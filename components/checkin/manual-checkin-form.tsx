"use client";

import { manualCheckin } from "@/lib/actions/checkin";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Label } from "@/components/ui/label";
import { MemberPicker } from "@/components/shared/member-picker";
import { Select } from "@/components/ui/select";

export function ManualCheckinForm({
  memberId,
  points,
}: {
  memberId?: string;
  points?: { id: string; name: string }[];
}) {
  return (
    <ActionForm action={manualCheckin} className="flex flex-col gap-4">
      {memberId ? (
        <input type="hidden" name="memberId" value={memberId} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manual-member">Anggota</Label>
          <MemberPicker id="manual-member" name="memberId" required />
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
