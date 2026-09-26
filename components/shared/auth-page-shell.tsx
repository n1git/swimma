import Link from "next/link";
import { Home } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export function AuthPageShell({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-1 items-center justify-center bg-secondary px-4 pb-10 pt-20">
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <Link href="/" className={buttonVariants({ variant: "outline", size: "sm", className: "gap-2" })}>
          <Home className="size-4" aria-hidden />
          Beranda
        </Link>
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {children}
          {footer ? <p className="text-center text-sm text-muted-foreground">{footer}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
