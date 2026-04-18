import "server-only";
import {
  featuredCommunities,
  featuredFeed,
  featuredResources
} from "@vyb/app-core";
import type {
  CommunitiesMyResponse,
  FeedListResponse,
  ListResourcesResponse,
  MeResponse
} from "@vyb/contracts";
import type { DevSession } from "./dev-session";

const API_BASE_URL =
  process.env.VYB_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function buildGatewayHeaders(viewer?: DevSession): HeadersInit {
  if (!viewer) {
    return {
      "content-type": "application/json"
    };
  }

  return {
    "content-type": "application/json",
    "x-demo-user-id": viewer.userId,
    "x-demo-email": viewer.email,
    "x-demo-display-name": viewer.displayName
  };
}

async function readJson<T>(path: string, viewer?: DevSession): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: buildGatewayHeaders(viewer),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Gateway request failed for ${path} with ${response.status}`);
  }

  return (await response.json()) as T;
}

function buildFallbackData() {
  const communities: CommunitiesMyResponse = {
    tenant: {
      id: "tenant-demo",
      name: "Vyb Demo Institute",
      slug: "vyb-demo"
    },
    communities: featuredCommunities
  };

  const feed: FeedListResponse = {
    tenantId: "tenant-demo",
    communityId: null,
    items: featuredFeed.map((post, index) => ({
      id: post.id,
      tenantId: "tenant-demo",
      communityId: index === 0 ? "community-general" : "community-batch",
      membershipId: "membership-demo-1",
      kind: "text",
      title: post.title,
      body: post.body,
      status: "published",
      reactions: post.reactions,
      comments: post.comments,
      createdAt: new Date(Date.now() - index * 1000 * 60 * 45).toISOString()
    })),
    nextCursor: null
  };

  const resources: ListResourcesResponse = {
    tenantId: "tenant-demo",
    courseId: null,
    items: featuredResources.map((resource, index) => ({
      id: resource.id,
      tenantId: "tenant-demo",
      membershipId: `membership-demo-${index + 1}`,
      courseId: index === 0 ? "course-dbms" : index === 1 ? "course-os" : null,
      title: resource.title,
      description: `${resource.title} starter fallback preview.`,
      type: resource.type,
      downloads: resource.downloads,
      status: "published",
      createdAt: new Date(Date.now() - index * 1000 * 60 * 60 * 6).toISOString()
    })),
    nextCursor: null
  };

  const me: MeResponse = {
    user: {
      id: "demo-user-1",
      primaryEmail: "student@vyb.local",
      displayName: "Vyb Explorer",
      status: "active"
    },
    membershipSummary: {
      id: "membership-demo-1",
      tenantId: "tenant-demo",
      role: "student",
      verificationStatus: "verified"
    }
  };

  return { communities, feed, resources, me };
}

export async function proxyGatewayMutation(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  payload: unknown,
  viewer: DevSession
) {
  const upstream = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildGatewayHeaders(viewer),
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  const responseText = await upstream.text();

  return new Response(responseText, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8"
    }
  });
}

export async function getHomePageData(viewer?: DevSession) {
  try {
    const [communities, feed, resources, me] = await Promise.all([
      readJson<CommunitiesMyResponse>("/v1/communities/my", viewer),
      readJson<FeedListResponse>(`/v1/feed?tenantId=${viewer?.tenantId ?? "tenant-demo"}&limit=3`, viewer),
      readJson<ListResourcesResponse>(`/v1/resources?tenantId=${viewer?.tenantId ?? "tenant-demo"}&limit=3`, viewer),
      readJson<MeResponse>("/v1/me", viewer)
    ]);

    return {
      mode: "live" as const,
      communities,
      feed,
      resources,
      me
    };
  } catch {
    const fallback = buildFallbackData();

    if (viewer) {
      fallback.me = {
        user: {
          id: viewer.userId,
          primaryEmail: viewer.email,
          displayName: viewer.displayName,
          status: "active"
        },
        membershipSummary: {
          id: viewer.membershipId,
          tenantId: viewer.tenantId,
          role: viewer.role,
          verificationStatus: "verified"
        }
      };
    }

    return {
      mode: "fallback" as const,
      ...fallback
    };
  }
}
