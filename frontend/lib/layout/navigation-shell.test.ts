import assert from "node:assert/strict";
import test from "node:test";

import { APP_NAVIGATION } from "@/lib/navigation";
import { filterNavigationForEmployeeRequester } from "@/lib/my-requests/navigation";
import { getNavigationIcon } from "@/lib/layout/navigation-icons";

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

test("FO-116 manager navigation keeps Projects and hides My Requests", () => {
  const items = filterNavigationForEmployeeRequester(
    APP_NAVIGATION,
    authOptions({
      roles: ["facility_manager"],
      permissions: [
        "projects.view",
        "fm_tickets.view",
        "maintenance.view",
        "reporting.view",
        "settings.view",
      ],
    }),
  );
  const hrefs = items.map((item) => item.href);
  assert.ok(hrefs.includes("/projects"));
  assert.ok(hrefs.includes("/dashboard"));
  assert.ok(!hrefs.includes("/my-requests"));
});

test("FO-116 employee requester navigation stays restricted", () => {
  const items = filterNavigationForEmployeeRequester(
    APP_NAVIGATION,
    authOptions({
      roles: ["employee"],
      permissions: ["fm_tickets.view", "fm_tickets.create"],
    }),
  );
  const hrefs = items.map((item) => item.href);
  assert.ok(hrefs.includes("/dashboard"));
  assert.ok(hrefs.includes("/my-requests"));
  assert.ok(!hrefs.includes("/projects"));
  assert.ok(!hrefs.includes("/my-work"));
  assert.ok(!hrefs.includes("/admin"));
});

test("FO-116 navigation icons resolve for core modules", () => {
  assert.ok(getNavigationIcon("/projects"));
  assert.ok(getNavigationIcon("/my-work"));
  assert.ok(getNavigationIcon("/fm-tickets"));
  assert.ok(getNavigationIcon("/dashboard"));
});
