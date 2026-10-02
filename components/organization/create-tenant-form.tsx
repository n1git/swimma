"use client";

import { createTenant } from "@/lib/actions/owner";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TriggerDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function CreateTenantButton({
  disabled,
  clubTypes,
}: {
  disabled: boolean;
  clubTypes: { code: string; name: string }[];
}) {
  return (
    <TriggerDialog trigger={<Button disabled={disabled}>Tambah klub</Button>}>
      <h2 className="mb-4 text-xl font-semibold">Tambah klub</h2>
      <ActionForm action={createTenant} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tenantName">Nama klub</Label>
          <Input id="tenantName" name="tenantName" required minLength={2} maxLength={100} />
        </div>
        {clubTypes.length > 1 ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clubType">Jenis klub</Label>
            <Select id="clubType" name="clubType" defaultValue={clubTypes[0].code}>
              {clubTypes.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">Klub baru dimulai dengan masa trial.</p>
        <ActionSubmitButton className="w-fit">Tambah klub</ActionSubmitButton>
      </ActionForm>
    </TriggerDialog>
  );
}
