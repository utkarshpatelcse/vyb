import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ScribbleMultiplayerGame } from "../../../../src/components/scribble-multiplayer-game";
import {
  getChatInbox,
  getMyCampusCommunities,
  getSuggestedCampusUsers,
  getViewerProfile
} from "../../../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../../../src/lib/dev-session";

type ScribbleGamePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ScribbleGamePage({ searchParams }: ScribbleGamePageProps) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const initialRoomCode = getSearchParamValue(resolvedSearchParams.code)
    ?.trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/gu, "");

  const [profile, inbox, suggestedUsers, communities] = await Promise.all([
    getViewerProfile(viewer).catch(() => null),
    getChatInbox(viewer).catch(() => ({ viewer: { userId: viewer.userId, membershipId: viewer.membershipId, activeIdentity: null }, items: [] })),
    getSuggestedCampusUsers(viewer, 8).catch(() => ({ query: "", items: [] })),
    getMyCampusCommunities(viewer).catch(() => ({ tenant: { id: viewer.tenantId, name: "", slug: "" }, communities: [] }))
  ]);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  const inviteTargets = [
    ...inbox.items.map((item) => ({
      userId: item.peer.userId,
      username: item.peer.username,
      displayName: item.peer.displayName,
      avatarUrl: item.peer.avatarUrl ?? null,
      conversationId: item.id,
      peerIdentity: item.peer.publicKey ?? null,
      source: "recent" as const
    })),
    ...suggestedUsers.items.map((item) => ({
      userId: item.userId,
      username: item.username,
      displayName: item.displayName,
      avatarUrl: item.avatarUrl ?? null,
      conversationId: null,
      peerIdentity: null,
      source: "suggested" as const
    }))
  ];

  return (
    <ScribbleMultiplayerGame
      initialRoomCode={initialRoomCode || null}
      backHref="/hub/gameshub"
      initialViewerIdentity={inbox.viewer.activeIdentity ?? null}
      inviteTargets={inviteTargets}
      communityTargets={communities.communities.map((community) => ({
        id: community.id,
        name: community.name,
        type: community.type,
        memberCount: community.memberCount
      }))}
    />
  );
}
