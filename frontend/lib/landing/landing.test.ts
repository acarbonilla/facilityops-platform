import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// tsx uses classic JSX transform for imported .tsx modules under node:test.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

import { metadata as homeMetadata } from "@/app/page";
import { LandingHero } from "@/features/landing/components/landing-hero";
import { LandingNav } from "@/features/landing/components/landing-nav";
import { LandingPage } from "@/features/landing/components/landing-page";
import {
  ApplicationsSection,
  ModulesSection,
} from "@/features/landing/components/landing-sections";
import {
  LANDING_BENEFITS,
  LANDING_BRAND,
  LANDING_FUTURE_AI,
  LANDING_MODULES,
  LANDING_NAV,
  LANDING_SECURITY,
  LANDING_TRUST_ITEMS,
  LANDING_WORKFLOW,
} from "./content";
import {
  LIVE_PLATFORM_PREVIEW,
  PREVIEW_FORBIDDEN_PATTERNS,
} from "./live-platform-preview";
import {
  getPublicApplicationStatusLabel,
  PUBLIC_APPLICATIONS,
} from "./public-applications";
import { LivePlatformPreview } from "@/features/landing/components/preview/live-platform-preview";

test("landing brand and navigation are presentation-ready", () => {
  assert.equal(LANDING_BRAND.name, "FacilityOps");
  assert.match(LANDING_BRAND.tagline, /Smarter Facility Operations/i);
  assert.ok(LANDING_NAV.length >= 5);
  assert.ok(LANDING_NAV.every((item) => item.href.startsWith("#")));
});

test("module and trust cards expose required presentation fields", () => {
  assert.ok(LANDING_MODULES.length >= 8);
  for (const item of LANDING_MODULES) {
    assert.ok(item.id);
    assert.ok(item.title);
    assert.ok(item.description.length > 20);
    assert.ok(item.icon);
  }
  assert.ok(LANDING_TRUST_ITEMS.length >= 6);
});

test("workflow sequence preserves end-to-end operations order", () => {
  assert.deepEqual(
    LANDING_WORKFLOW.map((step) => step.label),
    [
      "Employee",
      "FM Ticket",
      "Assignment",
      "Maintenance",
      "Inspection",
      "Completion",
      "Analytics",
    ],
  );
});

test("applications configuration supports future expansion", () => {
  assert.equal(PUBLIC_APPLICATIONS.length, 1);
  const app = PUBLIC_APPLICATIONS[0];
  assert.equal(app.name, "FacilityOps");
  assert.equal(app.status, "available");
  assert.equal(app.href, "/login");
  assert.equal(app.external, false);
  assert.equal(getPublicApplicationStatusLabel("available"), "Available");
  assert.equal(getPublicApplicationStatusLabel("coming_soon"), "Coming soon");
});

test("security and future AI copy stay measured", () => {
  assert.ok(LANDING_SECURITY.every((item) => !/guaranteed|100%/i.test(item.description)));
  assert.ok(LANDING_FUTURE_AI.length >= 5);
  assert.ok(LANDING_BENEFITS.length >= 6);
});

test("CTA targets use the authenticated login entrypoint", () => {
  assert.equal(PUBLIC_APPLICATIONS[0].href, "/login");
});

test("landing page renders core landmarks and sections", () => {
  const html = renderToStaticMarkup(createElement(LandingPage));
  assert.match(html, /id="top"/);
  assert.match(html, /aria-label="Primary"/);
  assert.match(html, /id="platform"/);
  assert.match(html, /id="live-preview"/);
  assert.match(html, /id="modules"/);
  assert.match(html, /id="applications"/);
  assert.match(html, /Future Capabilities/);
  assert.match(html, /Ready to modernize your facility operations\?/i);
});

test("navigation renders brand, menu, sign-in, and mobile controls", () => {
  const html = renderToStaticMarkup(createElement(LandingNav));
  assert.match(html, /FacilityOps home/);
  assert.match(html, /aria-label="Primary"/);
  assert.match(html, /aria-label="Mobile"/);
  assert.match(html, /aria-label="Open menu"/);
  assert.match(html, /Sign In/);
  for (const item of LANDING_NAV) {
    assert.match(html, new RegExp(item.label));
  }
});

