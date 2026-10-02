import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { roleHome } from "@/lib/auth/roles";
import { getPublicClubTypes } from "@/lib/club-type";
import { getActivePlans, getModules } from "@/lib/data/platform-pricing";
import { LandingPricing } from "@/components/pricing/landing-pricing";
import { LandingHeader, SkipLink } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Hero } from "@/components/landing/hero";
import { SportsSection } from "@/components/landing/sports-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { MultiClub } from "@/components/landing/multi-club";
import { Section } from "@/components/landing/section";

export default async function Home() {
  const session = await getSession();
  if (session) redirect(roleHome(session.app_role));
  const [plans, modules, clubTypes] = await Promise.all([getActivePlans(), getModules(), getPublicClubTypes()]);
  const trialDays = Math.max(0, ...plans.map((p) => p.trialDays));
  const readyModules = modules.filter((m) => m.status === "ready").map((m) => m.code);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SkipLink />
      <LandingHeader />
      <main id="konten" className="flex flex-1 flex-col">
        <Hero trialDays={trialDays} />
        <SportsSection types={clubTypes} readyModules={readyModules} />
        <FeaturesSection modules={modules} />
        <HowItWorks />
        <MultiClub plans={plans} />
        <Section id="harga" eyebrow="Harga" title="Satu langganan per organisasi, sesuai jumlah pengguna internal.">
          <LandingPricing plans={plans} modules={modules} />
        </Section>
      </main>
      <LandingFooter />
    </div>
  );
}
