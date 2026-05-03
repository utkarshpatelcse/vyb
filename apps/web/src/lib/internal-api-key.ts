import "server-only";

const LOCAL_INTERNAL_API_KEY = "local-vyb-internal-key";

export function getInternalApiKey() {
  const configured = process.env.VYB_INTERNAL_API_KEY?.trim();

  if (configured && !(process.env.NODE_ENV === "production" && configured === LOCAL_INTERNAL_API_KEY)) {
    return configured;
  }

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_INTERNAL_API_KEY;
  }

  throw new Error("VYB_INTERNAL_API_KEY must be set to a non-local value in production.");
}
