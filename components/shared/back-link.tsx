import Link from "next/link";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-medium md:min-h-6 text-muted-foreground hover:text-foreground"
    >
      <span aria-hidden>←</span>
      {label}
    </Link>
  );
}
