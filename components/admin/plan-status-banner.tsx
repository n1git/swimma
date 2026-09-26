import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PlanCards } from "@/components/pricing/plan-cards";
import { getActivePlans, type OwnSubscription } from "@/lib/data/platform-plan";
import { getJakartaDateString } from "@/lib/format";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/config";

const DAY_MS = 24 * 60 * 60 * 1000;

function trialHeadline(trialEndsAt: string | null) {
  if (!trialEndsAt) return "Klub Anda sedang dalam masa trial";
  const daysLeft = Math.round((Date.parse(trialEndsAt) - Date.parse(getJakartaDateString())) / DAY_MS);
  if (daysLeft < 0) return "Masa trial klub Anda sudah berakhir";
  if (daysLeft === 0) return "Masa trial berakhir hari ini";
  return `Masa trial tersisa ${daysLeft} hari`;
}

export async function PlanStatusBanner({
  subscription,
  activeMemberCount,
}: {
  subscription: OwnSubscription | null;
  activeMemberCount: number;
}) {
  if (subscription?.status !== "trial") return null;

  const paidPlans = (await getActivePlans()).filter((plan) => plan.price > 0);
  const memberLimit = subscription.plan?.memberLimit ?? null;
  const usage = memberLimit ? Math.min(activeMemberCount / memberLimit, 1) : 0;

  return (
    <Card>
      <CardHeader className="gap-3">
        <h2 className="font-heading text-lg font-semibold">{trialHeadline(subscription.trialEndsAt)}</h2>
        {memberLimit ? (
          <div className="flex max-w-md flex-col gap-1.5">
            <p className="text-sm text-muted-foreground">
              {activeMemberCount} dari {memberLimit} anggota aktif terpakai
            </p>
            <div
              role="progressbar"
              aria-label="Pemakaian kuota anggota"
              aria-valuemin={0}
              aria-valuemax={memberLimit}
              aria-valuenow={activeMemberCount}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn("h-full rounded-full", usage >= 0.9 ? "bg-warning" : "bg-primary")}
                style={{ width: `${usage * 100}%` }}
              />
            </div>
          </div>
        ) : null}
      </CardHeader>
      {paidPlans.length > 0 ? (
        <CardContent className="flex flex-col gap-4">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Supaya klub tetap berjalan setelah trial, pilih salah satu paket di bawah lalu hubungi
            admin platform {APP_NAME}. Pembayaran dan aktivasi paket dilakukan langsung oleh tim kami.
          </p>
          <PlanCards plans={paidPlans} compact />
        </CardContent>
      ) : null}
    </Card>
  );
}
