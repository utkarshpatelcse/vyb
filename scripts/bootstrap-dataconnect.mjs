import { ensureTenantScaffold, loadRootEnv } from "../packages/config/src/index.mjs";

function readFlag(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] ?? fallback;
}

loadRootEnv();

const tenantName = readFlag("--tenant-name", "Vyb Demo Institute");
const tenantSlug = readFlag("--tenant-slug", "vyb-demo");
const domain = readFlag("--domain", "vyb.local");

const scaffold = await ensureTenantScaffold({
  tenantName,
  tenantSlug,
  domain,
  communities: [
    { type: "general", name: "Campus Square", slug: "campus-square", visibility: "tenant" },
    { type: "batch", name: "CS Batch 2028", slug: "cs-batch-2028", visibility: "tenant" },
    { type: "hostel", name: "Boys Hostel A", slug: "boys-hostel-a", visibility: "tenant" }
  ]
});

console.log(
  JSON.stringify(
    {
      tenant: scaffold.tenant,
      communities: scaffold.communities
    },
    null,
    2
  )
);
