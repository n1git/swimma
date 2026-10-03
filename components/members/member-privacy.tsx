"use client";

import { anonymiseMember } from "@/lib/actions/privacy";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function MemberPrivacy({ memberId }: { memberId: string }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold leading-none tracking-tight">Data pribadi</h2>
        <CardDescription>Ekspor data anggota ini, atau anonimkan atas permintaan anggota atau walinya.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <a href={`/api/members/${memberId}/export`} className={buttonVariants({ variant: "outline", className: "min-h-11 w-fit" })} download>
          Unduh data anggota (JSON)
        </a>
        <ActionForm action={anonymiseMember} className="flex flex-col gap-3">
          <input type="hidden" name="memberId" value={memberId} />
          <p className="text-sm text-muted-foreground">
            Anonimisasi menghapus nama, kontak, alamat, catatan, dan akun login anggota. Tagihan, pembayaran, dan kehadiran
            tetap tersimpan tanpa identitas. Tindakan ini tidak bisa dibatalkan.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="anon-reason">Alasan</Label>
            <Textarea id="anon-reason" name="reason" required minLength={5} maxLength={500} rows={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="anon-confirm">Ketik ANONIMKAN untuk mengonfirmasi</Label>
            <Input id="anon-confirm" name="confirm" required autoComplete="off" pattern="ANONIMKAN" className="max-w-xs" />
          </div>
          <ActionSubmitButton
            variant="destructive"
            className="min-h-11 w-fit"
            confirmMessage="Anonimkan anggota ini? Identitasnya dihapus permanen."
          >
            Anonimkan anggota
          </ActionSubmitButton>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
