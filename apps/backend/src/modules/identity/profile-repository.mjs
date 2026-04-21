import { getFirebaseDataConnect } from "../../../../../packages/config/src/index.mjs";
import { connectorConfig as campusConnectorConfig } from "../../../../../packages/dataconnect/campus-admin-sdk/esm/index.esm.js";

const TENANT_PROFILE_LIMIT = 5000;

const PROFILE_FIELDS = `
  id
  tenantId
  userId
  role
  verificationStatus
  username
  usernameKey
  firstName
  lastName
  fullName
  course
  branch
  batchYear
  hostel
  section
  phoneNumber
  profileCompleted
  createdAt
  updatedAt
  tenant {
    id
    name
    slug
  }
  user {
    id
    primaryEmail
    displayName
  }
`;

const GET_PROFILE_BY_USER_AND_TENANT_QUERY = `
  query GetTenantMembershipProfileByUserAndTenant($tenantId: UUID!, $userId: UUID!) {
    tenantMemberships(
      where: {
        tenantId: { eq: $tenantId }
        userId: { eq: $userId }
        deletedAt: { isNull: true }
      }
      limit: 1
    ) {
      ${PROFILE_FIELDS}
    }
  }
`;

const GET_PROFILE_BY_USERNAME_QUERY = `
  query GetTenantMembershipProfileByUsername($tenantId: UUID!, $usernameKey: String!) {
    tenantMemberships(
      where: {
        tenantId: { eq: $tenantId }
        usernameKey: { eq: $usernameKey }
        profileCompleted: { eq: true }
        deletedAt: { isNull: true }
      }
      limit: 1
    ) {
      ${PROFILE_FIELDS}
    }
  }
`;

const LIST_PROFILES_BY_TENANT_QUERY = `
  query ListTenantMembershipProfilesByTenant($tenantId: UUID!, $limit: Int!) {
    tenantMemberships(
      where: {
        tenantId: { eq: $tenantId }
        profileCompleted: { eq: true }
        deletedAt: { isNull: true }
      }
      orderBy: [{ updatedAt: DESC }]
      limit: $limit
    ) {
      ${PROFILE_FIELDS}
    }
  }
`;

const UPDATE_PROFILE_MUTATION = `
  mutation UpdateTenantMembershipProfile(
    $id: UUID!
    $username: String!
    $usernameKey: String!
    $firstName: String!
    $lastName: String
    $fullName: String!
    $course: String!
    $branch: String!
    $batchYear: Int!
    $hostel: String
    $section: String!
    $phoneNumber: String
  ) {
    tenantMembership_update(
      key: { id: $id }
      data: {
        username: $username
        usernameKey: $usernameKey
        firstName: $firstName
        lastName: $lastName
        fullName: $fullName
        course: $course
        branch: $branch
        batchYear: $batchYear
        hostel: $hostel
        section: $section
        phoneNumber: $phoneNumber
        profileCompleted: true
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const UPDATE_USERNAME_MUTATION = `
  mutation UpdateTenantMembershipUsername($id: UUID!, $username: String!, $usernameKey: String!) {
    tenantMembership_update(
      key: { id: $id }
      data: {
        username: $username
        usernameKey: $usernameKey
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

function getCampusDc() {
  return getFirebaseDataConnect(campusConnectorConfig);
}

function toNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function sanitizeUsername(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^@+/u, "")
    .replace(/\s+/gu, "_")
    .replace(/[^a-z0-9._]+/gu, "_")
    .replace(/[._]{2,}/gu, "_")
    .replace(/^[._]+|[._]+$/gu, "");

  if (normalized.length < 3 || normalized.length > 24) {
    return null;
  }

  if (!/^[a-z0-9](?:[a-z0-9._]{1,22}[a-z0-9])?$/u.test(normalized)) {
    return null;
  }

  return normalized;
}

function buildUsernameKey(tenantId, username) {
  return `${tenantId}:${username}`;
}

function matchQuery(profile, query) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return false;
  }

  const lowered = normalizedQuery.toLowerCase();
  return [profile.username, profile.fullName, profile.firstName, profile.lastName]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(lowered));
}

