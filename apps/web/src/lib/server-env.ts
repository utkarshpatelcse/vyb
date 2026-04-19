import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

let envLoaded = false;

function normalizeValue(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function loadWorkspaceRootEnv() {
  if (envLoaded) {
    return process.env;
  }

  const envPath = path.resolve(process.cwd(), "../../.env");
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

    process.env[key] = normalizeValue(trimmed.slice(separatorIndex + 1).trim());
  }

  envLoaded = true;
  return process.env;
}
