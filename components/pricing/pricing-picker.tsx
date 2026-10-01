"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { computeQuote, formatRupiah, PERIOD_LABEL, type BillingPeriod, type PlanCode, type PricingPlan } from "@/lib/pricing";
import type { PlatformModule } from "@/lib/data/platform-pricing";

export function PeriodToggle({
  period,
  onChange,
  freeMonths,
}: {
  period: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
  freeMonths: number;
}) {
  return (
    <div role="group" aria-label="Periode langganan" className="flex flex-wrap gap-2">
      {(["monthly", "yearly"] as BillingPeriod[]).map((value) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={period === value ? "default" : "outline"}
          aria-pressed={period === value}
          onClick={() => onChange(value)}
        >
          {PERIOD_LABEL[value]}
          {value === "yearly" && freeMonths > 0 ? ` · gratis ${freeMonths.toLocaleString("id-ID")} bulan` : ""}
        </Button>
      ))}
    </div>
  );
}

export function UsersInput({ id, users, onChange }: { id: string; users: number; onChange: (users: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Perkiraan pengguna internal</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={1000}
        value={users}
        onChange={(e) => onChange(Math.min(Math.max(Math.floor(Number(e.target.value)) || 1, 1), 1000))}
        className="w-28"
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        Pemilik, admin, dan pelatih. Anggota tidak dihitung.
      </p>
    </div>
  );
}

export function PlanCard({
  plan,
  period,
  users,
  selected,
  onSelect,
  action,
}: {
  plan: PricingPlan;
  period: BillingPeriod;
  users: number;
  selected?: boolean;
  onSelect?: (code: PlanCode) => void;
  action?: React.ReactNode;
}) {
  const quote = computeQuote(plan, period, users);
  const features = [
    "Semua modul",
    plan.clubLimit ? `Maks ${plan.clubLimit} klub` : "Klub tak terbatas",
    "Anggota tak terbatas",
    plan.trialDays > 0 ? `Gratis ${plan.trialDays} hari` : "Aktif setelah pembayaran",
  ];

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border p-6",
        selected ? "border-primary bg-secondary" : "border-border bg-card"
      )}
    >
      <h3 className="font-heading text-lg font-semibold text-foreground">{plan.name}</h3>
      <p className="mt-4">
        <span className="whitespace-nowrap font-heading text-2xl font-semibold text-foreground">
          {formatRupiah(plan.pricePerUserMonth)}
        </span>
        <span className="text-sm text-muted-foreground"> /pengguna/bulan</span>
      </p>
      <p className="mt-2 text-sm text-foreground" aria-live="polite">
        {quote.users} pengguna × {quote.months.toLocaleString("id-ID")} bulan ={" "}
        <span className="font-semibold">{formatRupiah(quote.total)}</span>
        {period === "yearly" ? "/tahun" : "/bulan"}
      </p>
      {period === "yearly" ? (
        <p className="text-sm text-muted-foreground">Setara {formatRupiah(quote.perMonth)}/bulan</p>
      ) : null}
      <ul className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {feature}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6">
        {onSelect ? (
          <Button
            type="button"
            className="w-full"
            variant={selected ? "default" : "outline"}
            aria-pressed={selected}
            onClick={() => onSelect(plan.code)}
          >
            {selected ? "Dipilih" : `Pilih ${plan.name}`}
          </Button>
        ) : (
          action
        )}
      </div>
    </div>
  );
}

export function ModuleList({ modules }: { modules: PlatformModule[] }) {
  if (modules.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Modul yang termasuk">
      {modules.map((module) => (
        <li key={module.code}>
          <Badge variant={module.status === "ready" ? "secondary" : "outline"}>
            {module.name}
            {module.status === "soon" ? " · Segera hadir" : ""}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
