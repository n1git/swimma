import { NavLink } from "./nav-link";
import type { NavGroup } from "./nav-types";

export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  return (
    <nav
      aria-label="Menu utama"
      className="hidden shrink-0 flex-col gap-5 overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 print:hidden sm:flex sm:w-60"
    >
      {groups.map((group, index) => {
        const headingId = `nav-group-${index}`;
        return (
          <section key={group.label ?? index} aria-labelledby={group.label ? headingId : undefined}>
            {group.label ? (
              <h2 id={headingId} className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-muted-foreground">
                {group.label}
              </h2>
            ) : null}
            <ul className="flex flex-col gap-0.5 rounded-lg border border-sidebar-border p-1">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}
