"use client";

import { useMemo, useState } from "react";
import { markAttendance, updateBookingNotes } from "@/lib/actions/attendance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActionForm } from "@/components/shared/action-form";

export interface AttendanceBooking {
  id: string;
  isAttended: boolean;
  notes: string | null;
  memberName: string;
}

export function AttendanceRoster({
  classId,
  bookings,
  readOnly = false,
}: {
  classId: string;
  bookings: AttendanceBooking[];
  readOnly?: boolean;
}) {
  const [search, setSearch] = useState("");
  const attendedCount = bookings.filter((b) => b.isAttended).length;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return bookings;
    return bookings.filter((b) => b.memberName.toLowerCase().includes(term));
  }, [bookings, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Badge variant={bookings.length > 0 && attendedCount === bookings.length ? "success" : "secondary"}>
          {attendedCount} / {bookings.length} Hadir
        </Badge>
      </div>

      {bookings.length > 5 ? (
        <Input
          placeholder="Cari nama anggota..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama Anggota</TableHead>
            <TableHead>Kehadiran</TableHead>
            <TableHead>{readOnly ? "Catatan" : "Catatan (opsional)"}</TableHead>
            {readOnly ? null : <TableHead>Aksi</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="font-medium">{b.memberName}</TableCell>
              <TableCell>
                <Badge variant={b.isAttended ? "success" : "outline"}>
                  {b.isAttended ? "Hadir" : "Belum Hadir"}
                </Badge>
              </TableCell>
              {readOnly ? (
                <TableCell>{b.notes ?? "-"}</TableCell>
              ) : (
              <TableCell>
                <ActionForm action={updateBookingNotes}>
                  <input type="hidden" name="bookingId" value={b.id} />
                  <input type="hidden" name="classId" value={classId} />
                  <Input
                    name="notes"
                    defaultValue={b.notes ?? ""}
                    placeholder="Tambahkan catatan..."
                    className="min-w-40"
                    onBlur={(e) => {
                      if (e.target.value === (b.notes ?? "")) return;
                      e.currentTarget.form?.requestSubmit();
                    }}
                  />
                </ActionForm>
              </TableCell>
              )}
              {readOnly ? null : (
              <TableCell>
                <ActionForm action={markAttendance}>
                  <input type="hidden" name="bookingId" value={b.id} />
                  <input type="hidden" name="classId" value={classId} />
                  <input type="hidden" name="isAttended" value={(!b.isAttended).toString()} />
                  <Button type="submit" size="sm" variant={b.isAttended ? "outline" : "default"}>
                    {b.isAttended ? "Tandai Belum Hadir" : "Tandai Hadir"}
                  </Button>
                </ActionForm>
              </TableCell>
              )}
            </TableRow>
          ))}
          {visible.length === 0 ? (
            <TableRow>
              <TableCell colSpan={readOnly ? 3 : 4} className="text-center text-muted-foreground">
                {bookings.length === 0
                  ? "Belum ada peserta terdaftar di kelas ini."
                  : "Tidak ada anggota yang cocok dengan pencarian."}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
