import type { Metadata } from "next";

import { LandingPage } from "@/features/landing/components/landing-page";

export const metadata: Metadata = {
  title: "FacilityOps | Smarter Facility Operations",
  description:
    "FacilityOps is an enterprise facility management platform for FM ticketing, maintenance work orders, 5S inspections, notifications, and secure operational evidence.",
  openGraph: {
    title: "FacilityOps | Smarter Facility Operations",
    description:
      "One connected platform for facility tickets, maintenance, inspections, and administration.",
    type: "website",
    siteName: "FacilityOps",
  },
  twitter: {
    card: "summary_large_image",
    title: "FacilityOps | Smarter Facility Operations",
    description:
      "Enterprise facility operations platform for modern service teams.",
  },
};

export default function HomePage() {
  return <LandingPage />;
}
