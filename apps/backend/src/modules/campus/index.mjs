import { getFirebaseDataConnect } from "../../../../../packages/config/src/index.mjs";
import {
  connectorConfig as campusConnectorConfig,
  getCommunityBySlug,
  listCommunityMembersAfterJoinedAt,
  listCommunityMembers as listCommunityMembersQuery
} from "../../../../../packages/dataconnect/campus-admin-sdk/esm/index.esm.js";
import { sendError, sendJson } from "../../lib/http.mjs";
import { resolveLiveContext } from "../shared/viewer-context.mjs";

const fallbackCommunities = [
  {
    id: "community-general",
    name: "Campus Square",
    slug: "campus-square",
    type: "general",
    visibility: "tenant",
    memberCount: 1480,
    membershipRole: "member",
    isOfficial: true,
    isMember: true,
    latestActivityAt: null
  },
  {
    id: "community-batch",
    name: "CS Batch 2028",
    slug: "cs-batch-2028",
    type: "batch",
    visibility: "tenant",
    memberCount: 184,
    membershipRole: "member",
    isOfficial: true,
    isMember: true,
    latestActivityAt: null
  },
  {
    id: "community-hostel",
    name: "Boys Hostel A",
    slug: "boys-hostel-a",
    type: "hostel",
    visibility: "tenant",
    memberCount: 96,
    membershipRole: "member",
    isOfficial: true,
    isMember: true,
    latestActivityAt: null
  }
];

const officialCommunityTypes = new Set(["general", "batch", "branch", "section", "hostel"]);
const communitySlugPattern = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
const memberOnlyVisibility = new Set(["member", "members", "private"]);

function normalizeCommunitySlug(value) {
  try {
    const normalized = decodeURIComponent(value ?? "").trim().toLowerCase();
    return communitySlugPattern.test(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

function parseLimit(value) {
  const parsed = Number(value ?? "24");
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    return null;
  }
  return parsed;
}

function encodeMemberCursor(member) {
  if (!member?.joinedAt) {
    return null;
  }

  return Buffer.from(
    JSON.stringify({
      joinedAt: member.joinedAt,
      membershipId: member.membershipId
    }),
    "utf8"
  ).toString("base64url");
}

function parseMemberCursor(value) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!parsed || typeof parsed.joinedAt !== "string" || !Number.isFinite(new Date(parsed.joinedAt).getTime())) {
      return false;
    }

    return {
      joinedAt: parsed.joinedAt,
      membershipId: typeof parsed.membershipId === "string" ? parsed.membershipId : null
    };
  } catch {
    return false;
  }
}

function getCampusDataConnect() {
  return getFirebaseDataConnect(campusConnectorConfig);
}

function findLiveCommunityMembership(live, communityId) {
  return live?.communities?.find((item) => item.community?.id === communityId) ?? null;
}

function canReadCommunity(live, community, membershipRow) {
  if (!live?.tenant || community.tenantId !== live.tenant.id) {
    return false;
  }

  if (memberOnlyVisibility.has(String(community.visibility ?? "").toLowerCase())) {
    return Boolean(membershipRow);
  }

  return true;
}

function toCommunitySummary(community, membershipRow = null, memberCount = 1) {
  return {
    id: community.id,
    name: community.name,
    slug: community.slug,
    type: community.type,
    visibility: community.visibility,
    memberCount,
    membershipRole: membershipRow?.role ?? undefined,
    joinedAt: membershipRow?.joinedAt ?? undefined,
    isOfficial: officialCommunityTypes.has(community.type),
    isMember: Boolean(membershipRow),
    latestActivityAt: null
  };
}

function buildCommunityDetailResponse({ tenant, community, membershipRow = null, memberCount = 1 }) {
  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug
    },
    community: toCommunitySummary(community, membershipRow, memberCount),
    viewer: {
      isMember: Boolean(membershipRow),
      role: membershipRow?.role ?? null
    },
    summary: {
      postCount: null,
      resourceCount: null,
      eventCount: null,
      health: "normal"
    }
  };
}

function toDisplayName(membership) {
  return (
    membership?.fullName?.trim() ||
    [membership?.firstName, membership?.lastName].filter(Boolean).join(" ").trim() ||
    membership?.user?.displayName?.trim() ||
    membership?.username?.trim() ||
    "Campus member"
  );
}

