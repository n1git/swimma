import { Fragment } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TRIAL_DAYS } from "@/lib/config";
import type { PlatformPlan } from "@/lib/data/platform-plan";

const RECOMMENDED_PLAN = "Growth";
const COLUMNS_WITH_CTA = "sm:grid-cols-[1.5fr_1fr_1fr_1.3fr_11rem]";
const COLUMNS = "sm:grid-cols-[1.5fr_1fr_1fr_1.3fr]";

const AUDIENCE: Record<string, string> = {
  Trial: "Coba semua fitur dengan data klub Anda sendiri.",
  Starter: "Klub kecil dengan satu kolam.",
  Growth: "Klub yang berkembang ke beberapa kolam.",
  Pro: "Klub besar atau jaringan cabang.",
};

function formatRupiah(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function memberLabel(limit: number | null) {
  return limit ? `Hingga ${limit} anggota aktif` : "Anggota tanpa batas";
}

function locationLabel(limit: number | null) {
  if (!limit) return "Lokasi tanpa batas";
  return limit === 1 ? "1 lokasi kolam" : `Hingga ${limit} lokasi kolam`;
}

function priceLabel(plan: PlatformPlan) {
  if (plan.price === 0) return { amount: "Gratis", period: `${TRIAL_DAYS} hari` };
  return { amount: formatRupiah(plan.price), period: plan.billingCycle === "yearly" ? "per tahun" : "per bulan" };
}

export function PlanLanes({
  plans,
  ctaHref,
  compact = false,
}: {
  plans: PlatformPlan[];
  ctaHref?: string;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "hidden gap-6 px-4 pb-3 text-sm text-muted-foreground sm:grid",
          ctaHref ? COLUMNS_WITH_CTA : COLUMNS
        )}
      >
        <span>Paket</span>
        <span>Anggota</span>
        <span>Lokasi</span>
        <span>Harga</span>
        {ctaHref ? <span className="sr-only">Aksi</span> : null}
      </div>
      <div className="lane-rope" aria-hidden />
      <ul className="flex flex-col">
        {plans.map((plan, index) => {
          const recommended = plan.name === RECOMMENDED_PLAN;
          const price = priceLabel(plan);
          return (
            <Fragment key={plan.id}>
              {index > 0 ? <li className="lane-rope" aria-hidden /> : null}
              <li
                className={cn(
                  "grid gap-x-6 gap-y-3 px-4 sm:items-center",
                  compact ? "py-4" : "py-6 sm:py-7",
                  ctaHref ? COLUMNS_WITH_CTA : COLUMNS,
                  recommended && "bg-secondary"
                )}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={cn("font-heading font-semibold text-foreground", compact ? "text-base" : "text-xl")}>
                      {plan.name}
                    </h3>
                    {recommended ? <Badge>Rekomendasi</Badge> : null}
                  </div>
                  {AUDIENCE[plan.name] ? (
                    <p className="text-sm text-muted-foreground">{AUDIENCE[plan.name]}</p>
                  ) : null}
                </div>
                <p className="text-sm text-foreground">{memberLabel(plan.memberLimit)}</p>
                <p className="text-sm text-foreground">{locationLabel(plan.locationLimit)}</p>
                <p className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className={cn("whitespace-nowrap font-heading font-semibold text-foreground", compact ? "text-base" : "text-2xl")}>
                    {price.amount}
                  </span>
                  <span className="whitespace-nowrap text-sm text-muted-foreground">{price.period}</span>
                </p>
                {ctaHref ? (
                  <Link
                    href={ctaHref}
                    className={buttonVariants({
                      variant: recommended ? "default" : "outline",
                      className: "w-full",
                    })}
                  >
                    {plan.price === 0 ? "Daftarkan klub" : "Mulai dengan trial"}
                  </Link>
                ) : null}
              </li>
            </Fragment>
          );
        })}
      </ul>
      <div className="lane-rope" aria-hidden />
    </div>
  );
}
