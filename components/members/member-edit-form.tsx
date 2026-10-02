"use client";

import { useActionState } from "react";
import { updateMember, toggleMemberActive } from "@/lib/actions/members";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActionToast } from "@/components/shared/use-action-toast";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { MemberFields, type MemberDefaults } from "./member-fields";
import type { Lookup } from "@/lib/data/lookups";

interface MemberDetail extends MemberDefaults {
  id: string;
  is_active: boolean;
}

export function MemberEditForm({
  member,
  locations,
  coaches,
  canChangeStatus,
}: {
  member: MemberDetail;
  locations: Lookup[];
  coaches: Lookup[];
  canChangeStatus: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateMember.bind(null, member.id), {});
  useActionToast(state, "Perubahan disimpan");
  const [toggleState, toggleAction] = useActionState(toggleMemberActive, {});
  useActionToast(toggleState, "Status anggota diperbarui");

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        <MemberFields coaches={coaches} locations={locations} defaults={member} />
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </form>

      {canChangeStatus ? (
      <form action={toggleAction} className="flex flex-col gap-3">
        {toggleState.error ? (
          <Alert variant="destructive">
            <AlertDescription>{toggleState.error}</AlertDescription>
          </Alert>
        ) : null}
        <input type="hidden" name="memberId" value={member.id} />
        <input type="hidden" name="isActive" value={(!member.is_active).toString()} />
        <ActionSubmitButton
          variant={member.is_active ? "destructive" : "secondary"}
          confirmMessage={member.is_active ? "Nonaktifkan anggota ini? Anggota akan ditandai nonaktif." : undefined}
        >
          {member.is_active ? "Nonaktifkan Anggota" : "Aktifkan Kembali"}
        </ActionSubmitButton>
      </form>
      ) : null}
    </div>
  );
}
