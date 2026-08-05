import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_MONITORING_DISCLAIMER,
  AI_MONITORING_PERMISSION,
  containsForbiddenMonitoringSecrets,
  formatDurationMs,
  formatMonitoringRate,
  monitoringHealthBadgeClass,
  overviewScreenReaderSummary,
  summarizeMonitoringHealth,
  summarizeRuntime,
} from "./ai-monitoring";
import type { AIMonitoringOverview } from "@/types/ai-monitoring";

const sample: AIMonitoringOverview = {
  scope: "tenant",
  overview: {
    provider: "placeholder",
    model: "placeholder",
    enabled: true,
    provider_available: true,
    health: {
      overall: { status: "healthy", status_label: "Healthy" },
      provider: { status: "healthy", status_label: "Healthy" },
      queue: { status: "healthy", status_label: "Healthy" },
      worker: { status: "healthy", status_label: "Healthy" },
      ai: { status: "healthy", status_label: "Healthy" },
    },
  },
  provider: {
    provider: "placeholder",
    model: "placeholder",
    enabled: true,
    api_key_configured: false,
    provider_available: true,
    provider_availability_label: "Available",
    timeout_seconds: 60,
    retry_attempts: 3,
    feature_image_analysis: true,
  },
  runtime: {
    total_analyses: 10,
    analyses_today: 2,
    completed: 8,
    failed: 2,
    finished: 10,
    success_rate: 0.8,
    failure_rate: 0.2,
    retry_rate: 0.1,
    timeout_rate: 0.05,
    retrying_now: 0,
    average_duration_ms: 1500,
    average_queue_wait_ms: 400,
  },
  queue: {
    queued: 1,
    processing: 1,
    completed: 8,
    failed: 2,
    retrying: 0,
    backlog: 2,
    depth: 2,
  },
  health: {
    overall: { status: "warning", status_label: "Warning" },
    provider: { status: "healthy", status_label: "Healthy" },
    queue: { status: "healthy", status_label: "Healthy" },
    worker: { status: "healthy", status_label: "Healthy" },
    ai: { status: "warning", status_label: "Warning" },
  },
  alerts: [
    {
      code: "high_failure_rate",
      title: "Elevated Failure Rate",
      severity: "warning",
      severity_label: "Warning",
      message: "Failure rate exceeds the warning monitoring threshold.",
      actionable: false,
      remediation_automatic: false,
    },
  ],
  recent_activity: [],
  error_categories: { timeout: 1 },
  thresholds_used: {},
  generated_at: "2026-08-05T00:00:00+00:00",
};

test("ai monitoring permission and disclaimer", () => {
  assert.equal(AI_MONITORING_PERMISSION, "settings.manage");
  assert.match(AI_MONITORING_DISCLAIMER, /informational only/i);
  assert.match(AI_MONITORING_DISCLAIMER, /never runs analysis/i);
});

test("formatting and health helpers", () => {
  assert.equal(formatMonitoringRate(0.2), "20.0%");
  assert.equal(formatDurationMs(1500), "1.5 s");
  assert.match(monitoringHealthBadgeClass("critical"), /rose/);
  assert.match(summarizeMonitoringHealth(sample.health.overall), /Warning/);
  assert.match(summarizeRuntime(sample.runtime), /Success/);
  assert.match(overviewScreenReaderSummary(sample), /Overall health Warning/);
});

test("secret scanner rejects forbidden monitoring payloads", () => {
  assert.equal(containsForbiddenMonitoringSecrets(sample), false);
  assert.equal(
    containsForbiddenMonitoringSecrets({ gemini_api_key: "x" }),
    true,
  );
  assert.equal(
    containsForbiddenMonitoringSecrets({ prompt_text: "secret" }),
    true,
  );
});

test("loading empty error presentation helpers stay safe", () => {
  assert.equal(overviewScreenReaderSummary(null), "AI monitoring data is not loaded.");
  assert.equal(summarizeRuntime(null), "No runtime metrics loaded.");
  assert.equal(formatMonitoringRate(null), "—");
});