function mapCommunityMember(row) {
  const membership = row.membership ?? {};
  return {
    membershipId: membership.id ?? row.membershipId,
    userId: membership.userId ?? membership.user?.id ?? "",
    username: membership.username ?? null,
    displayName: toDisplayName(membership),
    avatarUrl: membership.user?.avatarUrl ?? null,
    role: row.role ?? "member",
    tenantRole: membership.role ?? null,
    verificationStatus: membership.verificationStatus ?? null,
    course: membership.course ?? null,
    branch: membership.branch ?? null,
    batchYear: typeof membership.batchYear === "number" ? membership.batchYear : null,
    section: membership.section ?? null,
    hostel: membership.hostel ?? null,
    joinedAt: row.joinedAt
  };
}

function buildFallbackMember(actor) {
  return {
    membershipId: actor.id,
    userId: actor.id,
    username: actor.email.split("@")[0] ?? null,
    displayName: actor.displayName ?? actor.email.split("@")[0] ?? "Campus member",
    avatarUrl: null,
    role: "member",
    tenantRole: "student",
    verificationStatus: "verified",
    course: null,
    branch: null,
    batchYear: null,
    section: null,
    hostel: null,
    joinedAt: new Date().toISOString()
  };
}

function buildViewerCommunityMember(actor, live, membershipRow) {
  const membership = live?.membership ?? {};
  return {
    membershipId: membership.id ?? actor.id,
    userId: membership.userId ?? membership.user?.id ?? actor.id,
    username: membership.username ?? actor.email.split("@")[0] ?? null,
    displayName: toDisplayName({
      ...membership,
      user: {
        ...(membership.user ?? {}),
        displayName: membership.user?.displayName ?? actor.displayName
      }
    }),
    avatarUrl: membership.user?.avatarUrl ?? null,
    role: membershipRow?.role ?? "member",
    tenantRole: membership.role ?? "student",
    verificationStatus: membership.verificationStatus ?? "verified",
    course: membership.course ?? null,
    branch: membership.branch ?? null,
    batchYear: typeof membership.batchYear === "number" ? membership.batchYear : null,
    section: membership.section ?? null,
    hostel: membership.hostel ?? null,
    joinedAt: membershipRow?.joinedAt ?? membership.joinedAt ?? new Date().toISOString()
  };
}

export function getCampusModuleHealth() {
  return {
    module: "campus",
    status: "ok"
  };
}

