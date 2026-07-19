import assert from "node:assert/strict";
import test from "node:test";

import { QueryClient } from "@tanstack/react-query";

import { clearSessionQueryCache } from "./session-cache";

test("clears tenant-scoped query data between authenticated sessions", async () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["master-data", "organizations"], {
    results: [{ id: "tenant-a-record" }],
  });
  queryClient.setQueryData(["dashboard", "foundation-summary"], {
    active_assets: 1,
  });

  await clearSessionQueryCache(queryClient);

  assert.equal(queryClient.getQueryCache().getAll().length, 0);
});
