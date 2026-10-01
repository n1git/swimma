import { requireSuperadmin } from "@/lib/auth/superadmin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { formatJakartaDate, getJakartaDateString } from "@/lib/format";
import { STATUS_LABEL, type PlatformSubscriptionStatus } from "@/lib/validations/superadmin";
import { StatCard } from "@/components/reports/stat-card";
import { SubscriptionForm } from "@/components/superadmin/subscription-form";
import { OrganizationControls, type OwnerRow } from "@/components/superadmin/organization-controls";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<PlatformSubscriptionStatus, "success" | "secondary" | "destructive" | "warning"> = {
  trial: "warning",
  active: "success",
  suspended: "destructive",
  cancelled: "secondary",
};

interface PlanRow {
  id: string;
  name: string;
  price: number | string;
  billing_cycle: "monthly" | "yearly";
  member_limit: number | null;
  location_limit: number | null;
  is_active: boolean;
}

function formatRupiah(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function formatDate(value: string) {
  return formatJakartaDate(value, { day: "numeric", month: "short", year: "numeric" });
}

function usageLabel(used: number, limit: number | null) {
  return limit ? `${used} / ${limit}` : `${used}`;
}

export default async function SuperadminDashboardPage() {
  await requireSuperadmin();
  const supabase = createAdminSupabaseClient();

  const [{ data: tenants }, { data: subscriptions }, { data: plans }, { data: usage }, { data: organizations }, { data: owners }] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, name, is_active, created_at, organization_id")
      .order("created_at", { ascending: false }),
    supabase.from("platform_subscriptions").select("tenant_id, plan_id, status, trial_ends_at, notes"),
    supabase
      .from("platform_plans")
      .select("id, name, price, billing_cycle, member_limit, location_limit, is_active")
      .order("price"),
    supabase.from("platform_tenant_usage").select("tenant_id, active_members, locations"),
    supabase.from("organizations").select("id, name, max_tenants, created_at").order("created_at", { ascending: false }),
    supabase.from("org_owners").select("id, organization_id, email, full_name, is_active"),
  ]);

  const planRows = (plans ?? []) as PlanRow[];
  const planById = new Map(planRows.map((plan) => [plan.id, plan]));
  const subscriptionByTenant = new Map((subscriptions ?? []).map((s) => [s.tenant_id as string, s]));
  const usageByTenant = new Map((usage ?? []).map((u) => [u.tenant_id as string, u]));
  const today = getJakartaDateString();

  const allSubscriptions = subscriptions ?? [];
  const isTrialExpired = (s: { status: string; trial_ends_at: string | null }) =>
    s.status === "trial" && !!s.trial_ends_at && s.trial_ends_at < today;
  const monthlyRevenue = allSubscriptions
    .filter((s) => s.status === "active")
    .reduce((sum, s) => {
      const plan = planById.get(s.plan_id);
      if (!plan) return sum;
      const price = Number(plan.price);
      return sum + (plan.billing_cycle === "yearly" ? price / 12 : price);
    }, 0);
  const activeCount = allSubscriptions.filter((s) => s.status === "active").length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dasbor Platform</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total organisasi / klub" value={`${(organizations ?? []).length} / ${(tenants ?? []).length}`} />
        <StatCard
          title="Trial berjalan"
          value={String(allSubscriptions.filter((s) => s.status === "trial" && !isTrialExpired(s)).length)}
        />
        <StatCard title="Trial sudah berakhir" value={String(allSubscriptions.filter(isTrialExpired).length)} />
        <StatCard title={`Pendapatan bulanan (${activeCount} klub aktif)`} value={formatRupiah(Math.round(monthlyRevenue))} />
      </div>

      <p className="max-w-3xl text-sm text-muted-foreground">
        Ubah status ke Aktif setelah pembayaran klub diterima. Ditangguhkan dan Dibatalkan langsung memutus akses
        seluruh pengguna klub; datanya tetap tersimpan dan kembali saat status diubah ke Trial atau Aktif. Pemilik
        yang dinonaktifkan kehilangan akses ke semua klubnya sekaligus.
      </p>

      {(organizations ?? []).map((organization) => {
        const orgTenants = (tenants ?? []).filter((t) => t.organization_id === organization.id);
        const orgOwners = (owners ?? []).filter((o) => o.organization_id === organization.id) as unknown as OwnerRow[];
        return (
          <section key={organization.id} className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-semibold">{organization.name}</h2>
              <p className="text-sm text-muted-foreground">
                {orgTenants.length} / {organization.max_tenants} klub — terdaftar {formatDate(organization.created_at)}
              </p>
            </div>
            <OrganizationControls
              organizationId={organization.id}
              maxTenants={organization.max_tenants}
              owners={orgOwners}
            />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Klub</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Paket</TableHead>
              <TableHead>Anggota</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Trial berakhir</TableHead>
              <TableHead>Ubah langganan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgTenants.map((tenant) => {
              const subscription = subscriptionByTenant.get(tenant.id);
              const plan = subscription ? planById.get(subscription.plan_id) : undefined;
              const tenantUsage = usageByTenant.get(tenant.id);
              const status = (subscription?.status ?? null) as PlatformSubscriptionStatus | null;
              const planOptions = planRows
                .filter((p) => p.is_active || p.id === subscription?.plan_id)
                .map((p) => ({ id: p.id, name: p.is_active ? p.name : `${p.name} (nonaktif)` }));

              return (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <div className="font-medium">{tenant.name}</div>
                    <div className="text-xs text-muted-foreground">Terdaftar {formatDate(tenant.created_at)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {status ? (
                        <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                      ) : (
                        <Badge variant="outline">Tanpa paket</Badge>
                      )}
                      {subscription && isTrialExpired(subscription) ? (
                        <Badge variant="destructive">Trial berakhir</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {plan ? (
                      <>
                        <div>{plan.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatRupiah(Number(plan.price))}/{plan.billing_cycle === "yearly" ? "thn" : "bln"}
                        </div>
                      </>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{usageLabel(Number(tenantUsage?.active_members ?? 0), plan?.member_limit ?? null)}</TableCell>
                  <TableCell>{usageLabel(Number(tenantUsage?.locations ?? 0), plan?.location_limit ?? null)}</TableCell>
                  <TableCell>{subscription?.trial_ends_at ? formatDate(subscription.trial_ends_at) : "-"}</TableCell>
                  <TableCell>
                    <SubscriptionForm
                      tenantId={tenant.id}
                      tenantName={tenant.name}
                      plans={planOptions}
                      planId={subscription?.plan_id ?? null}
                      status={status}
                      notes={subscription?.notes ?? null}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {orgTenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Organisasi ini belum punya klub.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
          </section>
        );
      })}
      {(organizations ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada organisasi. Organisasi baru muncul di sini setelah mendaftar lewat halaman /daftar.
        </p>
      ) : null}
    </div>
  );
}
