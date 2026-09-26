import Link from "next/link";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TRIAL_DAYS } from "@/lib/config";
import type { PlatformPlan } from "@/lib/data/platform-plan";

const HIGHLIGHTED_PLAN = "Growth";

const DESCRIPTION: Record<string, string> = {
  Trial: "Coba semua fitur inti sebelum berlangganan.",
  Starter: "Untuk klub renang satu lokasi.",
  Growth: "Untuk klub yang mulai berkembang ke beberapa cabang.",
  Pro: "Untuk klub besar atau jaringan multi-cabang.",
};

const PAID_EXTRAS = ["Semua fitur inti", "Buku kas & gaji pelatih"];

const EXTRAS: Record<string, string[]> = {
  Trial: ["Semua fitur inti", "Tanpa kartu kredit"],
  Starter: PAID_EXTRAS,
  Growth: PAID_EXTRAS,
  Pro: PAID_EXTRAS,
};

function locationFeature(limit: number | null) {
  if (!limit) return "Lokasi kolam tanpa batas";
  return limit === 1 ? "1 lokasi kolam" : `Hingga ${limit} lokasi kolam`;
}

export function PlanCards({
  plans,
  ctaHref,
  compact = false,
}: {
  plans: PlatformPlan[];
  ctaHref?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", compact ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
      {plans.map((plan) => {
        const highlighted = plan.name === HIGHLIGHTED_PLAN;
        const features = [locationFeature(plan.locationLimit), ...(EXTRAS[plan.name] ?? ["Semua fitur inti"])];
        return (
          <div
            key={plan.id}
            className={cn(
              "flex flex-col rounded-lg border",
              compact ? "p-4" : "p-6",
              highlighted ? "border-primary bg-secondary" : "border-border bg-card"
            )}
          >
            {highlighted ? <Badge className="mb-3 w-fit">Paling Populer</Badge> : null}
            <h3 className="font-heading text-lg font-semibold text-foreground">{plan.name}</h3>
            {DESCRIPTION[plan.name] ? (
              <p className="mt-1 text-sm text-muted-foreground">{DESCRIPTION[plan.name]}</p>
            ) : null}
            <p className="mt-4">
              <span className={cn("whitespace-nowrap font-heading font-semibold text-foreground", compact ? "text-xl" : "text-2xl")}>
                {plan.price === 0 ? "Gratis" : `Rp ${plan.price.toLocaleString("id-ID")}`}
              </span>
              <span className="text-sm text-muted-foreground">
                {plan.price === 0 ? ` · ${TRIAL_DAYS} hari` : plan.billingCycle === "yearly" ? "/tahun" : "/bulan"}
              </span>
            </p>
            <p className="mt-1 text-sm font-medium text-primary">
              {plan.memberLimit ? `${plan.memberLimit} anggota` : "Anggota tanpa batas"}
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
            {ctaHref ? (
              <div className="mt-auto pt-6">
                <Link
                  href={ctaHref}
                  className={buttonVariants({ variant: highlighted ? "default" : "outline", className: "w-full" })}
                >
                  Mulai Trial Gratis
                </Link>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
