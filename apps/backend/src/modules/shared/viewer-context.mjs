import { ensureMembershipContext, loadRootEnv } from "../../../../../packages/config/src/index.mjs";

loadRootEnv();

export function buildFallbackDisplayName(email) {
  return email.split("@")[0]?.replace(/[-._]+/g, " ") || "Vyb Explorer";
}

export function buildViewerFromActor(actor) {
  if (!actor) {
    return null;
  }

  return {
    id: actor.id,
    primaryEmail: actor.email,
    displayName: actor.displayName ?? buildFallbackDisplayName(actor.email),
    status: "active"
  };
}

export async function resolveLiveContext(actor) {
  const viewer = buildViewerFromActor(actor);
  if (!viewer) {
    return null;
  }

  try {
    const live = await ensureMembershipContext({
      firebaseUid: viewer.id,
      primaryEmail: viewer.primaryEmail,
      displayName: viewer.displayName
    });

    return {
      viewer,
      live
    };
  } catch {
    return {
      viewer,
      live: null
    };
  }
}
