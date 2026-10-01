import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatJakartaDateTime, formatJakartaTime } from "@/lib/format";

interface ClassRow {
  id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  locations: { name: string } | null;
  class_types: { name: string } | null;
  bookings: { count: number }[];
}

export default async function CoachSchedulePage() {
  const session = await getSession();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("classes")
    .select("id, start_time, end_time, capacity, locations(name), class_types(name), bookings(count)")
    .eq("instructor_id", session?.sub)
    .order("start_time");

  const classes = (data ?? []) as unknown as ClassRow[];
  const { data: memberRows } = await supabase
    .from("members")
    .select("id, full_name, contact_name, contact_phone")
    .eq("coach_id", session?.sub)
    .eq("is_active", true)
    .order("full_name");
  const members = memberRows ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Jadwal Saya</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Waktu</TableHead>
            <TableHead>Lokasi</TableHead>
            <TableHead>Jenis</TableHead>
            <TableHead>Peserta</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {classes.map((cls) => (
            <TableRow key={cls.id}>
              <TableCell>
                {formatJakartaDateTime(cls.start_time)} —{" "}
                {formatJakartaTime(cls.end_time)}
              </TableCell>
              <TableCell>{cls.locations?.name ?? "-"}</TableCell>
              <TableCell>{cls.class_types?.name ?? "-"}</TableCell>
              <TableCell>
                {cls.bookings?.[0]?.count ?? 0} / {cls.capacity}
              </TableCell>
              <TableCell>
                <Link href={`/coach/attendance/${cls.id}`} className={buttonVariants({ size: "sm" })}>
                  Absensi
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {classes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Belum ada kelas terjadwal.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <h2 className="text-xl font-semibold">Anggota Saya ({members.length})</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Kontak</TableHead>
            <TableHead>Telepon</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell>{m.full_name}</TableCell>
              <TableCell>{m.contact_name ?? "-"}</TableCell>
              <TableCell>{m.contact_phone ?? "-"}</TableCell>
            </TableRow>
          ))}
          {members.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                Belum ada anggota.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
