import type { Metadata } from "next";
import Link from "next/link";
import { AuthPageShell } from "@/components/shared/auth-page-shell";
import { RegisterClubForm } from "@/components/shared/register-club-form";
import { APP_NAME, TRIAL_DAYS } from "@/lib/config";

export const metadata: Metadata = {
  title: `Daftarkan klub | ${APP_NAME}`,
  description: `Daftarkan klub renang Anda dan coba ${APP_NAME} gratis selama ${TRIAL_DAYS} hari.`,
};

export default function RegisterClubPage() {
  return (
    <AuthPageShell
      title="Daftarkan klub Anda"
      description={`Gratis ${TRIAL_DAYS} hari. Tidak perlu kartu kredit; Anda langsung masuk sebagai admin klub.`}
      footer={
        <>
          Sudah punya akun klub?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Masuk
          </Link>
        </>
      }
    >
      <RegisterClubForm />
    </AuthPageShell>
  );
}
