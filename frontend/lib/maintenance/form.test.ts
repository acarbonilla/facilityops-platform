import assert from "node:assert/strict";
import test from "node:test";

import { maintenanceWorkOrderSchema } from "@/lib/validations/maintenance";

import {
  buildMaintenanceFormDefaults,
  mapMaintenanceFormValuesToCreatePayload,
  mapMaintenanceFormValuesToUpdatePayload,
} from "./form";

function buildValues() {
  return {
    ...buildMaintenanceFormDefaults(null),
    tenant: "tenant-1",
    organization: "organization-1",
    building: "building-1",
    asset: "asset-1",
    requested_by: "requester@example.com",
    title: "Payload contract",
    description: "Maintenance payload remains unchanged.",
    requested_at: "2026-07-12T08:00",
    due_at: "2026-07-15T08:00",
  };
}

test("maintenance create payload excludes removed planning assignment fields", () => {
  const payload = mapMaintenanceFormValuesToCreatePayload(buildValues());

  assert.equal("assigned_technician" in payload, false);
  assert.equal("supervisor" in payload, false);
  assert.equal("tasks" in payload, false);
  assert.equal("labor" in payload, false);
  assert.equal(payload.tenant, "tenant-1");
  assert.equal(payload.organization, "organization-1");
});

test("maintenance update payload remains the create contract plus cancellation reason", () => {
  const createPayload = mapMaintenanceFormValuesToCreatePayload(buildValues());
  const updatePayload = mapMaintenanceFormValuesToUpdatePayload(buildValues());

  assert.deepEqual(updatePayload, {
    ...createPayload,
    cancellation_reason: "",
  });
});

test("maintenance schema requires asset instead of location-only context", () => {
  const result = maintenanceWorkOrderSchema.safeParse({
    ...buildValues(),
    asset: "",
    building: "building-1",
    location_description: "Lobby",
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(
      result.error.issues.some(
        (issue) =>
          issue.path.join(".") === "asset" &&
          issue.message === "Asset is required.",
      ),
      true,
    );
  }
});

test("maintenance schema accepts a complete backend-required create contract", () => {
  const result = maintenanceWorkOrderSchema.safeParse({
    ...buildValues(),
    tasks: [],
    materials: [],
    labor: [],
  });
  assert.equal(result.success, true);
});
