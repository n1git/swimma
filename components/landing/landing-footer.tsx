import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { getContact } from "@/lib/site";
import { LANDING_LINKS } from "./nav-links";

export function LandingFooter() {
  const contact = getContact();
  const linkClass = "rounded-sm transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 text-sm text-muted-foreground sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <p className="font-heading text-base font-semibold text-primary">{APP_NAME}</p>
          <p>Aplikasi pengelolaan klub olahraga: anggota, jadwal, booking, tagihan, kasir, dan buku kas.</p>
        </div>
        <nav aria-label="Bagian halaman">
          <p className="mb-3 font-semibold text-foreground">Produk</p>
          <ul className="flex flex-col gap-2">
            {LANDING_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={linkClass}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Akun dan legal">
          <p className="mb-3 font-semibold text-foreground">Akun & legal</p>
          <ul className="flex flex-col gap-2">
            <li>
              <Link href="/daftar" className={linkClass}>Daftarkan klub</Link>
            </li>
            <li>
              <Link href="/login" className={linkClass}>Masuk</Link>
            </li>
            <li>
              <Link href="/privasi" className={linkClass}>Kebijakan privasi</Link>
            </li>
            <li>
              <Link href="/syarat" className={linkClass}>Syarat & ketentuan</Link>
            </li>
          </ul>
        </nav>
        {contact.email || contact.whatsappUrl ? (
          <div>
            <p className="mb-3 font-semibold text-foreground">Kontak</p>
            <ul className="flex flex-col gap-2">
              {contact.email ? (
                <li>
                  <a href={`mailto:${contact.email}`} className={linkClass}>{contact.email}</a>
                </li>
              ) : null}
              {contact.whatsappUrl ? (
                <li>
                  <a href={contact.whatsappUrl} className={linkClass} rel="noopener noreferrer" target="_blank">
                    WhatsApp
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} {APP_NAME}. Waktu di aplikasi ditampilkan dalam WIB.
        </p>
      </div>
    </footer>
  );
}
