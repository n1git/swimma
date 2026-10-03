"use client";

import { useActionState } from "react";
import { createSubscription } from "@/lib/actions/billing";
import { getJakartaDateString } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActionToast } from "@/components/shared/use-action-toast";
import type { Lookup } from "@/lib/data/lookups";
import { MemberPicker } from "@/components/shared/member-picker";

export function SubscriptionForm({
  packages,
}: {
  packages: Lookup[];
}) {
  const [state, formAction, pending] = useActionState(createSubscription, {});
  useActionToast(state, "Langganan berhasil ditambahkan");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="memberId">Anggota</Label>
        <MemberPicker id="memberId" name="memberId" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="packageId">Paket</Label>
        <Select id="packageId" name="packageId" required defaultValue="">
          <option value="" disabled>
            Pilih paket
          </option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="startDate">Tanggal Mulai</Label>
        <Input
          id="startDate"
          name="startDate"
          type="date"
          required
          defaultValue={getJakartaDateString()}
        />
      </div>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Menyimpan..." : "Tambah Langganan"}
      </Button>
    </form>
  );
}
