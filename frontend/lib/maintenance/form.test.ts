import assert from "node:assert/strict";
import test from "node:test";

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
    title: "Payload contract",
    description: "Maintenance payload remains unchanged.",
    due_at: "2026-07-12T08:00",
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
