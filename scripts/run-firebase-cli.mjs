import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadRootEnv } from "../packages/config/src/root-env.mjs";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = path.join(workspaceRoot, ".tmp");
const firebaseBin = path.join(workspaceRoot, "node_modules", "firebase-tools", "lib", "bin", "firebase.js");

loadRootEnv();

mkdirSync(tmpDir, { recursive: true });

const childEnv = {
  ...process.env,
  TEMP: tmpDir,
  TMP: tmpDir
};

const cliArgs = [...process.argv.slice(2)];
if (!cliArgs.includes("--project") && process.env.FIREBASE_PROJECT_ID) {
  cliArgs.push("--project", process.env.FIREBASE_PROJECT_ID);
}

const child = spawn(process.execPath, [firebaseBin, ...cliArgs], {
  cwd: workspaceRoot,
  stdio: "inherit",
  env: childEnv
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
