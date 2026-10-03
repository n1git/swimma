"use client";

import { useActionState, useState } from "react";
import { createProduct, updateProduct } from "@/lib/actions/products";
import type { Product } from "@/lib/commerce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActionToast } from "@/components/shared/use-action-toast";

export function ProductForm({ product, categories }: { product?: Product; categories: string[] }) {
  const [state, formAction, pending] = useActionState(product ? updateProduct : createProduct, {});
  useActionToast(state, "Disimpan");
  const [track, setTrack] = useState(product?.trackStock ?? false);
  const id = product?.id ?? "new";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {product ? <input type="hidden" name="productId" value={product.id} /> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`pf-name-${id}`}>Nama produk</Label>
        <Input id={`pf-name-${id}`} name="name" defaultValue={product?.name} required maxLength={120} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`pf-price-${id}`}>Harga (Rp)</Label>
          <Input id={`pf-price-${id}`} name="price" type="number" min={0} step={500} defaultValue={product?.price ?? 0} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`pf-sku-${id}`}>SKU (opsional)</Label>
          <Input id={`pf-sku-${id}`} name="sku" defaultValue={product?.sku ?? ""} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`pf-cat-${id}`}>Kategori (opsional)</Label>
        <Input id={`pf-cat-${id}`} name="category" list={`pf-cats-${id}`} defaultValue={product?.category ?? ""} />
        <datalist id={`pf-cats-${id}`}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="trackStock" checked={track} onChange={(e) => setTrack(e.target.checked)} className="size-4" />
        Lacak stok
      </label>
      {track ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`pf-stock-${id}`}>Jumlah stok</Label>
          <Input id={`pf-stock-${id}`} name="stockQty" type="number" min={0} step={1} defaultValue={product?.stockQty ?? 0} required />
          <p className="text-xs text-muted-foreground">Stok berkurang saat pesanan lunas dan kembali saat pesanan dibatalkan.</p>
        </div>
      ) : null}
      <Button type="submit" disabled={pending} className="h-10 w-fit">
        {pending ? "Menyimpan..." : product ? "Simpan" : "Tambah produk"}
      </Button>
    </form>
  );
}
