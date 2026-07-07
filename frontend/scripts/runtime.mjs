import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const command = process.argv[2];
const workspaceRoot = process.cwd();
const locationFile = path.join(workspaceRoot, ".next-runtime-location");

function getRuntimeDirBase() {
  return process.env.NEXT_RUNTIME_DIST_BASE || ".next-runtime";
}

function getRuntimeDirForBuild() {
  const base = getRuntimeDirBase();
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  return `${base}-${stamp}-${process.pid}`;
}

async function getRuntimeDirForStart() {
  if (process.env.NEXT_RUNTIME_DIST_DIR) {
    return process.env.NEXT_RUNTIME_DIST_DIR;
  }

  try {
    const value = (await readFile(locationFile, "utf8")).trim();
    if (value) {
      return value;
    }
  } catch {}

  return getRuntimeDirBase();
}

function runNext(args, runtimeDir) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [nextBin, ...args], {
      stdio: "inherit",
      env: {
        ...process.env,
        NEXT_RUNTIME_DIST_DIR: runtimeDir,
      },
    });

    child.on("exit", (code, signal) => {
      resolve({ code: code ?? 0, signal });
    });
  });
}

if (command !== "build" && command !== "start") {
  console.error("Usage: node scripts/runtime.mjs <build|start>");
  process.exit(1);
}

if (command === "build") {
  const runtimeDir = getRuntimeDirForBuild();
  const result = await runNext(["build"], runtimeDir);

  if (!result.signal && result.code === 0) {
    await writeFile(locationFile, `${runtimeDir}\n`, "utf8");
  }

  if (result.signal) {
    process.kill(process.pid, result.signal);
  }

  process.exit(result.code);
}

const runtimeDir = await getRuntimeDirForStart();
const result = await runNext(["start"], runtimeDir);

if (result.signal) {
  process.kill(process.pid, result.signal);
}

process.exit(result.code);
