import { requireValidSession } from "@/lib/auth/guard";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/shared/change-password-form";

export default async function ChangePasswordPage() {
  const { mustChangePassword } = await requireValidSession();

  return (
    <main className="flex flex-1 items-center justify-center bg-secondary p-4">
      <Card frame={false} className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-lg font-semibold leading-none tracking-tight">Ganti Kata Sandi</h1>
          <CardDescription>
            {mustChangePassword ? "Buat kata sandi baru sebelum melanjutkan." : "Masukkan kata sandi saat ini, lalu kata sandi baru."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm requireCurrent={!mustChangePassword} />
        </CardContent>
      </Card>
    </main>
  );
}
