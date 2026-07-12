import assert from "node:assert/strict";
import test from "node:test";

import { usersQueryKeys } from "@/services/api/query-keys";
import type { UserDirectoryItem } from "@/types/users";

import {
  createUserDirectoryEmailFallback,
  isUserDirectoryQueryEnabled,
  isUserInDirectoryScope,
  mapUserDirectoryItemToOption,
  mergeUserDirectoryOptions,
  normalizeOptionalUserId,
} from "./directory";

const selected: UserDirectoryItem = {
  id: "user-1",
  email: "person@example.com",
  first_name: "Person",
  last_name: "Example",
  display_name: "Person Example",
  tenant: "tenant-1",
  organization: "organization-1",
  is_active: true,
};

test("directory item maps display name and supporting email metadata", () => {
  assert.deepEqual(mapUserDirectoryItemToOption(selected), {
    id: "user-1",
    value: "user-1",
    label: "Person Example",
    email: "person@example.com",
    tenant: "tenant-1",
    organization: "organization-1",
    is_active: true,
  });
});

test("selected fallback remains visible and deduplicates fetched IDs", () => {
  const fetched = [{ ...selected, display_name: "Fetched Person" }];
  const options = mergeUserDirectoryOptions(fetched, selected);

  assert.equal(options.length, 1);
  assert.equal(options[0]?.label, "Person Example");
  assert.equal(
    mergeUserDirectoryOptions([], selected)[0]?.value,
    selected.id,
  );
});

test("email fallback uses safe response data without inventing scope", () => {
  assert.deepEqual(
    createUserDirectoryEmailFallback("user-1", "person@example.com"),
    {
      id: "user-1",
      email: "person@example.com",
      first_name: "",
      last_name: "",
      display_name: "person@example.com",
      tenant: null,
      organization: null,
      is_active: true,
    },
  );
});

test("optional selection normalization preserves IDs and clears empty values", () => {
  assert.equal(normalizeOptionalUserId(""), null);
  assert.equal(normalizeOptionalUserId("   "), null);
  assert.equal(normalizeOptionalUserId(" user-1 "), "user-1");
});

test("known tenant mismatch is invalid while unknown scope is retained", () => {
  assert.equal(isUserInDirectoryScope(selected, "tenant-2", null), false);
  assert.equal(
    isUserInDirectoryScope({ tenant: null, organization: null }, "tenant-2", null),
    true,
  );
});

test("directory fetching requires permission and an enabled control", () => {
  assert.equal(isUserDirectoryQueryEnabled(false, false), false);
  assert.equal(isUserDirectoryQueryEnabled(true, true), false);
  assert.equal(isUserDirectoryQueryEnabled(true, false), true);
});

test("directory query keys vary with search and scope", () => {
  const base = usersQueryKeys.directory({
    search: "person",
    tenant: "tenant-1",
    organization: "organization-1",
    page: 1,
    page_size: 20,
    ordering: "email",
  });
  assert.notDeepEqual(base, usersQueryKeys.directory({ ...base[2], search: "other" }));
  assert.notDeepEqual(base, usersQueryKeys.directory({ ...base[2], tenant: "tenant-2" }));
  assert.notDeepEqual(
    base,
    usersQueryKeys.directory({ ...base[2], organization: "organization-2" }),
  );
});
