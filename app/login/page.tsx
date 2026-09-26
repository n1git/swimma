import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthPageShell } from "@/components/shared/auth-page-shell";
import { LoginForm } from "@/components/shared/login-form";
import { APP_NAME } from "@/lib/config";

const NOTICES: Record<string, string> = {
  suspended: `Akses klub Anda sedang dinonaktifkan. Data klub tetap tersimpan. Hubungi admin platform ${APP_NAME} untuk mengaktifkannya kembali.`,
  deactivated: "Akun Anda dinonaktifkan oleh admin klub.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ suspended?: string; deactivated?: string }>;
}) {
  const params = await searchParams;
  const notice = params.suspended ? NOTICES.suspended : params.deactivated ? NOTICES.deactivated : null;

  return (
    <AuthPageShell
      title={APP_NAME}
      description="Masuk ke akun klub renang Anda"
      footer={
        <>
          Klub Anda belum terdaftar?{" "}
          <Link href="/daftar" className="font-medium text-primary underline-offset-4 hover:underline">
            Daftarkan klub
          </Link>
        </>
      }
    >
      {notice ? (
        <Alert variant="warning">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      <LoginForm />
    </AuthPageShell>
  );
}
