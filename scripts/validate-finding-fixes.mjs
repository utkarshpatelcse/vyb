import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function readRepoFile(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function assertMatch(source, pattern, description) {
  if (!pattern.test(source)) {
    throw new Error(`Missing validation marker: ${description}`);
  }
}

function assertIncludes(source, text, description) {
  if (!source.includes(text)) {
    throw new Error(`Missing validation marker: ${description}`);
  }
}

const [
  eventsFallback,
  eventsRoute,
  eventRoute,
  eventRegistrationRoute,
  postsRoute,
  safeApiError
] = await Promise.all([
  readRepoFile("apps/web/src/lib/events-fallback.ts"),
  readRepoFile("apps/web/app/api/events/route.ts"),
  readRepoFile("apps/web/app/api/events/[eventId]/route.ts"),
  readRepoFile("apps/web/app/api/events/[eventId]/register/route.ts"),
  readRepoFile("apps/web/app/api/posts/[postId]/route.ts"),
  readRepoFile("apps/web/src/lib/safe-api-error.ts")
]);

assertMatch(eventsFallback, /process\.env\.VERCEL[\s\S]*path\.join\("\/tmp", "vyb-campus-events"\)/, "events fallback writes to /tmp on Vercel");
assertMatch(eventsFallback, /process\.env\.VYB_EVENTS_STORE_ROOT/, "events store supports an explicit writable root override");
assertMatch(eventsRoute, /toSafeApiErrorMessage\(error, "We could not publish the event\."\)/, "event create sanitizes runtime errors");
assertMatch(eventsRoute, /EVENTS_DASHBOARD_FAILED/, "events dashboard failures return JSON instead of crashing");
assertMatch(eventRoute, /toSafeApiErrorMessage\(error, "We could not update the event\."\)/, "event update sanitizes runtime errors");
assertMatch(eventRegistrationRoute, /toSafeApiErrorMessage\(error, "We could not submit this registration\."\)/, "event registration sanitizes runtime errors");
assertMatch(postsRoute, /isBackendRequestError\(error\)[\s\S]*status: error\.statusCode/, "post mutations preserve upstream backend status codes");
assertMatch(postsRoute, /code: error\.code[\s\S]*message: error\.message/, "post mutations preserve upstream backend error codes and messages");
assertIncludes(safeApiError, String.raw`/\b\/var\/task\b/i`, "safe API helper redacts Vercel runtime paths");
assertIncludes(safeApiError, String.raw`/\bENOENT\b/i`, "safe API helper redacts filesystem errors");

console.log("Finding fix validation passed.");
