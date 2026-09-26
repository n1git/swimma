"use client";

import { useActionState } from "react";
import { updateTenantSubscription } from "@/lib/actions/superadmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useActionToast } from "@/components/shared/use-action-toast";
import { STATUS_LABEL, type PlatformSubscriptionStatus } from "@/lib/validations/superadmin";

export function SubscriptionForm({
  tenantId,
  tenantName,
  plans,
  planId,
  status,
  notes,
}: {
  tenantId: string;
  tenantName: string;
  plans: { id: string; name: string }[];
  planId: string | null;
  status: PlatformSubscriptionStatus | null;
  notes: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateTenantSubscription, {});
  useActionToast(state, "Langganan klub diperbarui");

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="flex flex-wrap items-center gap-2">
        <Select
          name="planId"
          defaultValue={planId ?? ""}
          required
          aria-label={`Paket untuk ${tenantName}`}
          className="w-32"
        >
          <option value="" disabled>
            Pilih paket
          </option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </Select>
        <Select
          name="status"
          defaultValue={status ?? "active"}
          aria-label={`Status untuk ${tenantName}`}
          className="w-36"
        >
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input
          name="notes"
          placeholder="Catatan pembayaran"
          defaultValue={notes ?? ""}
          maxLength={500}
          aria-label={`Catatan untuk ${tenantName}`}
          className="w-44"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
