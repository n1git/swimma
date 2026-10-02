"use client";

import { switchClub } from "@/lib/actions/member";
import { ActionForm } from "@/components/shared/action-form";
import { Select } from "@/components/ui/select";

export function ClubSwitcher({
  clubs,
  currentId,
}: {
  clubs: { tenantId: string; tenantName: string }[];
  currentId: string;
}) {
  return (
    <ActionForm action={switchClub}>
      <Select
        name="tenantId"
        aria-label="Pindah klub"
        defaultValue={currentId}
        className="h-8 w-44"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {clubs.map((club) => (
          <option key={club.tenantId} value={club.tenantId}>
            {club.tenantName}
          </option>
        ))}
      </Select>
    </ActionForm>
  );
}
