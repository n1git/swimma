"use client";

import { useEffect, useId, useState } from "react";
import { searchActiveMembers } from "@/lib/actions/lookups";
import type { Lookup } from "@/lib/data/lookups";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function MemberPicker({
  id,
  name,
  required,
  value,
  valueLabel,
  onChange,
  emptyLabel = "Pilih anggota",
  className,
}: {
  id: string;
  name?: string;
  required?: boolean;
  value?: string;
  valueLabel?: string | null;
  onChange?: (id: string) => void;
  emptyLabel?: string;
  className?: string;
}) {
  const hintId = useId();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Lookup[]>([]);
  const [loading, setLoading] = useState(true);
  const [internal, setInternal] = useState("");
  const [picked, setPicked] = useState<Lookup | null>(null);
  const selected = value ?? internal;

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await searchActiveMembers(query).catch(() => []);
      if (active) {
        setOptions(result);
        setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const current =
    selected && !options.some((o) => o.id === selected)
      ? picked?.id === selected
        ? picked
        : { id: selected, name: valueLabel ?? "Anggota terpilih" }
      : null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Input
        type="search"
        aria-label="Cari nama anggota"
        aria-describedby={hintId}
        placeholder="Ketik nama anggota..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        maxLength={100}
        className="h-10"
      />
      <Select
        id={id}
        name={name}
        required={required}
        value={selected}
        className="h-10"
        onChange={(event) => {
          const next = event.target.value;
          setPicked(options.find((o) => o.id === next) ?? null);
          if (value === undefined) setInternal(next);
          onChange?.(next);
        }}
      >
        <option value="">{emptyLabel}</option>
        {current ? <option value={current.id}>{current.name}</option> : null}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
      <p id={hintId} className="text-xs text-muted-foreground" aria-live="polite">
        {loading ? "Mencari..." : options.length === 0 ? "Tidak ada anggota aktif yang cocok." : `Menampilkan ${options.length} anggota teratas. Ketik nama untuk mempersempit.`}
      </p>
    </div>
  );
}
