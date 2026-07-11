import assert from "node:assert/strict";
import test from "node:test";

import type {
  InspectionFormValues,
  InspectionItemFormValues,
  InspectionItemPayload,
} from "@/types/inspection";

import {
  buildInspectionFormDefaults,
  createEmptyInspectionItem,
  mapInspectionFormValuesToCreatePayload,
  mapInspectionFormValuesToUpdatePayload,
} from "./form";

const payloadMappers = [
  ["create", mapInspectionFormValuesToCreatePayload],
  ["update", mapInspectionFormValuesToUpdatePayload],
] as const;

const cases: Array<{
  name: string;
  score: string;
  isPass: InspectionItemFormValues["is_pass"];
  expectedScore?: string;
  expectedPass?: boolean;
}> = [
  {
    name: "omits score and pass/fail when both are blank",
    score: "",
    isPass: "",
  },
  {
    name: "includes score and pass",
    score: "4.00",
    isPass: "true",
    expectedScore: "4.00",
    expectedPass: true,
  },
  {
    name: "includes score and fail",
    score: "2.00",
    isPass: "false",
    expectedScore: "2.00",
    expectedPass: false,
  },
  {
    name: "includes pass without a score",
    score: "",
    isPass: "true",
    expectedPass: true,
  },
  {
    name: "includes fail without a score",
    score: "",
    isPass: "false",
    expectedPass: false,
  },
];

function buildValues(
  score: string,
  isPass: InspectionItemFormValues["is_pass"],
): InspectionFormValues {
  return {
    ...buildInspectionFormDefaults(null),
    tenant: "tenant-id",
    organization: "organization-id",
    building: "building-id",
    title: "Inspection payload test",
    items: [
      {
        ...createEmptyInspectionItem(1),
        checklist_item: "Check payload mapping",
        score,
        is_pass: isPass,
      },
    ],
  };
}

function getMappedItem(
  mapper: (values: InspectionFormValues) => { items?: InspectionItemPayload[] },
  score: string,
  isPass: InspectionItemFormValues["is_pass"],
) {
  const [item] = mapper(buildValues(score, isPass)).items ?? [];
  assert.ok(item);
  return item;
}

for (const scenario of cases) {
  for (const [mapperName, mapper] of payloadMappers) {
    test(`${mapperName} payload ${scenario.name}`, () => {
      const item = getMappedItem(mapper, scenario.score, scenario.isPass);

      assert.equal("score" in item, scenario.expectedScore !== undefined);
      assert.equal(item.score, scenario.expectedScore);
      assert.equal("is_pass" in item, scenario.expectedPass !== undefined);
      assert.equal(item.is_pass, scenario.expectedPass);
    });
  }
}
