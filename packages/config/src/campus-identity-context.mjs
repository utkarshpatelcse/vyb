import {
  connectorConfig as identityConnectorConfig,
  createUser,
  getUserByFirebaseUid,
  updateUserProfile
} from "../../dataconnect/identity-admin-sdk/esm/index.esm.js";
import {
  connectorConfig as campusConnectorConfig,
  createCommunity,
  createCommunityMembership,
  createTenant,
  createTenantDomain,
  createTenantMembership,
  getCommunityBySlug,
  getMembershipContext,
  getTenantByDomain,
  getTenantBySlug,
  listCommunitiesByTenant,
  listCommunitiesForMembership
} from "../../dataconnect/campus-admin-sdk/esm/index.esm.js";
import { getFirebaseDataConnect } from "./firebase-admin.mjs";
import { loadRootEnv } from "./root-env.mjs";
import { isSuperAdminEmail } from "./super-admin-access.mjs";

function getEmailDomain(email) {
  return String(email).split("@")[1]?.trim().toLowerCase() ?? null;
}

function toNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getDefaultTenantSlug() {
  loadRootEnv();
  return toNonEmptyString(process.env.VYB_DEFAULT_TENANT_SLUG);
}

function getDefaultTenantDomain() {
  loadRootEnv();
  return toNonEmptyString(process.env.VYB_DEFAULT_TENANT_DOMAIN);
}

function buildTenantMembershipKey(tenantId, userId) {
  return `${tenantId}:${userId}`;
}

function buildCommunityMembershipKey(communityId, membershipId) {
  return `${communityId}:${membershipId}`;
}

function getIdentityDc() {
  loadRootEnv();
  return getFirebaseDataConnect(identityConnectorConfig);
}

function getCampusDc() {
  loadRootEnv();
  return getFirebaseDataConnect(campusConnectorConfig);
}

async function fetchUserByFirebaseUid(firebaseUid) {
  const response = await getUserByFirebaseUid(getIdentityDc(), { firebaseUid });
  return response.data.users[0] ?? null;
}

export async function ensureUserRecord({
  firebaseUid,
  primaryEmail,
  displayName,
  emailVerified = true,
  avatarUrl = null
}) {
  let user = await fetchUserByFirebaseUid(firebaseUid);

  if (!user) {
    await createUser(getIdentityDc(), {
      firebaseUid,
      primaryEmail,
      emailVerified,
      displayName: toNonEmptyString(displayName),
      avatarUrl: toNonEmptyString(avatarUrl)
    });
    user = await fetchUserByFirebaseUid(firebaseUid);
  } else if (
    toNonEmptyString(displayName) &&
    (user.displayName !== displayName || (avatarUrl ?? null) !== (user.avatarUrl ?? null))
  ) {
    await updateUserProfile(getIdentityDc(), {
      id: user.id,
      displayName: toNonEmptyString(displayName),
      avatarUrl: toNonEmptyString(avatarUrl)
    });
    user = await fetchUserByFirebaseUid(firebaseUid);
  }

  if (!user) {
    throw new Error("Unable to create or fetch user from Data Connect.");
  }

  return user;
}

export async function resolveTenantDomain(domain) {
  const response = await getTenantByDomain(getCampusDc(), { domain });
  return response.data.tenantDomains[0] ?? null;
}

async function resolveTenantForEmailDomain(domain) {
  try {
    const tenantDomain = await resolveTenantDomain(domain);
    if (tenantDomain?.tenant) {
      return {
        tenant: tenantDomain.tenant,
        tenantDomain,
        resolution: "domain"
      };
    }
  } catch (error) {
    console.warn(
      `[campus-context] domain lookup failed for ${domain}; falling back to default tenant slug if configured.`,
      error instanceof Error ? error.message : error
    );
  }

  const defaultTenantSlug = getDefaultTenantSlug();
  const defaultTenantDomain = getDefaultTenantDomain();
  if (!defaultTenantSlug) {
    return {
      tenant: null,
      tenantDomain: null,
      resolution: "none"
    };
  }

  if (defaultTenantDomain && defaultTenantDomain !== domain) {
    return {
      tenant: null,
      tenantDomain: null,
      resolution: "none"
    };
  }

  const tenantResponse = await getTenantBySlug(getCampusDc(), { slug: defaultTenantSlug });
  const tenant = tenantResponse.data.tenants[0] ?? null;

  return {
    tenant,
    tenantDomain: null,
    resolution: tenant ? "default-slug" : "none"
  };
}

async function resolveTenantForSuperAdminEmail(email) {
  if (!isSuperAdminEmail(email)) {
    return null;
  }

  const defaultTenantSlug = getDefaultTenantSlug() ?? "kiet";

  const tenantResponse = await getTenantBySlug(getCampusDc(), { slug: defaultTenantSlug });
  return tenantResponse.data.tenants[0] ?? null;
}

