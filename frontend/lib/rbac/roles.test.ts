import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDuplicateRoleDefaults,
  getRoleActionPermissions,
  mapDuplicateRolePayload,
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

const activeSystemRole = {
  is_system_role: true,
  is_active: true,
};

const sourceRole = {
  id: "role-source",
  name: "Facilities Coordinator",
  code: "facilities_coordinator",
  description: "Coordinates facilities.",
  is_system_role: false,
  is_active: true,
  created_at: "2026-07-12T00:00:00Z",
  updated_at: "2026-07-12T00:00:00Z",
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
  const actions = getRoleActionPermissions(["roles.view"], currentUser);
  assert.equal(actions.canCreate, false);
  assert.equal(actions.canDuplicate, false);
  assert.equal(actions.canManagePermissions, false);
});

test("permission helper hides edit and deactivate for system roles", () => {
  const actions = getRoleActionPermissions(["roles.manage"], currentUser, {
    is_system_role: true,
    is_active: true,
  });
  assert.equal(actions.canEdit, false);
  assert.equal(actions.canDeactivate, false);
  assert.equal(actions.canManagePermissions, false);
  assert.equal(actions.canDuplicate, true);
});

test("permission helper hides deactivate for inactive roles", () => {
  const actions = getRoleActionPermissions(["roles.manage"], currentUser, {
    ...activeCustomRole,
    is_active: false,
  });
  assert.equal(actions.canDeactivate, false);
  assert.equal(actions.canManagePermissions, false);
  assert.equal(actions.canDuplicate, false);
});

test("permission helper exposes custom-role actions with roles.manage", () => {
  assert.deepEqual(
    getRoleActionPermissions(["roles.manage"], currentUser, activeCustomRole),
    {
      canCreate: true,
      canDuplicate: true,
      canEdit: true,
      canDeactivate: true,
      canManagePermissions: true,
    },
  );
});

test("duplicate defaults append Copy and retain source description", () => {
  assert.deepEqual(buildDuplicateRoleDefaults(sourceRole), {
    name: "Facilities Coordinator Copy",
    code: "facilities_coordinator-copy",
    description: "Coordinates facilities.",
  });
});

test("duplicate code suggestion is normalized from the source code", () => {
  const defaults = buildDuplicateRoleDefaults({
    ...sourceRole,
    code: "Safety Lead",
  });
  assert.equal(defaults.code, "safety-lead-copy");
});

test("duplicate payload contains only normalized role metadata", () => {
  const payload = mapDuplicateRolePayload({
    name: "  New Coordinator  ",
    code: " New Coordinator Copy ",
    description: "  Replacement description.  ",
  });
  assert.deepEqual(payload, {
    name: "New Coordinator",
    code: "new-coordinator-copy",
    description: "Replacement description.",
  });
  assert.equal("is_system_role" in payload, false);
  assert.equal("is_active" in payload, false);
  assert.equal("permission_ids" in payload, false);
  assert.equal("user_ids" in payload, false);
});

test("changing duplicate description changes only duplicate payload", () => {
  const defaults = buildDuplicateRoleDefaults(sourceRole);
  const payload = mapDuplicateRolePayload({
    ...defaults,
    description: "Duplicate-specific description.",
  });
  assert.equal(payload.description, "Duplicate-specific description.");
  assert.equal(sourceRole.description, "Coordinates facilities.");
});

test("duplicate action is visible for active system roles with roles.manage", () => {
  const actions = getRoleActionPermissions(
    ["roles.manage"],
    currentUser,
    activeSystemRole,
  );
  assert.equal(actions.canDuplicate, true);
  assert.equal(actions.canEdit, false);
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

test("role permission assignment query keys are scoped by role id", () => {
  assert.notDeepEqual(
    rbacQueryKeys.rolePermissions("role-1"),
    rbacQueryKeys.rolePermissions("role-2"),
  );
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
