import { LandingHero } from "./landing-hero";
import { LandingNav } from "./landing-nav";
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
        <LandingHero />
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
