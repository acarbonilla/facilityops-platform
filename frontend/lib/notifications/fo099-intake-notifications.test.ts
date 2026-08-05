import assert from "node:assert/strict";
import test from "node:test";

import {
  FO099_EVENT_CODES,
  expectedFo099TargetPath,
  getFo099NotificationTitle,
  isFo099InternalEvent,
  isFo099RequesterEvent,
  notificationCopyExposesInternalAi,
} from "./fo099-intake-notifications";
import { getSafeNotificationTargetUrl } from "./display";

test("FO-099 event titles match product copy", () => {
  assert.match(
    getFo099NotificationTitle(FO099_EVENT_CODES.employeeConcernCreated) || "",
    /requires review/i,
  );
  assert.match(
    getFo099NotificationTitle(FO099_EVENT_CODES.aiAnalysisReady) || "",
    /AI findings are ready/i,
  );
  assert.match(
    getFo099NotificationTitle(FO099_EVENT_CODES.aiAnalysisFailed) || "",
    /unavailable/i,
  );
  assert.match(
    getFo099NotificationTitle(FO099_EVENT_CODES.employeeConcernSubmitted) || "",
    /submitted successfully/i,
  );
  assert.equal(getFo099NotificationTitle("unknown.event"), null);
});

test("FO-099 targets stay role-appropriate", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  assert.equal(
    expectedFo099TargetPath(FO099_EVENT_CODES.employeeConcernCreated, id),
    `/fm-tickets/${id}`,
  );
  assert.equal(
    expectedFo099TargetPath(FO099_EVENT_CODES.aiAnalysisReady, id),
    `/fm-tickets/${id}`,
  );
  assert.equal(
    expectedFo099TargetPath(FO099_EVENT_CODES.employeeConcernSubmitted, id),
    `/my-requests/${id}`,
  );
  assert.equal(
    getSafeNotificationTargetUrl(`/fm-tickets/${id}`),
    `/fm-tickets/${id}`,
  );
  assert.equal(
    getSafeNotificationTargetUrl(`/my-requests/${id}`),
    `/my-requests/${id}`,
  );
  assert.equal(isFo099InternalEvent(FO099_EVENT_CODES.aiAnalysisFailed), true);
  assert.equal(
    isFo099RequesterEvent(FO099_EVENT_CODES.classificationCompleted),
    true,
  );
});

test("FO-099 copy helpers reject internal AI leakage", () => {
  assert.equal(
    notificationCopyExposesInternalAi(
      "AI findings are ready. Review and confirm the ticket classification.",
    ),
    false,
  );
  assert.equal(
    notificationCopyExposesInternalAi("Gemini confidence 92 with reasoning"),
    true,
  );
});