function mapMembershipProfile(item) {
  if (
    !item ||
    item.profileCompleted !== true ||
    !toNonEmptyString(item.username) ||
    !toNonEmptyString(item.firstName) ||
    !toNonEmptyString(item.fullName) ||
    !toNonEmptyString(item.course) ||
    !toNonEmptyString(item.branch) ||
    !Number.isInteger(item.batchYear) ||
    !toNonEmptyString(item.section) ||
    !item.tenant?.name ||
    !item.user?.primaryEmail
  ) {
    return null;
  }

  return {
    userId: item.userId,
    tenantId: item.tenantId,
    primaryEmail: item.user.primaryEmail,
    collegeName: item.tenant.name,
    username: item.username,
    firstName: item.firstName,
    lastName: toNonEmptyString(item.lastName),
    fullName: item.fullName,
    course: item.course,
    stream: item.branch,
    branch: item.branch,
    year: item.batchYear,
    section: item.section,
    isHosteller: Boolean(toNonEmptyString(item.hostel)),
    hostelName: toNonEmptyString(item.hostel),
    phoneNumber: toNonEmptyString(item.phoneNumber),
    profileCompleted: true,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

async function queryMembershipProfile(query, variables, operationName) {
  const response = await getCampusDc().executeGraphqlRead(query, {
    operationName,
    variables
  });

  return response.data.tenantMemberships?.[0] ?? null;
}

async function getRawProfileByUserAndTenant({ tenantId, userId }) {
  if (!tenantId || !userId) {
    return null;
  }

  return queryMembershipProfile(
    GET_PROFILE_BY_USER_AND_TENANT_QUERY,
    {
      tenantId,
      userId
    },
    "GetTenantMembershipProfileByUserAndTenant"
  );
}

async function getRawProfileByUsername({ tenantId, username }) {
  const normalizedUsername = sanitizeUsername(username);
  if (!tenantId || !normalizedUsername) {
    return null;
  }

  return queryMembershipProfile(
    GET_PROFILE_BY_USERNAME_QUERY,
    {
      tenantId,
      usernameKey: buildUsernameKey(tenantId, normalizedUsername)
    },
    "GetTenantMembershipProfileByUsername"
  );
}

export function normalizeUsername(value) {
  return sanitizeUsername(value);
}

export async function getProfileByUserId({ tenantId, userId }) {
  return mapMembershipProfile(
    await getRawProfileByUserAndTenant({
      tenantId,
      userId
    })
  );
}

export async function getProfileByUsername({ tenantId, username }) {
  return mapMembershipProfile(
    await getRawProfileByUsername({
      tenantId,
      username
    })
  );
}

export async function listProfilesByTenant(tenantId) {
  const response = await getCampusDc().executeGraphqlRead(LIST_PROFILES_BY_TENANT_QUERY, {
    operationName: "ListTenantMembershipProfilesByTenant",
    variables: {
      tenantId,
      limit: TENANT_PROFILE_LIMIT
    }
  });

  return (Array.isArray(response.data.tenantMemberships) ? response.data.tenantMemberships : [])
    .map((item) => mapMembershipProfile(item))
    .filter(Boolean)
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export async function searchProfiles({ tenantId, query, limit = 12, excludedUserId = null }) {
  const profiles = await listProfilesByTenant(tenantId);
  return profiles
    .filter((profile) => profile.userId !== excludedUserId)
    .filter((profile) => matchQuery(profile, query.trim()))
    .slice(0, limit);
}

export async function updateUsername({ tenantId, userId, username }) {
  const existing = await getRawProfileByUserAndTenant({ tenantId, userId });
  const currentProfile = mapMembershipProfile(existing);
  if (!existing || !currentProfile) {
    return null;
  }

  const normalizedUsername = sanitizeUsername(username);
  if (!normalizedUsername) {
    const error = new Error("Invalid username.");
    error.code = "INVALID_USERNAME";
    throw error;
  }

  const takenBy = await getRawProfileByUsername({
    tenantId,
    username: normalizedUsername
  });
  if (takenBy && takenBy.userId !== userId) {
    const error = new Error("That user ID is already taken.");
    error.code = "USERNAME_TAKEN";
    throw error;
  }

  await getCampusDc().executeGraphql(UPDATE_USERNAME_MUTATION, {
    operationName: "UpdateTenantMembershipUsername",
    variables: {
      id: existing.id,
      username: normalizedUsername,
      usernameKey: buildUsernameKey(tenantId, normalizedUsername)
    }
  });

  return getProfileByUserId({ tenantId, userId });
}

export async function upsertProfile(input) {
  const existing = await getRawProfileByUserAndTenant({
    tenantId: input.tenantId,
    userId: input.userId
  });
  if (!existing) {
    throw new Error("Membership profile could not be resolved.");
  }

  const normalizedUsername = sanitizeUsername(input.username);
  if (!normalizedUsername) {
    const error = new Error("User ID format is invalid.");
    error.code = "INVALID_USERNAME";
    throw error;
  }

  const takenBy = await getRawProfileByUsername({
    tenantId: input.tenantId,
    username: normalizedUsername
  });
  if (takenBy && takenBy.userId !== input.userId) {
    const error = new Error("That user ID is already taken.");
    error.code = "USERNAME_TAKEN";
    throw error;
  }

  await getCampusDc().executeGraphql(UPDATE_PROFILE_MUTATION, {
    operationName: "UpdateTenantMembershipProfile",
    variables: {
      id: existing.id,
      username: normalizedUsername,
      usernameKey: buildUsernameKey(input.tenantId, normalizedUsername),
      firstName: input.firstName,
      lastName: toNonEmptyString(input.lastName),
      fullName: input.fullName,
      course: input.course,
      branch: input.stream,
      batchYear: input.year,
      hostel: input.isHosteller ? toNonEmptyString(input.hostelName) : null,
      section: input.section,
      phoneNumber: toNonEmptyString(input.phoneNumber)
    }
  });

  return getProfileByUserId({
    tenantId: input.tenantId,
    userId: input.userId
  });
}
