import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PAGE_SIZE } from "@/lib/pagination";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  total,
  pathname,
  params,
}: {
  page: number;
  total: number;
  pathname: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value && key !== "page") query.set(key, value);
    if (target > 1) query.set("page", String(target));
    const qs = query.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const linkClass = buttonVariants({ variant: "outline", size: "sm", className: "min-h-11 min-w-11 sm:min-h-9" });

  return (
    <nav aria-label="Halaman daftar" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Menampilkan {first.toLocaleString("id-ID")}-{last.toLocaleString("id-ID")} dari {total.toLocaleString("id-ID")}
      </p>
      {pages > 1 ? (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={href(page - 1)} className={linkClass} rel="prev" aria-label="Halaman sebelumnya">
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <span className={cn(linkClass, "pointer-events-none opacity-50")} aria-hidden="true">
              <ChevronLeft className="size-4" />
            </span>
          )}
          <span className="text-sm">
            Halaman {page} dari {pages}
          </span>
          {page < pages ? (
            <Link href={href(page + 1)} className={linkClass} rel="next" aria-label="Halaman berikutnya">
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <span className={cn(linkClass, "pointer-events-none opacity-50")} aria-hidden="true">
              <ChevronRight className="size-4" />
            </span>
          )}
        </div>
      ) : null}
    </nav>
  );
}
