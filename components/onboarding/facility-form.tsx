"use client";

import { useActionState } from "react";
import { createResourcesBulk } from "@/lib/actions/resources";
import { RESOURCE_KINDS } from "@/lib/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActionToast } from "@/components/shared/use-action-toast";
import type { Lookup } from "@/lib/data/lookups";
import type { ResourcePreset } from "@/lib/data/booking";

export function FacilityForm({
  locations,
  preset,
  resourceLabel,
}: {
  locations: Lookup[];
  preset: ResourcePreset | null;
  resourceLabel: string;
}) {
  const [state, formAction, pending] = useActionState(createResourcesBulk, {});
  useActionToast(state, `${resourceLabel} berhasil ditambahkan`);
  const defaultKind = preset?.kind ?? "other";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fac-location">Lokasi</Label>
          <Select id="fac-location" name="locationId" required defaultValue={locations.length === 1 ? locations[0].id : ""}>
            <option value="" disabled>
              Pilih lokasi
            </option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fac-kind">Jenis</Label>
          <Select id="fac-kind" name="kind" defaultValue={defaultKind}>
            {RESOURCE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fac-pattern">Pola nama</Label>
          <Input id="fac-pattern" name="namePattern" defaultValue={preset?.namePattern ?? `${resourceLabel} {n}`} required />
          <p className="text-xs text-muted-foreground">{"{n}"} diganti nomor urut.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fac-count">Jumlah</Label>
          <Input id="fac-count" name="count" type="number" min={1} max={50} defaultValue={preset?.count ?? 1} required />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fac-capacity">Kapasitas per slot</Label>
          <Input id="fac-capacity" name="capacity" type="number" min={1} max={1000} defaultValue={1} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fac-slot">Durasi slot (menit)</Label>
          <Input id="fac-slot" name="slotMinutes" type="number" min={15} max={480} step={15} defaultValue={preset?.slotMinutes ?? 60} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fac-price">Harga per slot (Rp)</Label>
          <Input id="fac-price" name="pricePerSlot" type="number" min={0} step={1000} defaultValue={0} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fac-opens">Jam buka</Label>
          <Input id="fac-opens" name="opens" type="time" defaultValue="06:00" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fac-closes">Jam tutup</Label>
          <Input id="fac-closes" name="closes" type="time" defaultValue="22:00" required />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fac-advance">Booking maksimal (hari ke depan)</Label>
          <Input id="fac-advance" name="advanceDays" type="number" min={0} max={365} defaultValue={14} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fac-cancel">Batas pembatalan (jam sebelum mulai)</Label>
          <Input id="fac-cancel" name="cancelHours" type="number" min={0} max={720} defaultValue={6} required />
        </div>
      </div>
      <Button type="submit" disabled={pending || locations.length === 0} className="w-fit">
        {pending ? "Menyimpan..." : `Tambah ${resourceLabel}`}
      </Button>
      {locations.length === 0 ? <p className="text-sm text-muted-foreground">Tambahkan lokasi dulu di langkah sebelumnya.</p> : null}
    </form>
  );
}
