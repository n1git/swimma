import { requireRole } from "@/lib/auth/guard";
import { requireModule } from "@/lib/modules";
import { getCurrentTenant } from "@/lib/data/tenant";
import { listClubsForProfile } from "@/lib/data/member-clubs";
import { AppShell, type NavItem } from "@/components/shared/app-shell";
import { ClubSwitcher } from "@/components/member/club-switcher";
import { APP_NAME } from "@/lib/config";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("member");
  await requireModule("member_portal");
  const [tenant, clubs] = await Promise.all([getCurrentTenant(), listClubsForProfile(user.id)]);

  const navItems: NavItem[] = user.clubPending
    ? [{ href: "/member/klub", label: "Pilih Klub" }]
    : [{ href: "/member", label: "Beranda", exact: true }, ...(clubs.length > 1 ? [{ href: "/member/klub", label: "Klub Saya" }] : [])];

  return (
    <AppShell
      navItems={navItems}
      fullName={user.fullName}
      roleLabel="Anggota"
      clubName={user.clubPending ? APP_NAME : (tenant?.name ?? APP_NAME)}
      tenantSwitcher={
        clubs.length > 1 && !user.clubPending ? <ClubSwitcher clubs={clubs} currentId={user.tenantId} /> : null
      }
    >
      {children}
    </AppShell>
  );
}
