import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deleteClass, removeBooking } from "@/lib/actions/schedule";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AddBookingForm } from "@/components/schedule/add-booking-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatJakartaDateTime, formatJakartaTime } from "@/lib/format";
import { ActionForm } from "@/components/shared/action-form";

export default async function ClassDetailModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: cls }, { data: bookings }, { data: allMembers }] = await Promise.all([
    supabase
      .from("classes")
      .select(
        "id, start_time, end_time, capacity, profiles(full_name), locations(name), class_types(name)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select("id, is_attended, members(id, full_name)")
      .eq("class_id", id),
    supabase.from("members").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);

  if (!cls) notFound();

  const bookedMemberIds = new Set(
    (bookings ?? []).map((b) => (b as unknown as { members: { id: string } }).members.id)
  );
  const availableMembers = (allMembers ?? [])
    .filter((c) => !bookedMemberIds.has(c.id))
    .map((c) => ({ id: c.id, name: c.full_name }));

  const info = cls as unknown as {
    start_time: string;
    end_time: string;
    capacity: number;
    profiles: { full_name: string } | null;
    locations: { name: string } | null;
    class_types: { name: string } | null;
  };

  return (
    <Dialog className="max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{info.class_types?.name ?? "Kelas"}</h2>
          <p className="text-sm text-muted-foreground">
            {formatJakartaDateTime(info.start_time)} —{" "}
            {formatJakartaTime(info.end_time)} · {info.locations?.name} ·{" "}
            {info.profiles?.full_name}
          </p>
        </div>
        <ActionForm action={deleteClass}>
          <input type="hidden" name="classId" value={id} />
          <ActionSubmitButton
            variant="destructive"
            size="sm"
            confirmMessage={`Hapus kelas ini beserta ${(bookings ?? []).length} pendaftaran yang ada? Tindakan ini tidak bisa dibatalkan.`}
          >
            Hapus Kelas
          </ActionSubmitButton>
        </ActionForm>
      </div>

      <h3 className="mt-4 mb-2 text-sm font-semibold text-muted-foreground">
        Peserta ({(bookings ?? []).length} / {info.capacity})
      </h3>
      <div className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Anggota</TableHead>
              <TableHead>Kehadiran</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(bookings ?? []).map((b) => {
              const booking = b as unknown as {
                id: string;
                is_attended: boolean;
                members: { full_name: string };
              };
              return (
                <TableRow key={booking.id}>
                  <TableCell>{booking.members.full_name}</TableCell>
                  <TableCell>{booking.is_attended ? "Hadir" : "Belum"}</TableCell>
                  <TableCell>
                    <ActionForm action={removeBooking}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <input type="hidden" name="classId" value={id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Batalkan Pendaftaran
                      </Button>
                    </ActionForm>
                  </TableCell>
                </TableRow>
              );
            })}
            {(bookings ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Belum ada peserta.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <AddBookingForm classId={id} availableMembers={availableMembers} />
      </div>
    </Dialog>
  );
}
