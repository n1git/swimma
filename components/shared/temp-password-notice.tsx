import { Alert, AlertDescription } from "@/components/ui/alert";

export function TempPasswordNotice({ password }: { password?: string }) {
  if (!password) return null;
  return (
    <Alert variant="success">
      <AlertDescription className="flex flex-col gap-1">
        <span>
          Kata sandi sementara: <code className="rounded bg-background px-1.5 py-0.5 font-mono text-foreground">{password}</code>
        </span>
        <span>Berikan ke pemilik akun sekarang. Kata sandi ini hanya ditampilkan sekali dan wajib diganti saat login pertama.</span>
      </AlertDescription>
    </Alert>
  );
}
