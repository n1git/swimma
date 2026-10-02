import { requireRole } from "@/lib/auth/guard";
import { getProducts, getUnpaidBookings } from "@/lib/data/commerce";
import { getActiveMembers } from "@/lib/data/lookups";
import { isModuleReady } from "@/lib/modules";
import { PosTerminal } from "@/components/pos/pos-terminal";

export default async function CashierPage() {
  await requireRole(["admin", "receptionist"]);
  const bookingOn = await isModuleReady("resource_booking");
  const [products, bookings, members] = await Promise.all([
    getProducts({ activeOnly: true }),
    bookingOn ? getUnpaidBookings() : Promise.resolve([]),
    getActiveMembers(),
  ]);

  return (
    <div className="flex flex-col gap-4 pb-16 lg:pb-0">
      <div>
        <h1 className="text-2xl font-semibold">Kasir</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pilih item, catat pembayaran, lalu cetak struk.</p>
      </div>
      <PosTerminal products={products} bookings={bookings} members={members} />
    </div>
  );
}