test("hero renders headline, CTAs, and dashboard mock", () => {
  const html = renderToStaticMarkup(createElement(LandingHero));
  assert.match(html, /landing-hero-heading/);
  assert.match(html, /Open Platform/);
  assert.match(html, /Explore Features/);
  assert.match(html, /Active Tickets|Maintenance|5S Score|Notifications/);
  assert.match(html, /Upcoming Work/);
  assert.match(html, /Performance/);
});

test("module cards render configured titles", () => {
  const html = renderToStaticMarkup(createElement(ModulesSection));
  for (const item of LANDING_MODULES) {
    const encoded = item.title.replace(/&/g, "&amp;");
    assert.ok(html.includes(encoded), `missing module title: ${item.title}`);
  }
});

test("application cards render status and CTA mapping", () => {
  const html = renderToStaticMarkup(createElement(ApplicationsSection));
  assert.match(html, /FacilityOps/);
  assert.match(html, /Available/);
  assert.match(html, /Integrated Facility Management Platform/);
  assert.match(html, /href="\/login"/);
});

test("home metadata includes SEO title, description, and social cards", () => {
  assert.equal(homeMetadata.title, "FacilityOps | Smarter Facility Operations");
  assert.match(String(homeMetadata.description), /facility management/i);
  assert.ok(homeMetadata.openGraph);
  assert.ok(homeMetadata.twitter);
  assert.equal(
    "card" in homeMetadata.twitter ? homeMetadata.twitter.card : undefined,
    "summary_large_image",
  );
});

test("live platform preview renders accessible heading and shell", () => {
  const html = renderToStaticMarkup(createElement(LivePlatformPreview));
  assert.match(html, /id="live-preview"/);
  assert.match(html, /live-platform-preview-heading/);
  assert.match(html, /Live Platform Preview/);
  assert.match(html, /Demonstration data/);
  assert.match(html, /lg:flex/);
  assert.match(html, /md:hidden|xl:grid-cols-4|sm:grid/);
});

test("live platform preview renders metrics, activity, and work queue", () => {
  const html = renderToStaticMarkup(createElement(LivePlatformPreview));
  for (const metric of LIVE_PLATFORM_PREVIEW.metrics) {
    assert.ok(html.includes(metric.label), `missing metric: ${metric.label}`);
    assert.ok(html.includes(metric.value), `missing metric value: ${metric.value}`);
  }
  for (const item of LIVE_PLATFORM_PREVIEW.activity) {
    assert.ok(html.includes(item.type), `missing activity: ${item.type}`);
    assert.ok(html.includes(item.detail), `missing activity detail: ${item.detail}`);
  }
  for (const row of LIVE_PLATFORM_PREVIEW.workQueue) {
    assert.ok(html.includes(row.reference), `missing queue row: ${row.reference}`);
  }
});

test("live platform preview uses static data and labels future AI clearly", () => {
  assert.equal(LIVE_PLATFORM_PREVIEW.aiInsight.label, "Future Capability");
  assert.match(LIVE_PLATFORM_PREVIEW.aiInsight.disclaimer, /not available in production/i);
  const html = renderToStaticMarkup(createElement(LivePlatformPreview));
  assert.match(html, /Future Capability/);
  assert.match(html, /Three recurring equipment issues detected this month/);
  assert.doesNotMatch(html, /fetch\(|axios|api\/|localhost:\d+/i);
});

test("live platform preview contains no tenant or user identifiers", () => {
  const serialized = JSON.stringify(LIVE_PLATFORM_PREVIEW);
  for (const pattern of PREVIEW_FORBIDDEN_PATTERNS) {
    assert.doesNotMatch(serialized, pattern);
  }
  assert.doesNotMatch(serialized, /acarbonilla|hire.?now|real.?tenant/i);
});