export async function ensureMembershipContext({
  firebaseUid,
  primaryEmail,
  displayName,
  role = "student"
}) {
  const user = await ensureUserRecord({
    firebaseUid,
    primaryEmail,
    displayName
  });

  const domain = getEmailDomain(primaryEmail);
  if (!domain) {
    return { user, tenant: null, membership: null, communities: [] };
  }

  const superAdminTenant = await resolveTenantForSuperAdminEmail(primaryEmail);
  const tenantResolution = superAdminTenant
    ? {
        tenant: superAdminTenant,
        tenantDomain: null,
        resolution: "super-admin"
      }
    : await resolveTenantForEmailDomain(domain);
  if (!tenantResolution.tenant) {
    return { user, tenant: null, membership: null, communities: [] };
  }

  const tenant = tenantResolution.tenant;
  const membershipRole = isSuperAdminEmail(primaryEmail) ? "admin" : role;
  let membershipResponse = await getMembershipContext(getCampusDc(), {
    userId: user.id,
    tenantId: tenant.id
  });
  let membership = membershipResponse.data.tenantMemberships[0] ?? null;

  if (!membership) {
    await createTenantMembership(getCampusDc(), {
      tenantMembershipKey: buildTenantMembershipKey(tenant.id, user.id),
      tenantId: tenant.id,
      userId: user.id,
      role: membershipRole,
      verificationStatus: "verified",
      branch: null,
      batchYear: null,
      hostel: null
    });

    membershipResponse = await getMembershipContext(getCampusDc(), {
      userId: user.id,
      tenantId: tenant.id
    });
    membership = membershipResponse.data.tenantMemberships[0] ?? null;
  }

  if (!membership) {
    throw new Error("Unable to create or fetch tenant membership from Data Connect.");
  }

  let communitiesResponse = await listCommunitiesForMembership(getCampusDc(), {
    membershipId: membership.id
  });
  let communityMemberships = communitiesResponse.data.communityMemberships;

  if (communityMemberships.length === 0) {
    const tenantCommunitiesResponse = await listCommunitiesByTenant(getCampusDc(), {
      tenantId: tenant.id
    });
    const defaultCommunity =
      tenantCommunitiesResponse.data.communities.find((item) => item.type === "general") ??
      tenantCommunitiesResponse.data.communities[0] ??
      null;

    if (defaultCommunity) {
      await createCommunityMembership(getCampusDc(), {
        communityMembershipKey: buildCommunityMembershipKey(defaultCommunity.id, membership.id),
        communityId: defaultCommunity.id,
        membershipId: membership.id,
        role: "member"
      });

      communitiesResponse = await listCommunitiesForMembership(getCampusDc(), {
        membershipId: membership.id
      });
      communityMemberships = communitiesResponse.data.communityMemberships;
    }
  }

  return {
    user,
    tenant,
    membership,
    communities: communityMemberships
  };
}

export async function ensureTenantScaffold({
  tenantName,
  tenantSlug,
  domain,
  communities
}) {
  let tenantResponse = await getTenantBySlug(getCampusDc(), { slug: tenantSlug });
  let tenant = tenantResponse.data.tenants[0] ?? null;

  if (!tenant) {
    await createTenant(getCampusDc(), {
      name: tenantName,
      slug: tenantSlug,
      status: "active"
    });
    tenantResponse = await getTenantBySlug(getCampusDc(), { slug: tenantSlug });
    tenant = tenantResponse.data.tenants[0] ?? null;
  }

  if (!tenant) {
    throw new Error("Unable to create or fetch tenant scaffold.");
  }

  const tenantDomain = await resolveTenantDomain(domain);
  if (!tenantDomain) {
    await createTenantDomain(getCampusDc(), {
      tenantDomainKey: `${tenant.id}:${domain}`,
      tenantId: tenant.id,
      domain,
      isPrimary: true,
      verificationMode: "domain"
    });
  }

  for (const community of communities) {
    const existing = await getCommunityBySlug(getCampusDc(), {
      tenantId: tenant.id,
      slug: community.slug
    });

    if (existing.data.communities[0]) {
      continue;
    }

    await createCommunity(getCampusDc(), {
      tenantId: tenant.id,
      type: community.type,
      name: community.name,
      slug: community.slug,
      visibility: community.visibility ?? "tenant"
    });
  }

  const seededCommunities = await listCommunitiesByTenant(getCampusDc(), {
    tenantId: tenant.id
  });

  return {
    tenant,
    communities: seededCommunities.data.communities
  };
}
