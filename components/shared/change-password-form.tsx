"use client";

import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const initialState: ChangePasswordState = {};

export function ChangePasswordForm({ requireCurrent }: { requireCurrent: boolean }) {
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {requireCurrent ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currentPassword">Kata Sandi Saat Ini</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            required
            maxLength={128}
            autoComplete="current-password"
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">Kata Sandi Baru</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
          aria-describedby="newPassword-hint"
        />
        <p id="newPassword-hint" className="text-xs text-muted-foreground">
          Minimal 10 karakter, berisi huruf dan angka, dan bukan kata sandi umum.
        </p>
      </div>
      <Button type="submit" disabled={pending} className="min-h-11">
        {pending ? "Menyimpan..." : "Simpan Kata Sandi"}
      </Button>
    </form>
  );
}
