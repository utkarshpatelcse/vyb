import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(path, "utf8");
}

async function validateMarketMediaOwnership() {
  const source = await read("apps/backend/src/modules/market/repository.mjs");

  assert.match(
    source,
    /function assertOwnedMarketMediaAsset\(asset, \{ tenantId, userId \}\)/,
    "market media persistence should validate tenant/user ownership"
  );
  assert.match(
    source,
    /function filterOwnedMarketMediaAssetsForDelete\(assets, \{ tenantId, userId \}\)/,
    "market media deletion should filter by tenant/user ownership"
  );
  assert.match(
    source,
    /function buildPersistedMedia\(asset, createdAt, owner\)/,
    "market media persistence should require an owner context"
  );
  assert.equal(
    (source.match(/buildPersistedMedia\(asset, createdAt, \{/g) ?? []).length,
    4,
    "all market media create/update call sites should pass owner context"
  );
  assert.equal(
    (source.match(/deleteMarketMediaAssets\(\s*(?:removedMedia|existingMedia)\.map/gs) ?? []).length,
    4,
    "all market media deletion call sites should go through the guarded deletion helper"
  );
  assert.match(
    source,
    /parsed\.tenantId === tenantId && parsed\.userId === userId/,
    "market media deletion should require the stored object path owner to match the actor"
  );
}

async function validateModerationTenantBinding() {
  const route = await read("apps/backend/src/modules/moderation/index.mjs");
  const repository = await read("apps/backend/src/modules/moderation/repository.mjs");
  const operations = await read("packages/dataconnect/moderation/operations.gql");

  assert.match(route, /resolveModerationCaseRecord\(\{\s*tenantId,/s, "resolve route should pass tenantId");
  assert.match(repository, /GET_REPORT_BY_TENANT_AND_ID_QUERY/, "case creation should use exact tenant-bound report lookup");
  assert.match(
    repository,
    /GET_MODERATION_CASE_BY_TENANT_AND_ID_QUERY/,
    "case resolution should use exact tenant-bound case lookup"
  );
  assert.match(
    repository,
    /executeGraphqlRead\(GET_REPORT_BY_TENANT_AND_ID_QUERY,[^]*variables: \{\s*tenantId,\s*reportId/s,
    "report tenant pre-check should bind tenantId and reportId in the same query"
  );
  assert.match(
    repository,
    /executeGraphqlRead\(GET_MODERATION_CASE_BY_TENANT_AND_ID_QUERY,[^]*variables: \{\s*tenantId,\s*id/s,
    "case tenant pre-check should bind tenantId and case id in the same query"
  );
  assert.doesNotMatch(repository, /limit: 5000/, "moderation tenant checks should not depend on a large list window");
  assert.match(repository, /export async function resolveModerationCaseRecord\(\{ tenantId, id, decision, notes = null \}\)/);
  assert.match(
    operations,
    /mutation ResolveModerationCase\([^]*moderationCase_update\(\s*key: \{ id: \$id \}/,
    "DataConnect mutation remains key-based, so repository pre-check must stay in place"
  );
}

async function validateSocialMediaVerification() {
  const route = await read("apps/backend/src/modules/social/index.mjs");
  const repository = await read("apps/backend/src/modules/social/repository.mjs");

  assert.match(route, /function validateSocialMediaPayload\(input\)/, "social route should expose shared media validation");
  assert.match(route, /INVALID_POST_MEDIA/, "feed posts should reject unverified media");
  assert.match(route, /INVALID_STORY_MEDIA/, "stories should reject unverified media");
  assert.match(route, /assetType: "posts"/, "feed post validation should bind posts storage paths");
  assert.match(route, /assetType: "stories"/, "story validation should bind stories storage paths");
  assert.match(route, /isSafeSocialMediaUrl\(trimmedMediaUrl, trimmedStoragePath\)/, "media URL should match storage object path");
  assert.match(
    repository,
    /if \(!decoded\) \{\s*return \{\s*mediaUrl,/s,
    "repository still accepts stored URLs, so route-level verification is required"
  );
}

async function validateStorageRulesMimeAllowlist() {
  const rules = await read("storage.rules");

  assert.doesNotMatch(rules, /contentType\.matches\("image\/\.\*"\)/, "storage rules should not allow every image/* MIME");
  assert.doesNotMatch(rules, /contentType\.matches\("video\/\.\*"\)/, "storage rules should not allow every video/* MIME");
  for (const mimeType of [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
    "video/mp4",
    "video/webm",
    "video/quicktime"
  ]) {
    assert.match(rules, new RegExp(`"${mimeType.replace("/", "\\/")}"`), `${mimeType} should be explicitly allowed`);
  }
}

async function validateStoryMusicProxyGuardrails() {
  const route = await read("apps/web/app/api/story-music/route.ts");

  assert.match(route, /function isSafeAudioSourceUrl\(value: string\)/, "story music stream should validate remote audio URLs");
  assert.match(route, /function fetchAudioSource\(url: string, redirectsRemaining = STORY_MUSIC_MAX_REDIRECTS\)/, "story music stream should manually validate redirects");
  assert.match(route, /redirect: "manual"/, "story music stream should not auto-follow unvalidated redirects");
  assert.match(route, /STORY_MUSIC_FETCH_TIMEOUT_MS/, "story music fetches should have a timeout");
  assert.match(route, /STORY_MUSIC_MAX_STREAM_BYTES/, "story music streams should have a byte cap");
  assert.match(route, /hasSafeAudioContentType\(audioResponse\)/, "story music stream should reject non-audio content types");
  assert.match(route, /limitReadableStream\(audioResponse\.body, STORY_MUSIC_MAX_STREAM_BYTES\)/, "story music stream should enforce the byte cap while streaming");
}

async function validateFfmpegTimeouts() {
  for (const filePath of [
    "apps/backend/src/modules/social/repository.mjs",
    "apps/web/src/lib/social-media-server.ts"
  ]) {
    const source = await read(filePath);
    assert.match(source, /FFMPEG_TIMEOUT_MS = 120000/, `${filePath} should define a bounded FFmpeg timeout`);
    assert.match(source, /setTimeout\([^]*FFMPEG_TIMEOUT_MS/, `${filePath} should arm a timeout for FFmpeg processes`);
    assert.match(source, /child\.kill\("SIGKILL"\)/, `${filePath} should kill FFmpeg when the timeout expires`);
    assert.match(source, /let settled = false/, `${filePath} should avoid double-resolving FFmpeg promises`);
  }
}

await validateMarketMediaOwnership();
await validateModerationTenantBinding();
await validateSocialMediaVerification();
await validateStorageRulesMimeAllowlist();
await validateStoryMusicProxyGuardrails();
await validateFfmpegTimeouts();

console.log("[next-security-fixes] all validations passed");
