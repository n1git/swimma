import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function FinalCta({ trialDays }: { trialDays: number }) {
  return (
    <section aria-labelledby="mulai-judul" className="bg-primary py-16 text-primary-foreground sm:py-20">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 id="mulai-judul" className="text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Mulai kelola klub Anda di satu tempat.
          </h2>
          <p className="mt-3 max-w-xl opacity-90">Daftar, pilih jenis klub, lalu ikuti penyiapan klub langkah demi langkah.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/daftar" className={buttonVariants({ variant: "secondary", size: "lg", className: "h-12 px-6 text-base" })}>
            {trialDays > 0 ? `Coba gratis ${trialDays} hari` : "Daftarkan klub"}
          </Link>
          <Link
            href="/login"
            className={buttonVariants({
              variant: "ghost",
              size: "lg",
              className: "h-12 px-6 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
            })}
          >
            Masuk
          </Link>
        </div>
      </div>
    </section>
  );
}
