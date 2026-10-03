"use client";

import { useActionState } from "react";
import { createResource, updateResource } from "@/lib/actions/resources";
import { RESOURCE_KINDS, type Resource } from "@/lib/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActionToast } from "@/components/shared/use-action-toast";
import type { Lookup } from "@/lib/data/lookups";

export function ResourceForm({ locations, resource }: { locations: Lookup[]; resource?: Resource }) {
  const [state, formAction, pending] = useActionState(resource ? updateResource : createResource, {});
  useActionToast(state, "Disimpan");
  const id = resource?.id ?? "new";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {resource ? <input type="hidden" name="resourceId" value={resource.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rf-name-${id}`}>Nama</Label>
          <Input id={`rf-name-${id}`} name="name" defaultValue={resource?.name} required maxLength={80} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rf-kind-${id}`}>Jenis</Label>
          <Select id={`rf-kind-${id}`} name="kind" defaultValue={resource?.kind ?? "other"}>
            {RESOURCE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`rf-loc-${id}`}>Lokasi</Label>
        {resource ? (
          <>
            <input type="hidden" name="locationId" value={resource.locationId} />
            <Input id={`rf-loc-${id}`} value={resource.locationName} disabled readOnly />
          </>
        ) : (
          <Select id={`rf-loc-${id}`} name="locationId" required defaultValue={locations.length === 1 ? locations[0].id : ""}>
            <option value="" disabled>
              Pilih lokasi
            </option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rf-cap-${id}`}>Kapasitas per slot</Label>
          <Input id={`rf-cap-${id}`} name="capacity" type="number" min={1} max={1000} defaultValue={resource?.capacity ?? 1} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rf-slot-${id}`}>Durasi slot (menit)</Label>
          <Input id={`rf-slot-${id}`} name="slotMinutes" type="number" min={15} max={480} step={15} defaultValue={resource?.slotMinutes ?? 60} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rf-price-${id}`}>Harga per slot (Rp)</Label>
          <Input id={`rf-price-${id}`} name="pricePerSlot" type="number" min={0} step={1000} defaultValue={resource?.pricePerSlot ?? 0} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rf-adv-${id}`}>Booking maksimal (hari ke depan)</Label>
          <Input id={`rf-adv-${id}`} name="advanceDays" type="number" min={0} max={365} defaultValue={resource?.advanceDays ?? 14} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rf-can-${id}`}>Batas pembatalan (jam sebelum mulai)</Label>
          <Input id={`rf-can-${id}`} name="cancelHours" type="number" min={0} max={720} defaultValue={resource?.cancelHours ?? 6} required />
        </div>
      </div>
      {resource ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rf-opens-new">Jam buka</Label>
            <Input id="rf-opens-new" name="opens" type="time" defaultValue="06:00" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rf-closes-new">Jam tutup</Label>
            <Input id="rf-closes-new" name="closes" type="time" defaultValue="22:00" required />
          </div>
        </div>
      )}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Menyimpan..." : resource ? "Simpan" : "Tambah"}
      </Button>
    </form>
  );
}
