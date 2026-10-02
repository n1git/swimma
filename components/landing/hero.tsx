import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { HeroPreview } from "./hero-preview";

export function Hero({ trialDays }: { trialDays: number }) {
  return (
    <section aria-labelledby="hero-judul" className="relative overflow-hidden border-b border-border">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:py-24">
        <div>
          <h1 id="hero-judul" className="text-balance font-heading text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.5rem]">
            Satu aplikasi untuk mengelola semua klub olahraga Anda.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
            Anggota, jadwal dan booking fasilitas, tagihan, kasir, dan buku kas dalam satu tempat. Untuk satu klub atau
            beberapa klub di bawah satu organisasi.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/daftar" className={buttonVariants({ size: "lg", className: "h-12 px-6 text-base" })}>
              {trialDays > 0 ? `Coba gratis ${trialDays} hari` : "Daftarkan klub"}
            </Link>
            <a href="#fitur" className={buttonVariants({ variant: "outline", size: "lg", className: "h-12 px-6 text-base" })}>
              Lihat fitur
            </a>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Anggota tidak dibatasi jumlahnya. Harga dihitung per pengguna internal.</p>
        </div>
        <HeroPreview />
      </div>
    </section>
  );
}
