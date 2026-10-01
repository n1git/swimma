import { createServerSupabaseClient } from "@/lib/supabase/server";
import { markInvoicePaid, voidInvoice } from "@/lib/actions/billing";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { ListFilters } from "@/components/shared/list-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GenerateInvoicesForm } from "@/components/billing/generate-invoices-form";
import { ActionForm } from "@/components/shared/action-form";

const STATUS_VARIANT: Record<string, "success" | "secondary" | "destructive"> = {
  paid: "success",
  outstanding: "secondary",
  void: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Lunas",
  outstanding: "Belum Bayar",
  void: "Dibatalkan",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("invoices")
    .select("id, amount, status, due_date, period_start, period_end, members!inner(full_name)")
    .order("due_date", { ascending: false });
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("members.full_name", `%${q}%`);
  const { data: invoices } = await query;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Tagihan</h1>
      <h2 className="text-sm font-semibold text-muted-foreground">Daftar Tagihan</h2>
      <ListFilters
        fields={[
          { type: "search", name: "q", placeholder: "Cari nama anggota..." },
          {
            type: "select",
            name: "status",
            placeholder: "Semua Status",
            options: [
              { value: "outstanding", label: "Belum Bayar" },
              { value: "paid", label: "Lunas" },
              { value: "void", label: "Dibatalkan" },
            ],
          },
        ]}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Anggota</TableHead>
            <TableHead>Periode</TableHead>
            <TableHead>Jatuh Tempo</TableHead>
            <TableHead>Jumlah</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(invoices ?? []).map((inv) => {
            const row = inv as unknown as {
              id: string;
              amount: number;
              status: string;
              due_date: string;
              period_start: string;
              period_end: string;
              members: { full_name: string } | null;
            };
            return (
              <TableRow key={row.id}>
                <TableCell>{row.members?.full_name ?? "-"}</TableCell>
                <TableCell>
                  {row.period_start} – {row.period_end}
                </TableCell>
                <TableCell>{row.due_date}</TableCell>
                <TableCell>Rp {Number(row.amount).toLocaleString("id-ID")}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[row.status] ?? "secondary"}>
                    {STATUS_LABEL[row.status] ?? row.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {row.status === "outstanding" ? (
                    <div className="flex gap-2">
                      <ActionForm action={markInvoicePaid}>
                        <input type="hidden" name="invoiceId" value={row.id} />
                        <ActionSubmitButton size="sm">
                          Tandai Lunas
                        </ActionSubmitButton>
                      </ActionForm>
                      <ActionForm action={voidInvoice}>
                        <input type="hidden" name="invoiceId" value={row.id} />
                        <ActionSubmitButton
                          size="sm"
                          variant="ghost"
                          confirmMessage="Batalkan tagihan ini? Tindakan ini tidak bisa dibatalkan."
                        >
                          Batalkan Tagihan
                        </ActionSubmitButton>
                      </ActionForm>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
          {(invoices ?? []).length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Belum ada tagihan.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Buat Tagihan Periode Berjalan</CardTitle>
        </CardHeader>
        <CardContent>
          <GenerateInvoicesForm />
        </CardContent>
      </Card>
    </div>
  );
}
