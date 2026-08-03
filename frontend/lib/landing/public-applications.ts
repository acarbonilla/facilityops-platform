/** Configurable public applications shown on the FacilityOps landing page. */

export type PublicApplicationStatus = "available" | "coming_soon" | "beta";

export type PublicApplication = {
  id: string;
  name: string;
  description: string;
  icon: "facilityops" | "analytics" | "mobile" | "ai";
  status: PublicApplicationStatus;
  href: string;
  external: boolean;
};

export const PUBLIC_APPLICATIONS: PublicApplication[] = [
  {
    id: "facilityops",
    name: "FacilityOps",
    description:
      "Integrated Facility Management Platform for tickets, maintenance, inspections, and administration.",
    icon: "facilityops",
    status: "available",
    href: "/login",
    external: false,
  },
];

export function getPublicApplicationStatusLabel(
  status: PublicApplicationStatus,
): string {
  switch (status) {
    case "available":
      return "Available";
    case "beta":
      return "Beta";
    case "coming_soon":
      return "Coming soon";
    default:
      return "Unavailable";
  }
}
