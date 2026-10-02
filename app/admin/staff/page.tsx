import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { toggleStaffActive } from "@/lib/actions/staff";
import { ROLE_LABEL, STAFF_ROLES, type AppRole } from "@/lib/auth/roles";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { ResetPasswordForm } from "@/components/shared/reset-password-form";
import { StaffForm } from "@/components/shared/staff-form";
import { buttonVariants } from "@/components/ui/button";
import { TriggerDialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ROLE_DESCRIPTION: Record<string, string> = {
  admin: "Semua menu klub",
  receptionist: "Anggota, jadwal, booking, presensi, terima pembayaran",
  finance: "Tagihan, paket, langganan, buku kas, gaji, laporan",
};

export default async function StaffPage() {
  const [supabase, session] = await Promise.all([createServerSupabaseClient(), getSession()]);
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, is_active, owner_id")
    .in("role", [...STAFF_ROLES])
    .order("full_name");
  const staff = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Staf</h1>
        <TriggerDialog trigger={<span className={buttonVariants({})}>Tambah Staf</span>}>
          <h2 className="mb-4 text-xl font-semibold">Tambah Staf</h2>
          <StaffForm />
        </TriggerDialog>
      </div>
      <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
        {STAFF_ROLES.map((role) => (
          <li key={role}>
            <span className="font-medium text-foreground">{ROLE_LABEL[role]}</span>: {ROLE_DESCRIPTION[role]}
          </li>
        ))}
      </ul>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Peran</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.map((p) => {
            const manageable = !p.owner_id && p.id !== session?.sub;
            return (
              <TableRow key={p.id}>
                <TableCell>{p.full_name}</TableCell>
                <TableCell>{p.email}</TableCell>
                <TableCell>{p.owner_id ? "Pemilik" : ROLE_LABEL[p.role as AppRole]}</TableCell>
                <TableCell>
                  <Badge variant={p.is_active ? "success" : "secondary"}>{p.is_active ? "Aktif" : "Nonaktif"}</Badge>
                </TableCell>
                <TableCell>
                  {manageable ? (
                    <div className="flex flex-col gap-2">
                      <ActionForm action={toggleStaffActive}>
                        <input type="hidden" name="profileId" value={p.id} />
                        <input type="hidden" name="isActive" value={(!p.is_active).toString()} />
                        <ActionSubmitButton
                          size="sm"
                          variant={p.is_active ? "destructive" : "secondary"}
                          confirmMessage={p.is_active ? "Nonaktifkan staf ini? Staf tidak bisa login sampai diaktifkan kembali." : undefined}
                        >
                          {p.is_active ? "Nonaktifkan" : "Aktifkan Kembali"}
                        </ActionSubmitButton>
                      </ActionForm>
                      <ResetPasswordForm profileId={p.id} label="staf" />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {staff.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Belum ada staf.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
