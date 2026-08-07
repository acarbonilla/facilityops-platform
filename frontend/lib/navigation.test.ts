import assert from "node:assert/strict";
import test from "node:test";

import type { NavigationItem } from "@/types/rbac";

import { APP_NAVIGATION } from "./navigation";
import { filterNavigationForEmployeeRequester } from "./my-requests/navigation";

function authOptions(overrides: {
  roles: string[];
  permissions: string[];
}) {
  const permissionSet = new Set(overrides.permissions);
  return {
    isAuthenticated: true,
    roles: overrides.roles,
    permissions: overrides.permissions,
    permissionsLoading: false,
    permissionsError: false,
    hasPermission: (code: string) => permissionSet.has(code),
    hasAnyPermission: (codes: string[]) =>
      codes.some((code) => permissionSet.has(code)),
  };
}

test("APP_NAVIGATION registers Projects after Maintenance with projects.view", () => {
  const maintenanceIndex = APP_NAVIGATION.findIndex(
    (item) => item.href === "/maintenance",
  );
  const projectsIndex = APP_NAVIGATION.findIndex(
    (item) => item.href === "/projects",
  );
  const myWorkIndex = APP_NAVIGATION.findIndex(
    (item) => item.href === "/my-work",
  );

  assert.ok(maintenanceIndex >= 0, "Maintenance nav item missing");
  assert.ok(projectsIndex >= 0, "Projects nav item missing");
  assert.ok(
    projectsIndex === maintenanceIndex + 1,
    "Projects must appear immediately after Maintenance",
  );
  assert.ok(myWorkIndex === projectsIndex + 1, "My Work must follow Projects");

  const projects = APP_NAVIGATION[projectsIndex] as NavigationItem;
  assert.equal(projects.label, "Projects");
  assert.deepEqual(projects.requiredPermissions, ["projects.view"]);
  assert.equal(projects.matchStrategy, "prefix");
  assert.equal(projects.authenticatedOnly, true);

  const myWork = APP_NAVIGATION[myWorkIndex] as NavigationItem;
  assert.equal(myWork.label, "My Work");
  assert.equal(myWork.matchStrategy, "prefix");
});

test("facility manager with projects.view sees Projects in sidebar filter", () => {
  const visible = filterNavigationForEmployeeRequester(
    APP_NAVIGATION,
    authOptions({
      roles: ["facility_manager"],
      permissions: [
        "fm_tickets.view",
        "maintenance.view",
        "projects.view",
        "inspection.view",
      ],
    }),
  );

  assert.ok(visible.some((item) => item.href === "/projects"));
  assert.ok(visible.some((item) => item.href === "/maintenance"));
  assert.ok(visible.some((item) => item.href === "/my-work"));
  assert.equal(
    visible.some((item) => item.href === "/my-requests"),
    false,
  );
});

test("Projects hidden without projects.view even when other modules are visible", () => {
  const visible = filterNavigationForEmployeeRequester(
    APP_NAVIGATION,
    authOptions({
      roles: ["facility_manager"],
      permissions: ["fm_tickets.view", "maintenance.view", "inspection.view"],
    }),
  );

  assert.equal(
    visible.some((item) => item.href === "/projects"),
    false,
  );
  assert.equal(
    visible.some((item) => item.href === "/my-work"),
    false,
  );
  assert.ok(visible.some((item) => item.href === "/maintenance"));
});

test("employee requester mode never surfaces Projects or My Work", () => {
  const visible = filterNavigationForEmployeeRequester(
    APP_NAVIGATION,
    authOptions({
      roles: ["employee"],
      permissions: ["fm_tickets.view", "fm_tickets.create", "projects.view"],
    }),
  );

  assert.equal(
    visible.some((item) => item.href === "/projects"),
    false,
  );
  assert.equal(
    visible.some((item) => item.href === "/my-work"),
    false,
  );
  assert.ok(visible.some((item) => item.href === "/my-requests"));
});
