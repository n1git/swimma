import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatJakartaDateTime } from "@/lib/format";
import type { CheckinRow } from "@/lib/data/checkin";

export function VisitTable({ rows, showMember = false }: { rows: CheckinRow[]; showMember?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showMember ? <TableHead>Anggota</TableHead> : null}
          <TableHead>Waktu</TableHead>
          <TableHead>Titik</TableHead>
          <TableHead>Paket</TableHead>
          <TableHead>Cara</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            {showMember ? <TableCell className="font-medium">{row.memberName}</TableCell> : null}
            <TableCell>{formatJakartaDateTime(row.checkedInAt)}</TableCell>
            <TableCell>{row.pointName ?? "-"}</TableCell>
            <TableCell>{row.planName ?? "-"}</TableCell>
            <TableCell>
              <Badge variant="secondary">{row.method === "qr" ? "QR" : "Manual"}</Badge>
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showMember ? 5 : 4} className="text-center text-muted-foreground">
              Belum ada kunjungan.
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
