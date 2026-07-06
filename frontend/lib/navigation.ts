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
    label: "Admin",
    href: "/admin",
    authenticatedOnly: true,
    requiredPermissions: ["users.view", "roles.view", "roles.manage", "settings.view"],
    permissionMode: "any",
    matchStrategy: "exact",
  },
  {
    label: "Organization",
    href: "/admin/organization",
    authenticatedOnly: true,
    requiredPermissions: ["settings.view"],
    matchStrategy: "prefix",
  },
  {
    label: "Admin Assets",
    href: "/admin/assets",
    authenticatedOnly: true,
    requiredPermissions: ["settings.view"],
    matchStrategy: "prefix",
  },
  {
    label: "Users",
    href: "/admin/users",
    authenticatedOnly: true,
    requiredPermissions: ["users.view"],
    matchStrategy: "prefix",
  },
  {
    label: "Roles",
    href: "/admin/roles",
    authenticatedOnly: true,
    requiredPermissions: ["roles.view"],
    matchStrategy: "prefix",
  },
  {
    label: "Permissions",
    href: "/admin/permissions",
    authenticatedOnly: true,
    requiredPermissions: ["roles.manage"],
    matchStrategy: "prefix",
  },
  {
    label: "Settings",
    href: "/settings",
    authenticatedOnly: true,
    requiredPermissions: ["settings.view"],
    matchStrategy: "exact",
  },
];
