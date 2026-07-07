import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    // Keep development output isolated from the production runtime directory
    // so stale trace files from builds do not block `next dev` on Windows.
    distDir:
      phase === PHASE_DEVELOPMENT_SERVER
        ? process.env.NEXT_DEV_DIST_DIR || ".next-dev"
        : process.env.NEXT_RUNTIME_DIST_DIR || ".next-runtime",
  };
}
