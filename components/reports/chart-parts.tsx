export const TOOLTIP_STYLE = {
  backgroundColor: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-card-foreground)",
  borderRadius: 8,
  fontSize: 12,
};

export const TOOLTIP_TEXT = { color: "var(--color-card-foreground)" };

export const AXIS_TICK = { fill: "var(--color-muted-foreground)", fontSize: 12 };

export function ChartTotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-[2rem] font-semibold leading-tight tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

export function ChartTable({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r[0]}>
            {r.map((c, i) => (i === 0 ? <th key={i} scope="row">{c}</th> : <td key={i}>{c}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
