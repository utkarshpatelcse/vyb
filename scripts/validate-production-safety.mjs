import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  VYB_SESSION_SECRET: process.env.VYB_SESSION_SECRET,
  VYB_INTERNAL_API_KEY: process.env.VYB_INTERNAL_API_KEY,
  VYB_CORS_ALLOWED_ORIGINS: process.env.VYB_CORS_ALLOWED_ORIGINS,
  VYB_WEB_ORIGIN: process.env.VYB_WEB_ORIGIN
};

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function tamperSignedCookie(cookie, mutatePayload) {
  const [encodedPayload, signature] = cookie.split(".");
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  const tamperedPayload = mutatePayload(payload);
  return `${Buffer.from(JSON.stringify(tamperedPayload), "utf8").toString("base64url")}.${signature}`;
}

async function validateSignedSessionCookies() {
  process.env.NODE_ENV = "production";
  process.env.VYB_SESSION_SECRET = "test-session-secret-with-enough-entropy";
  delete process.env.VYB_INTERNAL_API_KEY;

  const { createViewerSession, decodeDevSession, encodeDevSession } = await import("../apps/web/src/lib/dev-session.ts");
  const session = createViewerSession({
    email: "student@example.edu",
    displayName: "Student One",
    userId: "firebase-user-1",
    membershipId: "membership-1",
    tenantId: "tenant-1"
  });
  const cookie = encodeDevSession(session);

  assert.equal(cookie.split(".").length, 2, "session cookie should include payload and signature");
  assert.deepEqual(decodeDevSession(cookie), session, "signed session should decode");
  assert.equal(
    decodeDevSession(tamperSignedCookie(cookie, (payload) => ({ ...payload, role: "admin" }))),
    null,
    "tampered role should invalidate the session"
  );
  assert.equal(
    decodeDevSession(Buffer.from(JSON.stringify(session), "utf8").toString("base64url")),
    null,
    "legacy unsigned sessions should be rejected"
  );

  delete process.env.VYB_SESSION_SECRET;
  process.env.VYB_INTERNAL_API_KEY = "production-internal-secret";
  assert.throws(
    () => encodeDevSession(session),
    /VYB_SESSION_SECRET/,
    "production session signing should fail closed without a dedicated session secret"
  );
}

async function validateInternalKeyAndCors() {
  const internalAuth = await import("../apps/backend/src/lib/internal-auth.mjs");
  const http = await import("../apps/backend/src/lib/http.mjs");

  process.env.NODE_ENV = "production";
  delete process.env.VYB_INTERNAL_API_KEY;
  assert.equal(internalAuth.getConfiguredInternalApiKey(), null, "production should not use an implicit internal key");
  assert.equal(internalAuth.isTrustedInternalApiKey("local-vyb-internal-key"), false, "default internal key should not be trusted in production");

  process.env.VYB_INTERNAL_API_KEY = "local-vyb-internal-key";
  assert.equal(internalAuth.getConfiguredInternalApiKey(), null, "explicit local key should still be rejected in production");

  process.env.VYB_INTERNAL_API_KEY = "production-secret";
  assert.equal(internalAuth.isTrustedInternalApiKey("production-secret"), true, "configured internal key should be trusted");

  process.env.VYB_CORS_ALLOWED_ORIGINS = "https://app.example.com";
  delete process.env.VYB_WEB_ORIGIN;
  assert.equal(http.resolveCorsAllowOrigin("https://app.example.com"), "https://app.example.com", "configured CORS origin should be allowed");
  assert.equal(http.resolveCorsAllowOrigin("https://evil.example.com"), null, "unconfigured CORS origin should be blocked");
  assert.equal(http.buildCorsHeaders(null)["access-control-allow-origin"], undefined, "CORS should not default to wildcard");
}

async function validateStaticInvariants() {
  const files = new Map(
    await Promise.all(
      [
        "apps/backend/src/modules/resources/index.mjs",
        "apps/backend/src/modules/social/index.mjs",
        "apps/backend/src/modules/social/realtime-hub.mjs",
        "apps/web/src/lib/backend-bridge.ts",
        "apps/web/src/lib/connect-data.ts",
        "apps/web/src/lib/queens-data.ts",
        "apps/backend/src/modules/chat/repository.mjs",
        "apps/web/app/api/admin/posts/[postId]/identity/route.ts",
        "apps/web/app/api/admin/comments/[commentId]/identity/route.ts"
      ].map(async (path) => [path, await readFile(path, "utf8")])
    )
  );

  assert.match(files.get("apps/backend/src/modules/resources/index.mjs"), /tenantId\.trim\(\) !== resolved\.live\.tenant\.id/);
  assert.match(files.get("apps/backend/src/modules/resources/index.mjs"), /filter\(\(item\) => item\.tenantId === resolved\.live\.tenant\.id\)/);
  assert.match(files.get("apps/backend/src/modules/resources/index.mjs"), /data\.data\.resource\.tenantId !== resolved\.live\.tenant\.id/);
  assert.match(files.get("apps/backend/src/modules/social/index.mjs"), /isSocialRoutePath\(url\.pathname\)/);
  assert.ok(
    files.get("apps/backend/src/modules/social/index.mjs").includes("resolved?.live?.tenant?.id === tenantId"),
    "social realtime auth should compare token tenant against live tenant"
  );
  assert.match(files.get("apps/backend/src/modules/social/realtime-hub.mjs"), /typeof payload\?\.email !== "string"/);
  assert.match(files.get("apps/web/src/lib/backend-bridge.ts"), /const context = await modules\.createRequestContext\(request\)/);
  assert.doesNotMatch(files.get("apps/web/src/lib/connect-data.ts"), /Math\.min\(value, serverElapsedSeconds\)/);
  assert.doesNotMatch(files.get("apps/web/src/lib/queens-data.ts"), /Math\.min\(value, serverElapsedSeconds\)/);
  assert.match(files.get("apps/backend/src/modules/chat/repository.mjs"), /messageSummary\.visibleMessages\.filter/);
  assert.doesNotMatch(files.get("apps/web/app/api/admin/posts/[postId]/identity/route.ts"), /viewer\.role/);
  assert.doesNotMatch(files.get("apps/web/app/api/admin/comments/[commentId]/identity/route.ts"), /viewer\.role/);
}

try {
  await validateSignedSessionCookies();
  await validateInternalKeyAndCors();
  await validateStaticInvariants();
  console.log("[production-safety] all validations passed");
} finally {
  restoreEnv();
}
