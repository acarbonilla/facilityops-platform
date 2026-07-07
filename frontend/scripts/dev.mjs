import net from "node:net";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const host = process.env.HOST || "127.0.0.1";
const startingPort = Number(process.env.PORT || "3000");

function canListen(hostname, port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }

      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, hostname);
  });
}

async function findAvailablePort(hostname, port) {
  let candidate = port;

  while (!(await canListen(hostname, candidate))) {
    candidate += 1;
  }

  return candidate;
}

const selectedPort = await findAvailablePort(host, startingPort);
const selectedDistDir = `.next-dev-${selectedPort}`;

if (selectedPort !== startingPort) {
  console.log(
    `Port ${startingPort} is already in use. Starting Next.js on ${selectedPort} instead.`,
  );
}

const child = spawn(
  process.execPath,
  [nextBin, "dev", "--hostname", host, "--port", String(selectedPort)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_DEV_DIST_DIR: selectedDistDir,
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
