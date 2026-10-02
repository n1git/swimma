import { createServerSupabaseClient } from "@/lib/supabase/server";
import { addCertification, deleteCertification } from "@/lib/actions/coaches";
import { certificationStatus } from "@/lib/certifications";
import { formatJakartaDate } from "@/lib/format";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_BADGE = {
  valid: null,
  expiring: { variant: "warning", label: "Segera habis" },
  expired: { variant: "destructive", label: "Kedaluwarsa" },
} as const;

export async function CoachCertifications({ coachId }: { coachId: string }) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("coach_certifications")
    .select("id, name, number, valid_until")
    .eq("coach_id", coachId)
    .order("valid_until", { ascending: true, nullsFirst: false });
  const certifications = data ?? [];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Sertifikasi ({certifications.length})</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Nomor</TableHead>
            <TableHead>Berlaku Sampai</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {certifications.map((c) => {
            const badge = STATUS_BADGE[certificationStatus(c.valid_until)];
            return (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.number ?? "-"}</TableCell>
                <TableCell>
                  <span className="flex flex-wrap items-center gap-2">
                    {c.valid_until ? formatJakartaDate(`${c.valid_until}T00:00:00+07:00`) : "Tanpa batas"}
                    {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
                  </span>
                </TableCell>
                <TableCell>
                  <ActionForm action={deleteCertification}>
                    <input type="hidden" name="certificationId" value={c.id} />
                    <input type="hidden" name="coachId" value={coachId} />
                    <ActionSubmitButton size="sm" variant="ghost" confirmMessage="Hapus sertifikasi ini?">
                      Hapus
                    </ActionSubmitButton>
                  </ActionForm>
                </TableCell>
              </TableRow>
            );
          })}
          {certifications.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Belum ada sertifikasi.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
      <ActionForm action={addCertification} className="grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="coachId" value={coachId} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="certName">Nama Sertifikasi</Label>
          <Input id="certName" name="name" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="certNumber">Nomor</Label>
          <Input id="certNumber" name="number" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="certValidUntil">Berlaku Sampai</Label>
          <Input id="certValidUntil" name="validUntil" type="date" />
        </div>
        <ActionSubmitButton size="sm" variant="outline" className="w-fit">
          Tambah Sertifikasi
        </ActionSubmitButton>
      </ActionForm>
    </section>
  );
}
