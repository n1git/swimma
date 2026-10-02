import { LandingFooter } from "./landing-footer";
import { LandingHeader, SkipLink } from "./landing-header";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SkipLink />
      <LandingHeader />
      <main id="konten" className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <p role="note" className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
          <strong>Draf.</strong> Halaman ini masih rancangan dan belum ditinjau ahli hukum. Isinya menggambarkan cara kerja
          aplikasi saat ini dan bukan pernyataan kepatuhan terhadap peraturan apa pun.
        </p>
        <h1 className="mt-8 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Versi draf, {updated}</p>
        <div className="mt-8 flex flex-col gap-6 leading-relaxed [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
          {children}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
