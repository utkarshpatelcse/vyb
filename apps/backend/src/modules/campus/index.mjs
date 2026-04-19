import { sendError, sendJson } from "../../lib/http.mjs";
import { resolveLiveContext } from "../shared/viewer-context.mjs";

const fallbackCommunities = [
  { id: "community-general", name: "Campus Square", type: "general", memberCount: 1480 },
  { id: "community-batch", name: "CS Batch 2028", type: "batch", memberCount: 184 },
  { id: "community-hostel", name: "Boys Hostel A", type: "hostel", memberCount: 96 }
];

export function getCampusModuleHealth() {
  return {
    module: "campus",
    status: "ok"
  };
}

export async function handleCampusRoute({ request, response, url, context }) {
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
        communities: resolved.live.communities.map((item) => ({
          id: item.community.id,
          name: item.community.name,
          type: item.community.type,
          memberCount: 1
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

  return false;
}
