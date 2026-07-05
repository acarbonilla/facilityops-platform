import type { NavigationItem } from "@/types/rbac";

export const APP_NAVIGATION: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    authenticatedOnly: true,
  },
  {
    label: "Master Data",
    href: "/master-data",
    authenticatedOnly: true,
    requiredPermissions: ["settings.view"],
  },
  {
    label: "Users",
    href: "/users",
    authenticatedOnly: true,
    requiredPermissions: ["users.view"],
  },
  {
    label: "Roles & Permissions",
    href: "/roles",
    authenticatedOnly: true,
    requiredPermissions: ["roles.view"],
  },
  {
    label: "Settings",
    href: "/settings",
    authenticatedOnly: true,
    requiredPermissions: ["settings.view"],
  },
];
