import { headers } from "next/headers";
import { APP_NAME } from "@/lib/config";
import type { PricingPlan } from "@/lib/pricing";
import { SITE_URL } from "@/lib/site";

export async function JsonLd({ plans }: { plans: PricingPlan[] }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: APP_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}/`,
    inLanguage: "id",
    description:
      "Satu aplikasi untuk mengelola klub olahraga: anggota, jadwal dan booking fasilitas, tagihan, kasir, dan buku kas.",
    offers: plans.map((p) => ({
      "@type": "Offer",
      name: p.name,
      priceCurrency: "IDR",
      price: p.pricePerUserMonth,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: p.pricePerUserMonth,
        priceCurrency: "IDR",
        unitText: "pengguna internal per bulan",
      },
      url: `${SITE_URL}/daftar?plan=${p.code}`,
    })),
  };
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
