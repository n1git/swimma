import Link from "next/link";
import { KeyRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { LogoutButton } from "./logout-button";
import { MobileNav } from "./mobile-nav";
import { NavGroupsProvider } from "./nav-context";
import type { NavGroup } from "./nav-types";
import { SidebarNav } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";

export function AppShell({
  navGroups,
  fullName,
  roleLabel,
  clubName,
  tenantSwitcher,
  children,
}: {
  navGroups: NavGroup[];
  fullName: string;
  roleLabel: string;
  clubName: string;
  tenantSwitcher?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <NavGroupsProvider groups={navGroups}>
      <div className="app-ui flex min-h-screen w-full">
        <SidebarNav groups={navGroups} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-[54px] flex-wrap items-center justify-between gap-2 border-b border-dashed border-border bg-card px-4 py-1.5 print:hidden sm:px-6">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="min-w-0 truncate font-heading text-base font-semibold tracking-tight text-primary">{clubName}</span>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                {roleLabel}
              </span>
              {tenantSwitcher}
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <span className="hidden text-sm text-muted-foreground sm:inline">{fullName}</span>
              <ThemeToggle />
              <Link href="/change-password" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                <KeyRound className="size-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Kata sandi</span>
              </Link>
              <LogoutButton />
            </div>
          </header>
          <main className="min-w-0 flex-1 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-6 print:p-0">{children}</main>
        </div>
        <MobileNav groups={navGroups} />
      </div>
    </NavGroupsProvider>
  );
}
