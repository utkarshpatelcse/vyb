import { getFirebaseDataConnect, loadRootEnv } from "../packages/config/src/index.mjs";
import {
  connectorConfig as campusConnectorConfig,
  getTenantByDomain,
  getTenantBySlug
} from "../packages/dataconnect/campus-admin-sdk/esm/index.esm.js";
import { resetTenantChatData } from "../apps/backend/src/modules/chat/repository.mjs";

function isUuid(value) {
  return (
    typeof value === "string" &&
    (/^[0-9a-f]{32}$/iu.test(value.trim()) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value.trim()))
  );
}

function readTenantSelector() {
  const tenantFlagIndex = process.argv.findIndex((argument) => argument === "--tenant");
  if (tenantFlagIndex >= 0) {
    return process.argv[tenantFlagIndex + 1] ?? null;
  }

  loadRootEnv();
  return process.env.VYB_CHAT_RESET_TENANT_ID ?? process.env.VYB_DEFAULT_TENANT_SLUG ?? null;
}

async function resolveTenantId(selector) {
  if (!selector) {
    return null;
  }

  if (isUuid(selector)) {
    return selector.trim();
  }

  const campusDc = getFirebaseDataConnect(campusConnectorConfig);
  const normalizedSelector = selector.trim();

  const slugResponse = await getTenantBySlug(campusDc, { slug: normalizedSelector }).catch(() => null);
  const slugTenant = slugResponse?.data?.tenants?.[0] ?? null;
  if (slugTenant?.id) {
    return slugTenant.id;
  }

  const domainResponse = await getTenantByDomain(campusDc, { domain: normalizedSelector }).catch(() => null);
  const domainTenant = domainResponse?.data?.tenantDomains?.[0]?.tenant ?? null;
  return domainTenant?.id ?? null;
}

async function main() {
  const tenantId = await resolveTenantId(readTenantSelector());
  if (!tenantId) {
    throw new Error("Provide a valid tenant UUID, slug, or domain with --tenant <value>.");
  }

  const startedAt = new Date().toISOString();
  const result = await resetTenantChatData(tenantId);

  console.log(
    JSON.stringify(
      {
        startedAt,
        finishedAt: new Date().toISOString(),
        ...result
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[chat-reset] failed", error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
