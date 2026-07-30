import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTicketCreateSuccessHref,
  enqueueTicketCreateImages,
  getQueuedImageCount,
  getTicketCreateImageGuidance,
  readAiQueuedFromSearch,
  validateTicketCreateImageFile,
} from "./create-image-staging";

function makeFile(
  name: string,
  options?: { size?: number; type?: string },
): File {
  const size = options?.size ?? 128;
  const type = options?.type ?? "image/jpeg";
  const buffer = new Uint8Array(size);
  return new File([buffer], name, { type });
}

test("validateTicketCreateImageFile accepts jpeg/png/webp", () => {
  assert.equal(validateTicketCreateImageFile(makeFile("a.jpg")).ok, true);
  assert.equal(
    validateTicketCreateImageFile(makeFile("a.png", { type: "image/png" })).ok,
    true,
  );
  assert.equal(
    validateTicketCreateImageFile(makeFile("a.webp", { type: "image/webp" })).ok,
    true,
  );
});

test("validateTicketCreateImageFile rejects pdf and oversized files", () => {
  const pdf = validateTicketCreateImageFile(
    makeFile("doc.pdf", { type: "application/pdf" }),
  );
  assert.equal(pdf.ok, false);

  const oversized = validateTicketCreateImageFile(
    makeFile("big.jpg", { size: 11 * 1024 * 1024 }),
  );
  assert.equal(oversized.ok, false);
});

test("enqueueTicketCreateImages tracks count and rejects pdf", () => {
  const { next, rejected } = enqueueTicketCreateImages(
    [],
    [
      makeFile("one.jpg"),
      makeFile("two.pdf", { type: "application/pdf" }),
    ],
  );
  assert.equal(getQueuedImageCount(next), 1);
  assert.ok(rejected.length >= 1);
});

test("success href and ai_queued query helpers", () => {
  assert.equal(
    buildTicketCreateSuccessHref("/fm-tickets/abc"),
    "/fm-tickets/abc?created=1",
  );
  assert.equal(
    buildTicketCreateSuccessHref("/fm-tickets/abc", { aiQueued: true }),
    "/fm-tickets/abc?created=1&ai_queued=1",
  );
  assert.equal(readAiQueuedFromSearch("ai_queued=1"), true);
  assert.equal(readAiQueuedFromSearch("?ai_queued=0"), false);
  assert.match(getTicketCreateImageGuidance(), /JPEG/);
});
