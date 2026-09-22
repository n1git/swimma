import Link from "next/link";
import { Home } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LoginForm } from "@/components/shared/login-form";
import { APP_NAME } from "@/lib/config";

export default function LoginPage() {
  return (
    <div className="relative flex flex-1 items-center justify-center bg-secondary p-4">
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <Link href="/" className={buttonVariants({ variant: "outline", size: "sm", className: "gap-2" })}>
          <Home className="size-4" aria-hidden />
          Beranda
        </Link>
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{APP_NAME}</CardTitle>
          <CardDescription>Masuk ke akun klub renang Anda</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
