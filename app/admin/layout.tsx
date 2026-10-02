import { requireRole } from "@/lib/auth/guard";
import { getCurrentTenant } from "@/lib/data/tenant";
import { AppShell, type NavItem } from "@/components/shared/app-shell";
import { APP_NAME } from "@/lib/config";
import { loadOwner } from "@/lib/auth/owner";
import { getSwitchableTenants } from "@/lib/data/organization";
import { TenantSwitcher } from "@/components/organization/tenant-switcher";
import { canAccessPath, ROLE_LABEL, STAFF_ROLES } from "@/lib/auth/roles";
import { getEnabledModules } from "@/lib/modules";
import { getClubTerms } from "@/lib/club-type";

type AdminNavItem = NavItem & { module?: string };

const navItems = (resourceLabel: string): AdminNavItem[] => [
  { href: "/admin", label: "Dasbor" },
  { href: "/admin/members", label: "Anggota" },
  { href: "/admin/coaches", label: "Pelatih" },
  { href: "/admin/staff", label: "Staf" },
  { href: "/admin/schedule", label: "Jadwal", module: "classes" },
  { href: "/admin/booking", label: "Booking", module: "resource_booking" },
  { href: "/admin/fasilitas", label: resourceLabel, module: "resource_booking" },
  { href: "/admin/checkin", label: "Check-in", module: "checkin" },
  { href: "/admin/billing/packages", label: "Paket", module: "plans" },
  { href: "/admin/billing/subscriptions", label: "Langganan", module: "billing" },
  { href: "/admin/billing/invoices", label: "Tagihan", module: "billing" },
  { href: "/admin/cash-ledger", label: "Buku Kas", module: "cash_ledger" },
  { href: "/admin/payroll", label: "Gaji Pelatih", module: "payroll" },
  { href: "/admin/promo", label: "Promo", module: "promo" },
  { href: "/admin/reports", label: "Laporan" },
  { href: "/admin/settings", label: "Pengaturan" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(STAFF_ROLES);
  const tenant = await getCurrentTenant();
  const [enabled, terms] = await Promise.all([getEnabledModules(), getClubTerms()]);
  const navBase: NavItem[] = navItems(terms.resource).filter((item) => !item.module || enabled.has(item.module)).map(
    ({ href, label, exact }) => ({ href, label, exact })
  );
  const owner = session.role === "admin" ? await loadOwner(session.id, session.tenantId) : null;
  const tenants = owner ? await getSwitchableTenants(owner.ownerId) : [];
  const switcher = tenants.length > 1 ? <TenantSwitcher tenants={tenants} currentId={session.tenantId} /> : null;
  return (
    <AppShell
      navItems={
        owner
          ? [{ href: "/admin/klub", label: "Klub", exact: true }, { href: "/admin/klub/langganan", label: "Langganan" }, ...navBase]
          : navBase.filter((item) => canAccessPath(session.role, item.href))
      }
      fullName={session.fullName}
      roleLabel={ROLE_LABEL[session.role]}
      clubName={tenant?.name ?? APP_NAME}
      tenantSwitcher={switcher}
    >
      {children}
    </AppShell>
  );
}
