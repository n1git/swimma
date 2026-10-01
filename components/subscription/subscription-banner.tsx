import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { loadOwner } from "@/lib/auth/owner";
import { getOwnSubscription } from "@/lib/data/platform-pricing";
import { getJakartaDateString } from "@/lib/format";
import { APP_NAME } from "@/lib/config";

const DAY_MS = 24 * 60 * 60 * 1000;

function trialMessage(trialEndsAt: string | null) {
  if (!trialEndsAt) return { title: "Organisasi Anda sedang dalam masa trial", blocked: false };
  const daysLeft = Math.round((Date.parse(trialEndsAt) - Date.parse(getJakartaDateString())) / DAY_MS);
  if (daysLeft < 0) return { title: "Masa trial organisasi Anda sudah berakhir", blocked: true };
  if (daysLeft === 0) return { title: "Masa trial berakhir hari ini", blocked: false };
  return { title: `Masa trial tersisa ${daysLeft} hari`, blocked: false };
}

export async function SubscriptionBanner() {
  const [subscription, session] = await Promise.all([getOwnSubscription(), getSession()]);
  if (!subscription || (subscription.status !== "pending" && subscription.status !== "trial")) return null;

  const owner = session ? await loadOwner(session.sub, session.tenant_id) : null;
  const trial = subscription.status === "trial" ? trialMessage(subscription.trialEndsAt) : null;
  const blocked = subscription.status === "pending" || trial?.blocked;
  const title = subscription.status === "pending" ? "Langganan menunggu aktivasi" : trial!.title;

  return (
    <Alert variant={blocked ? "warning" : "default"}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>
          {blocked
            ? `Menambah anggota, klub, dan pengguna baru dinonaktifkan sampai admin platform ${APP_NAME} mengaktifkan langganan. Anda tetap bisa masuk dan melihat data.`
            : `Agar tetap berjalan setelah trial, pilih paket dan hubungi admin platform ${APP_NAME}. Pembayaran dilakukan di luar aplikasi.`}
        </span>
        {owner ? (
          <Link href="/admin/klub/langganan" className={buttonVariants({ size: "sm", className: "w-fit" })}>
            Kelola langganan
          </Link>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
