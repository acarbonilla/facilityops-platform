import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_ADMIN_DISCLAIMER,
  AI_ADMIN_PERMISSION,
  containsForbiddenAdminSecrets,
  formatRateAsPercent,
  healthBadgeClass,
  summarizeConfig,
} from "./ai-administration";
import type { AIAdminConfig } from "@/types/ai-administration";

const sample: AIAdminConfig = {
  scope: "global",
  provider: {
    provider: "placeholder",
    model: "gemini-2.0-flash",
    enabled: false,
    timeout_seconds: 60,
    max_images: 5,
    max_upload_bytes: 15000000,
    retry_attempts: 3,
    temperature: 0.2,
    temperature_readonly: true,
    store_raw_response: false,
    api_key_configured: false,
    api_key_editable: false,
  },
  feature_flags: {
    image_analysis: true,
    recommendation_engine: true,
    executive_dashboard: true,
    similar_cases: true,
    attention_center: true,
    operational_insights: true,
  },
  thresholds: {
    confidence_threshold: 50,
    health_warning_threshold: 50,
    health_critical_threshold: 75,
    attention_warning_threshold: 60,
    attention_critical_threshold: 80,
    acceptance_healthy_rate: 0.7,
    override_warning_rate: 0.4,
  },
};

test("ai admin permission and disclaimer", () => {
  assert.equal(AI_ADMIN_PERMISSION, "settings.manage");
  assert.match(AI_ADMIN_DISCLAIMER, /never runs analysis/i);
});

test("formatting helpers", () => {
  assert.equal(formatRateAsPercent(0.4), "40%");
  assert.match(healthBadgeClass("healthy"), /emerald/);
  assert.match(summarizeConfig(sample), /placeholder/);
});

test("secret scanner rejects api key and prompt text payloads", () => {
  assert.equal(containsForbiddenAdminSecrets(sample), false);
  assert.equal(
    containsForbiddenAdminSecrets({ gemini_api_key: "x" }),
    true,
  );
  assert.equal(
    containsForbiddenAdminSecrets({ prompt_text: "secret prompt" }),
    true,
  );
});
