"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const FIELDS = ["tenantName", "tenantSlug", "adminFullName", "adminEmail", "password"] as const;

export function RegisterClubForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const res = await fetch("/api/onboarding/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(FIELDS.map((field) => [field, formData.get(field)]))),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "Gagal mendaftarkan klub");
      setLoading(false);
      return;
    }

    router.push(data.redirectTo);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-4 transition-opacity duration-300", loading && "opacity-50")}
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tenantName">Nama klub</Label>
        <Input id="tenantName" name="tenantName" required maxLength={100} autoComplete="organization" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tenantSlug">Kode klub</Label>
        <Input
          id="tenantSlug"
          name="tenantSlug"
          required
          minLength={3}
          maxLength={40}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby="tenantSlug-hint"
        />
        <p id="tenantSlug-hint" className="text-xs text-muted-foreground">
          Diketik semua anggota klub saat masuk. Huruf kecil, angka, dan tanda hubung, misalnya
          melati-swim.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adminFullName">Nama Anda</Label>
        <Input id="adminFullName" name="adminFullName" required maxLength={100} autoComplete="name" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adminEmail">Email</Label>
        <Input id="adminEmail" name="adminEmail" type="email" required autoComplete="email" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Kata sandi</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          Minimal 8 karakter, berisi huruf dan angka.
        </p>
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Mendaftarkan..." : "Daftarkan klub"}
      </Button>
    </form>
  );
}
