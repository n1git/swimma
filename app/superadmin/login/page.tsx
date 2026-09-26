import type { Metadata } from "next";
import { AuthPageShell } from "@/components/shared/auth-page-shell";
import { SuperadminLoginForm } from "@/components/superadmin/superadmin-login-form";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `Admin platform | ${APP_NAME}`,
  robots: { index: false },
};

export default function SuperadminLoginPage() {
  return (
    <AuthPageShell title={`${APP_NAME} Platform`} description="Masuk sebagai admin platform">
      <SuperadminLoginForm />
    </AuthPageShell>
  );
}
