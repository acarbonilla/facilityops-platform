import { REPORTING_PERMISSION } from "@/lib/reporting/navigation";

export { REPORTING_PERMISSION };

export interface DashboardQuickLink {
  href: string;
  label: string;
  /** Accessible name when it should differ from the visible label. */
  accessibleName?: string;
  kind: "master-data" | "reporting";
}

export const DASHBOARD_MASTER_DATA_LINKS: readonly DashboardQuickLink[] = [
  {
    href: "/master-data",
    label: "Master Data",
    accessibleName: "Open Master Data",
    kind: "master-data",
  },
  {
    href: "/master-data/tenants",
    label: "Tenants",
    accessibleName: "Open Tenants master data",
    kind: "master-data",
  },
  {
    href: "/master-data/organizations",
    label: "Organizations",
    accessibleName: "Open Organizations master data",
    kind: "master-data",
  },
  {
    href: "/master-data/buildings",
    label: "Buildings",
    accessibleName: "Open Buildings master data",
    kind: "master-data",
  },
  {
    href: "/master-data/assets",
    label: "Assets",
    accessibleName: "Open Assets master data",
    kind: "master-data",
  },
] as const;

export const DASHBOARD_REPORTING_LINK: DashboardQuickLink = {
  href: "/reporting",
  label: "View Operational Reporting",
  accessibleName: "View Operational Reporting",
  kind: "reporting",
};

export const MASTER_DATA_QUICK_LINK_PERMISSION = "settings.view";

/**
 * Permission-aware visibility for Dashboard quick links.
 * Hidden while permissions load, on permission lookup failure, or when absent.
 * Never returns a disabled placeholder for inaccessible destinations.
 */
export function getVisibleDashboardQuickLinks(options: {
  permissionsLoading: boolean;
  permissionsError: boolean;
  canViewMasterData: boolean;
  canViewReporting: boolean;
}): DashboardQuickLink[] {
  const {
    permissionsLoading,
    permissionsError,
    canViewMasterData,
    canViewReporting,
  } = options;

  if (permissionsLoading || permissionsError) {
    return [];
  }

  const links: DashboardQuickLink[] = [];

  if (canViewMasterData) {
    links.push(...DASHBOARD_MASTER_DATA_LINKS);
  }

  if (canViewReporting) {
    links.push(DASHBOARD_REPORTING_LINK);
  }

  return links;
}

export function shouldShowDashboardReportingLink(options: {
  permissionsLoading: boolean;
  permissionsError: boolean;
  canViewReporting: boolean;
}): boolean {
  return getVisibleDashboardQuickLinks({
    ...options,
    canViewMasterData: false,
  }).some((link) => link.kind === "reporting");
}
