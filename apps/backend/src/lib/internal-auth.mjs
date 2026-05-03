import { timingSafeEqual } from "node:crypto";

const LOCAL_INTERNAL_API_KEY = "local-vyb-internal-key";

export function getConfiguredInternalApiKey() {
  const configured = process.env.VYB_INTERNAL_API_KEY?.trim();

  if (configured && !(process.env.NODE_ENV === "production" && configured === LOCAL_INTERNAL_API_KEY)) {
    return configured;
  }

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_INTERNAL_API_KEY;
  }

  return null;
}

export function getRequiredInternalApiKey() {
  const key = getConfiguredInternalApiKey();
  if (!key) {
    throw new Error("VYB_INTERNAL_API_KEY must be set to a non-local value in production.");
  }

  return key;
}

export function isTrustedInternalApiKey(value) {
  const key = getConfiguredInternalApiKey();
  if (!key || typeof value !== "string") {
    return false;
  }

  const providedBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(key);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}
