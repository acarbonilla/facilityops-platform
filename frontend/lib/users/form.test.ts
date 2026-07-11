import assert from "node:assert/strict";
import test from "node:test";

import { createUserFormSchema } from "@/lib/validations/users";

import {
  getUserActionPermissions,
  getUserDisplayName,
  mapUserCreatePayload,
  mapUserUpdatePayload,
} from "./form";

const values = {
  email: "person@example.com",
  first_name: "Person",
  last_name: "Example",
  tenant: "",
  organization: "",
  password: "SecurePassword123!",
  confirm_password: "SecurePassword123!",
  is_active: true,
  is_staff: false,
};

test("create payload includes password and normalizes optional UUIDs", () => {
  assert.deepEqual(mapUserCreatePayload(values), {
    email: "person@example.com",
    first_name: "Person",
    last_name: "Example",
    tenant: null,
    organization: null,
    password: "SecurePassword123!",
    is_active: true,
    is_staff: false,
  });
});

test("edit payload omits an empty password", () => {
  const payload = mapUserUpdatePayload({
    ...values,
    password: "",
    confirm_password: "",
  });
  assert.equal("password" in payload, false);
});

test("frontend validation rejects mismatched password confirmation", () => {
  const result = createUserFormSchema("create").safeParse({
    ...values,
    confirm_password: "different",
  });
  assert.equal(result.success, false);
});

test("user display name falls back to email", () => {
  assert.equal(
    getUserDisplayName({
      email: "fallback@example.com",
      first_name: "",
      last_name: "",
    }),
    "fallback@example.com",
  );
});

test("permission helper hides actions without required permissions", () => {
  const currentUser = {
    id: "current",
    email: "current@example.com",
    first_name: "",
    last_name: "",
    tenant: "tenant",
    organization: null,
    is_staff: false,
  };
  assert.deepEqual(
    getUserActionPermissions([], currentUser, {
      id: "target",
      is_active: true,
    }),
    { canCreate: false, canEdit: false, canDeactivate: false },
  );
});

test("permission helper always hides self-deactivation", () => {
  const currentUser = {
    id: "current",
    email: "current@example.com",
    first_name: "",
    last_name: "",
    tenant: "tenant",
    organization: null,
    is_staff: false,
  };
  assert.equal(
    getUserActionPermissions(["users.delete"], currentUser, {
      id: "current",
      is_active: true,
    }).canDeactivate,
    false,
  );
});
