import assert from "node:assert/strict";
import test from "node:test";

import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
} from "./permissions";

const staffUser = { is_staff: true };
const standardUser = { is_staff: false };

test("staff status never bypasses explicit frontend permissions", () => {
  assert.equal(hasPermission([], "settings.manage", staffUser), false);
  assert.equal(hasAnyPermission([], ["users.view", "roles.view"], staffUser), false);
  assert.equal(hasAllPermissions(["settings.view"], ["settings.view", "settings.manage"], staffUser), false);
});

test("permission helpers use assigned codes for every account type", () => {
  const permissions = ["inspection.view", "reporting.view", "settings.view"];

  for (const user of [staffUser, standardUser]) {
    assert.equal(hasPermission(permissions, "inspection.view", user), true);
    assert.equal(
      hasAnyPermission(permissions, ["inspection.manage", "reporting.view"], user),
      true,
    );
    assert.equal(
      hasAllPermissions(permissions, ["reporting.view", "settings.view"], user),
      true,
    );
    assert.equal(hasPermission(permissions, "settings.manage", user), false);
  }
});
