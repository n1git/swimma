"use client";

import { updateOrganizationLimit, toggleOwnerActive } from "@/lib/actions/superadmin";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface OwnerRow {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
}

export function OrganizationControls({
  organizationId,
  maxTenants,
  owners,
}: {
  organizationId: string;
  maxTenants: number;
  owners: OwnerRow[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <ActionForm action={updateOrganizationLimit} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="organizationId" value={organizationId} />
        <label htmlFor={`max-${organizationId}`} className="text-sm text-muted-foreground">
          Batas klub
        </label>
        <Input
          id={`max-${organizationId}`}
          name="maxTenants"
          type="number"
          min={1}
          max={1000}
          defaultValue={maxTenants}
          className="w-20"
        />
        <ActionSubmitButton size="sm">Simpan</ActionSubmitButton>
      </ActionForm>
      {owners.map((owner) => (
        <ActionForm key={owner.id} action={toggleOwnerActive} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="ownerId" value={owner.id} />
          <input type="hidden" name="isActive" value={(!owner.is_active).toString()} />
          <span className="text-sm">
            {owner.full_name} — {owner.email}
          </span>
          <Badge variant={owner.is_active ? "success" : "destructive"}>{owner.is_active ? "Aktif" : "Nonaktif"}</Badge>
          <ActionSubmitButton
            size="sm"
            variant={owner.is_active ? "destructive" : "secondary"}
            confirmMessage={
              owner.is_active ? "Nonaktifkan pemilik ini? Semua klub miliknya langsung tidak bisa diakses olehnya." : undefined
            }
          >
            {owner.is_active ? "Nonaktifkan" : "Aktifkan"}
          </ActionSubmitButton>
        </ActionForm>
      ))}
    </div>
  );
}
