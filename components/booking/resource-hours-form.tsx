"use client";

import { useActionState, useState } from "react";
import { setResourceHours } from "@/lib/actions/resources";
import { WEEKDAY_LABEL, type ResourceHour } from "@/lib/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActionToast } from "@/components/shared/use-action-toast";

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function ResourceHoursForm({ resourceId, hours }: { resourceId: string; hours: ResourceHour[] }) {
  const [state, formAction, pending] = useActionState(setResourceHours, {});
  useActionToast(state, "Jam buka disimpan");
  const initial = Object.fromEntries(hours.map((h) => [h.weekday, h]));
  const [open, setOpen] = useState<Record<number, boolean>>(Object.fromEntries(ORDER.map((d) => [d, Boolean(initial[d])])));

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <input type="hidden" name="resourceId" value={resourceId} />
      <ul className="flex flex-col gap-2">
        {ORDER.map((d) => (
          <li key={d} className="grid grid-cols-[6.5rem_1fr] items-center gap-2 sm:grid-cols-[8rem_1fr_1fr]">
            <label className="flex min-h-9 items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name={`open-${d}`}
                checked={open[d]}
                onChange={(e) => setOpen({ ...open, [d]: e.target.checked })}
                className="size-4"
              />
              {WEEKDAY_LABEL[d]}
            </label>
            {open[d] ? (
              <div className="col-span-1 grid grid-cols-2 gap-2 sm:col-span-2">
                <Input type="time" name={`opens-${d}`} defaultValue={initial[d]?.opens ?? "06:00"} aria-label={`Buka ${WEEKDAY_LABEL[d]}`} required />
                <Input type="time" name={`closes-${d}`} defaultValue={initial[d]?.closes ?? "22:00"} aria-label={`Tutup ${WEEKDAY_LABEL[d]}`} required />
              </div>
            ) : (
              <span className="text-sm text-muted-foreground sm:col-span-2">Tutup</span>
            )}
          </li>
        ))}
      </ul>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Menyimpan..." : "Simpan jam buka"}
      </Button>
    </form>
  );
}
