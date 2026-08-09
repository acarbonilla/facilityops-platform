import assert from "node:assert/strict";
import test from "node:test";

import {
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  readSidebarCollapsedPreference,
  writeSidebarCollapsedPreference,
} from "./sidebar-preference";

test("FO-116 sidebar preference key is stable", () => {
  assert.equal(SIDEBAR_COLLAPSED_STORAGE_KEY, "facilityops.sidebar.collapsed");
});

test("FO-116 sidebar preference round-trips through localStorage", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  const originalWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });

  try {
    assert.equal(readSidebarCollapsedPreference(), null);
    writeSidebarCollapsedPreference(true);
    assert.equal(readSidebarCollapsedPreference(), true);
    writeSidebarCollapsedPreference(false);
    assert.equal(readSidebarCollapsedPreference(), false);
  } finally {
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, "window");
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  }
});
