import { LandingHero } from "./landing-hero";
import { LandingNav } from "./landing-nav";
import { LivePlatformPreview } from "./preview/live-platform-preview";
import {
  ApplicationsSection,
  BenefitsSection,
  FinalCtaSection,
  FutureAiSection,
  LandingFooter,
  ModulesSection,
  SecuritySection,
  TrustSection,
  WorkflowSection,
} from "./landing-sections";

export function LandingPage() {
  return (
    <div id="top" className="min-h-screen bg-slate-50 text-slate-950">
      <LandingNav />
      <main>
        <div className="bg-[#07111f] pb-4 sm:pb-8">
          <LandingHero />
          <LivePlatformPreview />
        </div>
        <TrustSection />
        <ModulesSection />
        <WorkflowSection />
        <BenefitsSection />
        <ApplicationsSection />
        <SecuritySection />
        <FutureAiSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
