"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useNavGroups } from "@/components/shared/nav-context";
import { isNavActive } from "@/components/shared/nav-types";

export interface Crumb {
  label: string;
  href?: string;
}

function useAutoCrumbs(): Crumb[] {
  const pathname = usePathname();
  const groups = useNavGroups();
  let best: { crumbs: Crumb[]; length: number } | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      const match = isNavActive(pathname, { href: item.href, exact: false });
      if (match && (!best || item.href.length > best.length)) {
        best = {
          length: item.href.length,
          crumbs: [...(group.label ? [{ label: group.label }] : []), { label: item.label, href: pathname === item.href ? undefined : item.href }],
        };
      }
    }
  }
  return best?.crumbs ?? [];
}

export function Breadcrumb({ items }: { items?: Crumb[] }) {
  const auto = useAutoCrumbs();
  const crumbs = items ?? auto;
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="Jejak halaman" className="print:hidden">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <ChevronRight className="size-3" aria-hidden="true" /> : null}
              {crumb.href ? (
                <Link href={crumb.href} className="ui-transition rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "font-medium text-foreground" : undefined}>
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
