import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, type OrderDetail } from "@/lib/commerce";
import { formatJakartaDateTime, formatRupiahFull } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function Receipt({ order, clubName }: { order: OrderDetail; clubName: string }) {
  const customer = order.memberName ?? order.customerName;
  return (
    <article className="mx-auto w-full max-w-md rounded-lg border border-border bg-card p-5 print:max-w-none print:border-0 print:p-0">
      <header className="flex flex-col gap-1 border-b border-dashed border-border pb-3">
        <p className="text-base font-semibold">{clubName}</p>
        <p className="text-xs text-muted-foreground">
          {order.number} · {formatJakartaDateTime(order.createdAt)}
        </p>
        {customer ? <p className="text-xs text-muted-foreground">Pelanggan: {customer}</p> : null}
        <div className="print:hidden">
          <Badge variant={order.status === "paid" ? "success" : order.status === "void" ? "destructive" : "warning"}>
            {ORDER_STATUS_LABEL[order.status]}
          </Badge>
        </div>
        <p className="hidden text-xs font-medium print:block">{ORDER_STATUS_LABEL[order.status]}</p>
      </header>
      <ul className="flex flex-col divide-y divide-border py-2 text-sm">
        {order.items.map((i) => (
          <li key={i.id} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="font-medium">{i.description}</p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {i.qty} × {formatRupiahFull(i.unitPrice)}
              </p>
            </div>
            <span className="tabular-nums">{formatRupiahFull(i.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-1 border-t border-dashed border-border pt-3 text-sm">
        <div className="flex justify-between font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatRupiahFull(order.total)}</dd>
        </div>
        {order.payments.map((p) => (
          <div key={p.id} className="flex justify-between text-muted-foreground">
            <dt>
              {PAYMENT_METHOD_LABEL[p.method] ?? p.method}
              {p.reference ? ` (${p.reference})` : ""}
            </dt>
            <dd className="tabular-nums">{formatRupiahFull(p.amount)}</dd>
          </div>
        ))}
        {order.status === "open" ? (
          <div className="flex justify-between font-medium">
            <dt>Sisa</dt>
            <dd className="tabular-nums">{formatRupiahFull(order.total - order.paid)}</dd>
          </div>
        ) : null}
      </dl>
      <p className="pt-4 text-center text-xs text-muted-foreground">Terima kasih</p>
    </article>
  );
}
