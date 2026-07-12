import assert from "node:assert/strict";
import test from "node:test";

import {
  getRoleActionPermissions,
  mapRoleCreatePayload,
  mapRoleUpdatePayload,
  normalizeRoleCode,
} from "./roles";
import { normalizeRolesPayload } from "../../services/api/rbac";
import { rbacQueryKeys } from "../../services/api/query-keys";

const currentUser = {
  id: "user-1",
  email: "admin@example.com",
  first_name: "Admin",
  last_name: "User",
  tenant: null,
  organization: null,
  is_staff: false,
};

const activeCustomRole = {
  is_system_role: false,
  is_active: true,
};

test("create payload trims fields and includes normalized code", () => {
  assert.deepEqual(
    mapRoleCreatePayload({
      name: "  Operations Lead ",
      code: " Operations_ Lead ",
      description: "  Coordinates operations.  ",
    }),
    {
      name: "Operations Lead",
      code: "operations_-lead",
      description: "Coordinates operations.",
    },
  );
});

test("edit payload omits code and protected state fields", () => {
  const payload = mapRoleUpdatePayload({
    name: " Updated ",
    code: "must_not_submit",
    description: " Description ",
  });
  assert.deepEqual(payload, { name: "Updated", description: "Description" });
  assert.equal("code" in payload, false);
  assert.equal("is_system_role" in payload, false);
  assert.equal("is_active" in payload, false);
});

test("code preview matches backend-style space and underscore behavior", () => {
  assert.equal(normalizeRoleCode("Facility Operations"), "facility-operations");
  assert.equal(normalizeRoleCode("SYSTEM_Admin"), "system_admin");
  assert.equal(normalizeRoleCode("  Safety---Lead  "), "safety-lead");
});

test("permission helper hides create without roles.manage", () => {
  assert.equal(
    getRoleActionPermissions(["roles.view"], currentUser).canCreate,
    false,
  );
});

test("permission helper hides edit and deactivate for system roles", () => {
  const actions = getRoleActionPermissions(["roles.manage"], currentUser, {
    is_system_role: true,
    is_active: true,
  });
  assert.equal(actions.canEdit, false);
  assert.equal(actions.canDeactivate, false);
});

test("permission helper hides deactivate for inactive roles", () => {
  const actions = getRoleActionPermissions(["roles.manage"], currentUser, {
    ...activeCustomRole,
    is_active: false,
  });
  assert.equal(actions.canDeactivate, false);
});

test("permission helper exposes custom-role actions with roles.manage", () => {
  assert.deepEqual(
    getRoleActionPermissions(["roles.manage"], currentUser, activeCustomRole),
    { canCreate: true, canEdit: true, canDeactivate: true },
  );
});

test("role list query keys vary with pagination, search, filters, and ordering", () => {
  const first = rbacQueryKeys.roles({
    page: 1,
    page_size: 20,
    search: "ops",
    is_system_role: false,
    is_active: true,
    ordering: "name",
  });
  const second = rbacQueryKeys.roles({
    page: 2,
    page_size: 50,
    search: "safety",
    is_system_role: true,
    is_active: false,
    ordering: "-updated_at",
  });
  assert.notDeepEqual(first, second);
});

test("paginated response mapping preserves metadata and role results", () => {
  const response = normalizeRolesPayload({
    count: 25,
    next: "http://example.test/roles/?page=2",
    previous: null,
    results: [
      {
        id: "role-1",
        name: "Operator",
        code: "operator",
        description: "Operates facilities",
        is_system_role: false,
        is_active: true,
        created_at: "2026-07-12T00:00:00Z",
        updated_at: "2026-07-12T01:00:00Z",
      },
    ],
  });
  assert.equal(response.count, 25);
  assert.equal(response.next, "http://example.test/roles/?page=2");
  assert.equal(response.previous, null);
  assert.equal(response.results[0]?.created_at, "2026-07-12T00:00:00Z");
});