export async function handleCampusRoute({ request, response, url, context }) {
  const communityMembersMatch =
    request.method === "GET" ? url.pathname.match(/^\/v1\/communities\/([^/]+)\/members$/) : null;
  const communityDetailMatch =
    request.method === "GET" ? url.pathname.match(/^\/v1\/communities\/([^/]+)$/) : null;

  if (request.method === "GET" && url.pathname === "/v1/communities/my") {
    if (!context.actor) {
      sendError(response, 401, "UNAUTHENTICATED", "Viewer context is required.");
      return true;
    }

    const resolved = await resolveLiveContext(context.actor);
    if (resolved?.live?.tenant && resolved.live.membership) {
      sendJson(response, 200, {
        tenant: {
          id: resolved.live.tenant.id,
          name: resolved.live.tenant.name,
          slug: resolved.live.tenant.slug
        },
        viewer: {
          membershipId: resolved.live.membership.id,
          role: resolved.live.membership.role,
          verificationStatus: resolved.live.membership.verificationStatus
        },
        communities: resolved.live.communities.map((item) => ({
          id: item.community.id,
          name: item.community.name,
          slug: item.community.slug,
          type: item.community.type,
          visibility: item.community.visibility,
          memberCount: 1,
          membershipRole: item.role,
          joinedAt: item.joinedAt,
          isOfficial: officialCommunityTypes.has(item.community.type),
          isMember: true,
          latestActivityAt: null
        }))
      });
      return true;
    }

    sendJson(response, 200, {
      tenant: {
        id: "tenant-demo",
        name: "Vyb Demo Institute",
        slug: "vyb-demo"
      },
      communities: fallbackCommunities
    });
    return true;
  }

  if (communityDetailMatch || communityMembersMatch) {
    if (!context.actor) {
      sendError(response, 401, "UNAUTHENTICATED", "Viewer context is required.");
      return true;
    }

    const slug = normalizeCommunitySlug((communityDetailMatch ?? communityMembersMatch)[1]);
    if (!slug) {
      sendError(response, 400, "INVALID_COMMUNITY_SLUG", "Community slug is invalid.");
      return true;
    }

    const resolved = await resolveLiveContext(context.actor);
    if (!resolved?.live?.tenant || !resolved.live.membership) {
      const community = fallbackCommunities.find((item) => item.slug === slug);
      if (!community) {
        sendError(response, 404, "COMMUNITY_NOT_FOUND", "Community not found.");
        return true;
      }

      if (communityMembersMatch) {
        sendJson(response, 200, {
          community: {
            id: community.id,
            name: community.name,
            slug: community.slug
          },
          items: [buildFallbackMember(context.actor)],
          nextCursor: null
        });
        return true;
      }

      sendJson(
        response,
        200,
        buildCommunityDetailResponse({
          tenant: {
            id: "tenant-demo",
            name: "Vyb Demo Institute",
            slug: "vyb-demo"
          },
          community,
          membershipRow: {
            role: community.membershipRole,
            joinedAt: community.joinedAt
          },
          memberCount: community.memberCount
        })
      );
      return true;
    }

    let community;
    try {
      const data = await getCommunityBySlug(getCampusDataConnect(), {
        tenantId: resolved.live.tenant.id,
        slug
      });
      community = data.data.communities[0] ?? null;
    } catch (error) {
      console.error("[campus] community-detail-failed", {
        slug,
        tenantId: resolved.live.tenant.id,
        message: error instanceof Error ? error.message : "unknown"
      });
      sendError(response, 502, "COMMUNITY_UNAVAILABLE", "Community details are unavailable right now.");
      return true;
    }

    if (!community) {
      sendError(response, 404, "COMMUNITY_NOT_FOUND", "Community not found.");
      return true;
    }

    const membershipRow = findLiveCommunityMembership(resolved.live, community.id);
    if (!canReadCommunity(resolved.live, community, membershipRow)) {
      sendError(response, 403, "FORBIDDEN_COMMUNITY", "You do not have access to this community.");
      return true;
    }

    if (communityMembersMatch) {
      const limit = parseLimit(url.searchParams.get("limit"));
      const cursor = parseMemberCursor(url.searchParams.get("cursor"));
      if (limit === null) {
        sendError(response, 400, "INVALID_LIMIT", "limit must be an integer between 1 and 50.");
        return true;
      }

      if (cursor === false) {
        sendError(response, 400, "INVALID_CURSOR", "Member pagination cursor is invalid.");
        return true;
      }

      try {
        const queryLimit = limit + 1;
        const data = cursor
          ? await listCommunityMembersAfterJoinedAt(getCampusDataConnect(), {
              communityId: community.id,
              joinedAfter: cursor.joinedAt,
              limit: queryLimit
            })
          : await listCommunityMembersQuery(getCampusDataConnect(), {
              communityId: community.id,
              limit: queryLimit
            });
        const mappedItems = data.data.communityMemberships
          .map(mapCommunityMember)
          .filter((item) => item.userId && item.membershipId);
        const items = mappedItems.slice(0, limit);
        const hasMore = mappedItems.length > limit;

        sendJson(response, 200, {
          community: {
            id: community.id,
            name: community.name,
            slug: community.slug
          },
          items,
          nextCursor: hasMore ? encodeMemberCursor(items[items.length - 1]) : null
        });
        return true;
      } catch (error) {
        if (cursor) {
          console.warn("[campus] community-members-page-fallback", {
            slug,
            communityId: community.id,
            message: error instanceof Error ? error.message : "unknown"
          });

          sendJson(response, 200, {
            community: {
              id: community.id,
              name: community.name,
              slug: community.slug
            },
            items: [],
            nextCursor: null
          });
          return true;
        }

        console.error("[campus] community-members-failed", {
          slug,
          communityId: community.id,
          message: error instanceof Error ? error.message : "unknown"
        });

        if (membershipRow) {
          sendJson(response, 200, {
            community: {
              id: community.id,
              name: community.name,
              slug: community.slug
            },
            items: [buildViewerCommunityMember(context.actor, resolved.live, membershipRow)],
            nextCursor: null
          });
          return true;
        }

        sendError(response, 502, "COMMUNITY_MEMBERS_UNAVAILABLE", "Community members are unavailable right now.");
        return true;
      }
    }

    sendJson(
      response,
      200,
      buildCommunityDetailResponse({
        tenant: resolved.live.tenant,
        community,
        membershipRow,
        memberCount: membershipRow ? 1 : 0
      })
    );
    return true;
  }

  return false;
}
