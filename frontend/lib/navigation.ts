import type { NavigationItem } from "@/types/rbac";
import { MASTER_DATA_RESOURCES } from "@/lib/master-data/resources";

export const APP_NAVIGATION: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    authenticatedOnly: true,
    matchStrategy: "exact",
  },
  {
    label: "Master Data",
    href: "/master-data",
    authenticatedOnly: true,
    requiredPermissions: ["settings.view"],
    matchStrategy: "exact",
  },
  ...MASTER_DATA_RESOURCES.map<NavigationItem>((resource) => ({
    label: resource.label,
    href: resource.href,
    authenticatedOnly: true,
    requiredPermissions: ["settings.view"],
    matchStrategy: "exact",
  })),
  {
    label: "Users",
    href: "/users",
    authenticatedOnly: true,
    requiredPermissions: ["users.view"],
    matchStrategy: "exact",
  },
  {
    label: "Roles & Permissions",
    href: "/roles",
    authenticatedOnly: true,
    requiredPermissions: ["roles.view"],
    matchStrategy: "exact",
  },
  {
    label: "Settings",
    href: "/settings",
    authenticatedOnly: true,
    requiredPermissions: ["settings.view"],
    matchStrategy: "exact",
  },
];
