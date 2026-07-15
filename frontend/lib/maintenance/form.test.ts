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

test("maintenance create payload contains only persisted create fields", () => {
  const values = {
    ...buildValues(),
    department: "department-1",
    floor: "floor-1",
    area: "area-1",
    estimated_start_at: "2026-07-13T08:00",
    estimated_completion_at: "2026-07-14T08:00",
  };
  const payload = mapMaintenanceFormValuesToCreatePayload(values);

  assert.deepEqual(Object.keys(payload).sort(), [
    "area",
    "asset",
    "building",
    "department",
    "description",
    "due_at",
    "floor",
    "organization",
    "priority",
    "scheduled_end_at",
    "scheduled_start_at",
    "tenant",
    "title",
  ]);
  assert.equal("category" in payload, false);
  assert.equal("maintenance_type" in payload, false);
  assert.equal("notes" in payload, false);
  assert.equal("location_description" in payload, false);
  assert.equal("assignment_team" in payload, false);
  assert.equal("estimated_hours" in payload, false);
  assert.equal("tasks" in payload, false);
  assert.equal("materials" in payload, false);
  assert.equal("labor" in payload, false);
  assert.equal("assigned_technician" in payload, false);
  assert.equal("supervisor" in payload, false);
  assert.equal(payload.tenant, "tenant-1");
  assert.equal(payload.organization, "organization-1");
  assert.equal(payload.asset, "asset-1");
  assert.equal(payload.building, "building-1");
});

test("maintenance update payload remains the create contract plus cancellation reason", () => {
  const createPayload = mapMaintenanceFormValuesToCreatePayload(buildValues());
  const updatePayload = mapMaintenanceFormValuesToUpdatePayload(buildValues());

  assert.deepEqual(updatePayload, {
    ...createPayload,
    cancellation_reason: "",
  });
});

test("maintenance schema requires asset and building", () => {
  const missingAsset = maintenanceWorkOrderSchema.safeParse({
    ...buildValues(),
    asset: "",
  });
  const missingBuilding = maintenanceWorkOrderSchema.safeParse({
    ...buildValues(),
    building: "",
  });

  assert.equal(missingAsset.success, false);
  assert.equal(missingBuilding.success, false);
  if (!missingAsset.success) {
    assert.equal(
      missingAsset.error.issues.some(
        (issue) =>
          issue.path.join(".") === "asset" &&
          issue.message === "Asset is required.",
      ),
      true,
    );
  }
});

test("maintenance schema accepts a complete backend-required create contract", () => {
  const result = maintenanceWorkOrderSchema.safeParse(buildValues());
  assert.equal(result.success, true);
});

test("maintenance form defaults omit removed planning-only fields", () => {
  const defaults = buildMaintenanceFormDefaults(null);

  assert.equal("category" in defaults, false);
  assert.equal("maintenance_type" in defaults, false);
  assert.equal("notes" in defaults, false);
  assert.equal("location_description" in defaults, false);
  assert.equal("assignment_team" in defaults, false);
  assert.equal("estimated_hours" in defaults, false);
  assert.equal("tasks" in defaults, false);
  assert.equal("materials" in defaults, false);
  assert.equal("labor" in defaults, false);
});

test("optional location fields normalize empty strings to null", () => {
  const payload = mapMaintenanceFormValuesToCreatePayload({
    ...buildValues(),
    department: "   ",
    floor: "",
    area: "  ",
    estimated_start_at: "",
    estimated_completion_at: "   ",
  });

  assert.equal(payload.department, null);
  assert.equal(payload.floor, null);
  assert.equal(payload.area, null);
  assert.equal(payload.scheduled_start_at, null);
  assert.equal(payload.scheduled_end_at, null);
});
