import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let envLoaded = false;

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function getWorkspaceRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

export function getRootEnvPath() {
  return path.join(getWorkspaceRoot(), ".env");
}

export function loadRootEnv() {
  if (envLoaded) {
    return process.env;
  }

  const envPath = getRootEnvPath();
  if (!existsSync(envPath)) {
    envLoaded = true;
    return process.env;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/u);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1).trim());
    process.env[key] = value;
  }

  envLoaded = true;
  return process.env;
}

export function requireEnv(name) {
  loadRootEnv();
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
