import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import http from "node:http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const webRoot = path.join(workspaceRoot, "apps", "web");
const backendRoot = path.join(workspaceRoot, "apps", "backend");
const backendEntry = path.join(backendRoot, "src", "index.mjs");
const requireFromWeb = createRequire(path.join(webRoot, "package.json"));
const nextBin = requireFromWeb.resolve("next/dist/bin/next");
const LOCAL_HOST = "127.0.0.1";
const WEB_PORT = 3000;
const BACKEND_PORT = 4000;

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readHttpResponse(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      const chunks = [];

      response.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks).toString("utf8")
        });
      });
    });

    request.on("error", () => resolve(null));
    request.setTimeout(1200, () => {
      request.destroy();
      resolve(null);
    });
  });
}

async function isBackendHealthy() {
  const response = await readHttpResponse(`http://${LOCAL_HOST}:${BACKEND_PORT}/health`);
  return response?.statusCode === 200;
}

async function getExistingWebServerStatus() {
  const response = await readHttpResponse(`http://${LOCAL_HOST}:${WEB_PORT}/login`);

  if (!response) {
    return {
      running: false,
      isVybWeb: false
    };
  }

  const poweredBy = String(response.headers["x-powered-by"] ?? "").toLowerCase();
  const contentType = String(response.headers["content-type"] ?? "").toLowerCase();
  const body = response.body.toLowerCase();
  const isNextServer = poweredBy.includes("next.js");
  const looksLikeHtml = contentType.includes("text/html");
  const isVybWeb =
    isNextServer &&
    looksLikeHtml &&
    (body.includes("trusted campus access starts with a verified college identity") ||
      body.includes("verified campus network") ||
      body.includes("welcome back to vyb"));

  return {
    running: true,
    isVybWeb
  };
}

async function waitForBackendReady(maxAttempts = 30) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (await isBackendHealthy()) {
      return true;
    }

    await wait(500);
  }

  return false;
}

function spawnProcess(command, args, cwd) {
  return spawn(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env
  });
}

let backendProcess = null;
let webProcess = null;

function startBackendProcess({ watch }) {
  const args = watch ? ["--watch", backendEntry] : [backendEntry];
  return spawnProcess(process.execPath, args, backendRoot);
}

async function ensureBackend() {
  if (await isBackendHealthy()) {
    console.log(`[dev:web] backend already available on http://localhost:${BACKEND_PORT}`);
    return;
  }

  console.log(`[dev:web] starting backend dev server on http://localhost:${BACKEND_PORT}`);
  backendProcess = startBackendProcess({ watch: true });

  let backendReady = await waitForBackendReady(12);
  if (backendReady) {
    return;
  }

  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill("SIGINT");
  }

  console.warn("[dev:web] backend watch mode did not become ready, retrying without --watch");
  backendProcess = startBackendProcess({ watch: false });
  backendReady = await waitForBackendReady(12);

  if (!backendReady) {
    throw new Error(`Backend dev server did not become ready on port ${BACKEND_PORT}.`);
  }
}

async function ensureWeb() {
  const existingWeb = await getExistingWebServerStatus();

  if (existingWeb.running && existingWeb.isVybWeb) {
    console.log(`[dev:web] web dev server already available on http://localhost:${WEB_PORT}`);
    return;
  }

  if (existingWeb.running) {
    throw new Error(
      `Port ${WEB_PORT} is already in use by another process. Stop it first, then run "npx pnpm dev" again.`
    );
  }

  console.log(`[dev:web] starting Next.js dev server on http://localhost:${WEB_PORT}`);
  webProcess = spawnProcess(process.execPath, [nextBin, "dev", "--hostname", LOCAL_HOST, "--port", String(WEB_PORT)], webRoot);

  webProcess.on("exit", (code) => {
    if (backendProcess && !backendProcess.killed) {
      backendProcess.kill("SIGINT");
    }

    process.exit(code ?? 0);
  });
}

function shutdown(exitCode = 0) {
  if (webProcess && !webProcess.killed) {
    webProcess.kill("SIGINT");
  }

  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill("SIGINT");
  }

  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

try {
  await ensureBackend();
  await ensureWeb();

  if (!webProcess) {
    await new Promise(() => {});
  }
} catch (error) {
  console.error("[dev:web] failed to start local development environment");
  console.error(error instanceof Error ? error.message : error);

  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill("SIGINT");
  }

  process.exit(1);
}
