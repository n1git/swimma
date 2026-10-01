import { requireOwner } from "@/lib/auth/owner";
import { getModules, getOrganizationBilling, listInternalUsers } from "@/lib/data/platform-pricing";
import { formatJakartaDate } from "@/lib/format";
import { formatRupiah, PERIOD_LABEL } from "@/lib/pricing";
import { STATUS_LABEL } from "@/lib/validations/superadmin";
import { SubscriptionBanner } from "@/components/subscription/subscription-banner";
import { ChangePlanForm } from "@/components/subscription/change-plan-form";
import { ModuleList } from "@/components/pricing/pricing-picker";
import { StatCard } from "@/components/reports/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT = {
  pending: "secondary",
  trial: "warning",
  active: "success",
  suspended: "destructive",
  cancelled: "secondary",
} as const;

export default async function SubscriptionPage() {
  const owner = await requireOwner();
  const [billing, users, modules] = await Promise.all([
    getOrganizationBilling(owner.organizationId),
    listInternalUsers(owner.organizationId),
    getModules(),
  ]);
  if (!billing) return <p className="text-sm text-muted-foreground">Langganan belum tersedia.</p>;

  const { subscription, plan, quote } = billing;
  const periodUnit = subscription.billingPeriod === "yearly" ? "tahun" : "bulan";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Langganan</h1>
        <Badge variant={STATUS_VARIANT[subscription.status]}>{STATUS_LABEL[subscription.status]}</Badge>
      </div>

      <SubscriptionBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Paket" value={`${plan.name} · ${PERIOD_LABEL[subscription.billingPeriod]}`} />
        <StatCard title="Pengguna internal" value={String(billing.internalUsers)} />
        <StatCard
          title="Klub"
          value={billing.clubLimit !== null ? `${billing.clubs} / ${billing.clubLimit}` : `${billing.clubs} (tak terbatas)`}
        />
        <StatCard title={`Total per ${periodUnit}`} value={formatRupiah(quote.total)} />
      </div>

      <p className="max-w-2xl text-sm text-muted-foreground">
        {quote.users} pengguna × {formatRupiah(quote.unitPrice)} × {quote.months.toLocaleString("id-ID")} bulan ={" "}
        {formatRupiah(quote.total)}
        {subscription.billingPeriod === "yearly" ? `, setara ${formatRupiah(quote.perMonth)}/bulan` : ""}.
        {subscription.currentPeriodEnd
          ? ` Periode berjalan sampai ${formatJakartaDate(subscription.currentPeriodEnd, { day: "numeric", month: "long", year: "numeric" })}.`
          : ""}
        {subscription.status === "trial" && subscription.trialEndsAt
          ? ` Trial sampai ${formatJakartaDate(subscription.trialEndsAt, { day: "numeric", month: "long", year: "numeric" })}.`
          : ""}
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Pengguna internal</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Klub</TableHead>
              <TableHead>Biaya/bulan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.key}>
                <TableCell>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </TableCell>
                <TableCell>{user.roleLabel}</TableCell>
                <TableCell>{user.clubName ?? "Semua klub"}</TableCell>
                <TableCell>{formatRupiah(quote.unitPrice)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          Akun admin Anda di setiap klub dihitung satu kali. Anggota dan akun nonaktif tidak dihitung.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ubah paket</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Perubahan berlaku untuk perhitungan berikutnya. Penagihan dan aktivasi dilakukan admin platform setelah
          pembayaran diterima di luar aplikasi.
        </p>
        <ChangePlanForm
          plans={billing.plans}
          planCode={subscription.planCode}
          period={subscription.billingPeriod}
          users={billing.internalUsers}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Modul</h2>
        <ModuleList modules={modules} />
      </section>
    </div>
  );
}
