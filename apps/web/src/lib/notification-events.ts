import "server-only";

import type {
  CampusEvent,
  CampusEventRegistrationStatus,
  ChatConversationPreview,
  ChatMessageRecord,
  CommentItem,
  CommentReactionResponse,
  FeedCard,
  MarketListing,
  MarketRequest,
  ReactionResponse,
  ResourceItem
} from "@vyb/contracts";
import { getCommunityMembers, getMyCampusCommunities } from "./backend";
import type { DevSession } from "./dev-session";
import {
  buildViewerNotificationActor,
  cancelScheduledNotifications,
  emitNotification,
  scheduleNotification,
  uniqueNotificationRecipients
} from "./notifications";

type MarketTarget = MarketListing | MarketRequest;
export type SocialPostNotificationContext = {
  postId: string;
  postTitle: string;
  communityId: string | null;
  postAuthorUserId: string | null;
  parentCommentAuthorUserId?: string | null;
};
export type SocialCommentNotificationContext = SocialPostNotificationContext & {
  commentId: string;
  commentAuthorUserId: string | null;
};

type CommunityNotificationContext = {
  id: string;
  name: string;
  slug: string;
  memberUserIds: string[];
};

function actor(viewer: DevSession) {
  return buildViewerNotificationActor(viewer);
}

function shouldScheduleFuture(dateValue: string) {
  return Number.isFinite(new Date(dateValue).getTime()) && new Date(dateValue).getTime() > Date.now();
}

function eventHref(eventId: string) {
  return `/hub?tab=events&eventId=${encodeURIComponent(eventId)}`;
}

function scribbleRoomHref(roomId: string) {
  return `/join/scribble?code=${encodeURIComponent(roomId)}`;
}

function communityHref(slug: string, params?: Record<string, string | null | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return `/messages/community/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`;
}

function fallbackSocialHref(context: SocialPostNotificationContext | null | undefined) {
  return context?.postId ? `/home?postId=${encodeURIComponent(context.postId)}` : "/home";
}

async function resolveCommunityNotificationContext(
  viewer: DevSession,
  communityId: string | null | undefined
): Promise<CommunityNotificationContext | null> {
  const normalizedCommunityId = communityId?.trim();
  if (!normalizedCommunityId) {
    return null;
  }

  const communities = await getMyCampusCommunities(viewer);
  const community = communities.communities.find((item) => item.id === normalizedCommunityId) ?? null;
  if (!community?.slug) {
    return null;
  }

  const members = await getCommunityMembers(viewer, community.slug, 50).catch(() => null);

  return {
    id: community.id,
    name: community.name,
    slug: community.slug,
    memberUserIds: uniqueNotificationRecipients(members?.items.map((member) => member.userId) ?? [viewer.userId])
  };
}

async function resolveSocialHref(viewer: DevSession, context: SocialPostNotificationContext | null | undefined) {
  const community = await resolveCommunityNotificationContext(viewer, context?.communityId ?? null).catch(() => null);
  if (!community) {
    return {
      href: fallbackSocialHref(context),
      community
    };
  }

  return {
    href: communityHref(community.slug, {
      postId: context?.postId
    }),
    community
  };
}

function shortenTitle(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim() || fallback;
  return trimmed.length > 72 ? `${trimmed.slice(0, 69)}...` : trimmed;
}

export async function notifyChatMessageCreated(
  viewer: DevSession,
  conversationId: string,
  result: {
    item: ChatMessageRecord;
    conversationPreview: ChatConversationPreview;
  }
) {
  const recipientUserId = result.conversationPreview.peer.userId;

  await emitNotification({
    eventKey: "chat.message.created",
    tenantId: viewer.tenantId,
    recipientScope: "conversation",
    recipientUserIds: uniqueNotificationRecipients([recipientUserId]),
    actor: actor(viewer),
    entity: {
      type: "chat_message",
      id: result.item.id,
      parent_type: "conversation",
      parent_id: conversationId
    },
    priorityScore: 10,
    channels: ["in_app", "push"],
    deliveryPolicy: {
      collapse_key: `conversation:${conversationId}`,
      dedupe_key: `chat.message.created:${result.item.id}:${recipientUserId}`,
      ttl_seconds: 60 * 60 * 24,
      respect_quiet_mode: false
    },
    copy: {
      title: "New message",
      body: "You have a new message on Vyb.",
      cta_label: "Open",
      href: `/messages/${conversationId}`
    },
    privacy: {
      contains_plaintext: false,
      push_body_safe: true
    },
    metadata: {
      message_kind: result.item.messageKind
    }
  });
}

export async function notifyChatSecurityEvent(
  viewer: DevSession,
  input: {
    eventKey: string;
    entityId: string;
    title: string;
    body: string;
    href?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await emitNotification({
    eventKey: input.eventKey,
    tenantId: viewer.tenantId,
    recipientScope: "device_security",
    recipientUserIds: [viewer.userId],
    actor: actor(viewer),
    entity: {
      type: "chat_security",
      id: input.entityId,
      parent_type: "user",
      parent_id: viewer.userId
    },
    priorityScore: 10,
    channels: ["in_app", "push", "email"],
    deliveryPolicy: {
      collapse_key: `device-security:${viewer.userId}`,
      dedupe_key: `${input.eventKey}:${input.entityId}:${viewer.userId}`,
      ttl_seconds: 60 * 60 * 24 * 30,
      respect_quiet_mode: false
    },
    copy: {
      title: input.title,
      body: input.body,
      cta_label: "Review",
      href: input.href ?? "/profile/settings/chat-privacy"
    },
    privacy: {
      contains_plaintext: false,
      push_body_safe: true
    },
    metadata: input.metadata ?? {}
  });
}

export async function notifySuspiciousLoginAttempt(
  viewer: DevSession,
  signals: {
    country: string | null;
    ip: string | null;
    reason: string;
  }
) {
  await emitNotification({
    eventKey: "security.blocklisted_login_attempt",
    tenantId: viewer.tenantId,
    recipientScope: "device_security",
    recipientUserIds: [viewer.userId],
    actor: {
      user_id: null,
      display_name: "Vyb Security",
      avatar_url: null
    },
    entity: {
      type: "login_attempt",
      id: `${viewer.userId}:${Date.now()}`,
      parent_type: "user",
      parent_id: viewer.userId
    },
    priorityScore: 10,
    channels: ["in_app", "push", "email"],
    deliveryPolicy: {
      collapse_key: `security-login:${viewer.userId}`,
      dedupe_key: `security.blocklisted_login_attempt:${viewer.userId}:${signals.ip ?? "unknown"}:${signals.country ?? "unknown"}`,
      ttl_seconds: 60 * 60 * 24 * 30,
      respect_quiet_mode: false
    },
    copy: {
      title: "Suspicious login attempt",
      body: "A login attempt matched Vyb's blocked risk rules.",
      cta_label: "Review",
      href: "/settings/security"
    },
    privacy: {
      contains_plaintext: false,
      push_body_safe: true
    },
    metadata: signals
  });
}

export async function notifySocialPostCreated(viewer: DevSession, post: FeedCard) {
  const community = await resolveCommunityNotificationContext(viewer, post.communityId);
  if (!community) {
    return;
  }

  await emitNotification({
    eventKey: "social.post.created",
    tenantId: viewer.tenantId,
    recipientScope: "content_participants",
    recipientUserIds: community.memberUserIds,
    actor: actor(viewer),
    entity: {
      type: "social_post",
      id: post.id,
      parent_type: "community",
      parent_id: community.id
    },
    priorityScore: 5,
    channels: ["in_app", "push"],
    deliveryPolicy: {
      collapse_key: `community:${community.id}:posts`,
      dedupe_key: `social.post.created:${post.id}`,
      ttl_seconds: 60 * 60 * 24 * 7,
      respect_quiet_mode: true
    },
    copy: {
      title: `New post in ${community.name}`,
      body: `${viewer.displayName} posted ${shortenTitle(post.title, "a campus update")}.`,
      cta_label: "Open",
      href: communityHref(community.slug, { postId: post.id })
    },
    privacy: {
      contains_plaintext: true,
      push_body_safe: true
    },
    metadata: {
      community_id: community.id,
      post_id: post.id
    }
  });
}

export async function notifySocialCommentCreated(
  viewer: DevSession,
  comment: CommentItem,
  context: SocialPostNotificationContext | null | undefined
) {
  const recipientUserIds = uniqueNotificationRecipients([context?.postAuthorUserId, context?.parentCommentAuthorUserId]);
  if (recipientUserIds.length === 0) {
    return;
  }

  const { href, community } = await resolveSocialHref(viewer, context);

  await emitNotification({
    eventKey: "social.comment.created",
    tenantId: viewer.tenantId,
    recipientScope: "content_participants",
    recipientUserIds,
    actor: actor(viewer),
    entity: {
      type: "social_comment",
      id: comment.id,
      parent_type: "social_post",
      parent_id: context?.postId ?? comment.postId
    },
    priorityScore: 7,
    channels: ["in_app", "push"],
    deliveryPolicy: {
      collapse_key: `post:${context?.postId ?? comment.postId}:comments`,
      dedupe_key: `social.comment.created:${comment.id}`,
      ttl_seconds: 60 * 60 * 24 * 7,
      respect_quiet_mode: true
    },
    copy: {
      title: "New comment",
      body: `${viewer.displayName} commented on ${shortenTitle(context?.postTitle, "your post")}.`,
      cta_label: "Open",
      href
    },
    privacy: {
      contains_plaintext: true,
      push_body_safe: true
    },
    metadata: {
      community_id: community?.id ?? context?.communityId ?? null,
      post_id: context?.postId ?? comment.postId,
      comment_id: comment.id
    }
  });
}

export async function notifySocialPostReactionUpdated(
  viewer: DevSession,
  reaction: ReactionResponse,
  context: SocialPostNotificationContext | null | undefined
) {
  if (!reaction.active || !context?.postAuthorUserId) {
    return;
  }

  const { href, community } = await resolveSocialHref(viewer, context);

  await emitNotification({
    eventKey: "social.reaction.post",
    tenantId: viewer.tenantId,
    recipientScope: "content_participants",
    recipientUserIds: uniqueNotificationRecipients([context.postAuthorUserId]),
    actor: actor(viewer),
    entity: {
      type: "social_post_reaction",
      id: `${reaction.postId}:${reaction.membershipId}`,
      parent_type: "social_post",
      parent_id: reaction.postId
    },
    priorityScore: 3,
    channels: ["in_app"],
    deliveryPolicy: {
      collapse_key: `post:${reaction.postId}:reactions`,
      dedupe_key: `social.reaction.post:${reaction.postId}:${reaction.membershipId}:${reaction.reactionType ?? "like"}`,
      ttl_seconds: 60 * 60 * 24 * 3,
      respect_quiet_mode: true
    },
    copy: {
      title: "New reaction",
      body: `${viewer.displayName} reacted to ${shortenTitle(context.postTitle, "your post")}.`,
      cta_label: "Open",
      href
    },
    privacy: {
      contains_plaintext: true,
      push_body_safe: true
    },
    metadata: {
      community_id: community?.id ?? context.communityId,
      post_id: reaction.postId,
      reaction_type: reaction.reactionType
    }
  });
}

export async function notifySocialCommentReactionUpdated(
  viewer: DevSession,
  reaction: CommentReactionResponse,
  context: SocialCommentNotificationContext | null | undefined
) {
  if (!reaction.active || !context?.commentAuthorUserId) {
    return;
  }

  const { href, community } = await resolveSocialHref(viewer, context);

  await emitNotification({
    eventKey: "social.reaction.comment",
    tenantId: viewer.tenantId,
    recipientScope: "content_participants",
    recipientUserIds: uniqueNotificationRecipients([context.commentAuthorUserId]),
    actor: actor(viewer),
    entity: {
      type: "social_comment_reaction",
      id: `${reaction.commentId}:${reaction.membershipId}`,
      parent_type: "social_comment",
      parent_id: reaction.commentId
    },
    priorityScore: 3,
    channels: ["in_app"],
    deliveryPolicy: {
      collapse_key: `comment:${reaction.commentId}:reactions`,
      dedupe_key: `social.reaction.comment:${reaction.commentId}:${reaction.membershipId}`,
      ttl_seconds: 60 * 60 * 24 * 3,
      respect_quiet_mode: true
    },
    copy: {
      title: "New reaction",
      body: `${viewer.displayName} liked your comment on ${shortenTitle(context.postTitle, "a post")}.`,
      cta_label: "Open",
      href
    },
    privacy: {
      contains_plaintext: true,
      push_body_safe: true
    },
    metadata: {
      community_id: community?.id ?? context.communityId,
      post_id: context.postId,
      comment_id: reaction.commentId
    }
  });
}

export async function notifyCommunityResourceCreated(viewer: DevSession, resource: Pick<ResourceItem, "id" | "communityId" | "title">) {
  const community = await resolveCommunityNotificationContext(viewer, resource.communityId);
  if (!community) {
    return;
  }

  await emitNotification({
    eventKey: "resource.created",
    tenantId: viewer.tenantId,
    recipientScope: "content_participants",
    recipientUserIds: community.memberUserIds,
    actor: actor(viewer),
    entity: {
      type: "resource",
      id: resource.id,
      parent_type: "community",
      parent_id: community.id
    },
    priorityScore: 5,
    channels: ["in_app", "push"],
    deliveryPolicy: {
      collapse_key: `community:${community.id}:resources`,
      dedupe_key: `resource.created:${resource.id}`,
      ttl_seconds: 60 * 60 * 24 * 7,
      respect_quiet_mode: true
    },
    copy: {
      title: `New resource in ${community.name}`,
      body: `${viewer.displayName} shared ${shortenTitle(resource.title, "a campus resource")}.`,
      cta_label: "Open",
      href: communityHref(community.slug, {
        tab: "resources",
        resourceId: resource.id
      })
    },
    privacy: {
      contains_plaintext: true,
      push_body_safe: true
    },
    metadata: {
      community_id: community.id,
      resource_id: resource.id
    }
  });
}

export async function scheduleEventLiveNowNotification(viewer: DevSession, event: CampusEvent) {
  if (event.status !== "published" || !shouldScheduleFuture(event.startsAt)) {
    return;
  }

  await scheduleNotification(
    {
      eventKey: "event.live_now",
      tenantId: viewer.tenantId,
      recipientScope: "event_audience",
      recipientUserIds: [viewer.userId],
      actor: {
        user_id: event.host.userId,
        display_name: event.host.displayName,
        avatar_url: null
      },
      entity: {
        type: "campus_event",
        id: event.id,
        parent_type: "tenant",
        parent_id: event.tenantId
      },
      priorityScore: 7,
      channels: ["in_app", "push"],
      deliveryPolicy: {
        collapse_key: `event:${event.id}:live`,
        dedupe_key: `event.live_now:${event.id}:${viewer.userId}`,
        ttl_seconds: 60 * 60 * 6,
        respect_quiet_mode: true
      },
      copy: {
        title: `${event.title} is live now`,
        body: `${event.club} has started at ${event.location}.`,
        cta_label: "Open",
        href: eventHref(event.id)
      },
      privacy: {
        contains_plaintext: false,
        push_body_safe: true
      },
      metadata: {
        starts_at: event.startsAt,
        location: event.location
      }
    },
    event.startsAt,
    `event.live_now:${event.id}:${viewer.userId}`
  );
}

export async function notifyEventRegistrationSubmitted(
  viewer: DevSession,
  event: CampusEvent,
  registrationId: string
) {
  await emitNotification({
    eventKey: "event.registration.submitted",
    tenantId: viewer.tenantId,
    recipientScope: "event_host",
    recipientUserIds: uniqueNotificationRecipients([event.host.userId]),
    actor: actor(viewer),
    entity: {
      type: "campus_event_registration",
      id: registrationId,
      parent_type: "campus_event",
      parent_id: event.id
    },
    priorityScore: 7,
    channels: ["in_app", "push"],
    deliveryPolicy: {
      collapse_key: `event:${event.id}:registrations`,
      dedupe_key: `event.registration.submitted:${registrationId}:${event.host.userId}`,
      ttl_seconds: 60 * 60 * 24 * 14,
      respect_quiet_mode: true
    },
    copy: {
      title: "New event response",
      body: `${viewer.displayName} responded to ${event.title}.`,
      cta_label: "Review",
      href: eventHref(event.id)
    },
    privacy: {
      contains_plaintext: false,
      push_body_safe: true
    }
  });
}

export async function notifyEventRegistrationDecision(
  viewer: DevSession,
  event: CampusEvent,
  registrationId: string,
  attendeeUserId: string,
  status: CampusEventRegistrationStatus
) {
  await emitNotification({
    eventKey: "event.registration.decided",
    tenantId: viewer.tenantId,
    recipientScope: "event_audience",
    recipientUserIds: uniqueNotificationRecipients([attendeeUserId]),
    actor: actor(viewer),
    entity: {
      type: "campus_event_registration",
      id: registrationId,
      parent_type: "campus_event",
      parent_id: event.id
    },
    priorityScore: 7,
    channels: ["in_app", "push"],
    deliveryPolicy: {
      collapse_key: `event:${event.id}:decision:${attendeeUserId}`,
      dedupe_key: `event.registration.decided:${registrationId}:${status}:${attendeeUserId}`,
      ttl_seconds: 60 * 60 * 24 * 14,
      respect_quiet_mode: true
    },
    copy: {
      title: `Your registration was ${status}`,
      body: `${event.title} registration status changed to ${status}.`,
      cta_label: "Open",
      href: eventHref(event.id)
    },
    privacy: {
      contains_plaintext: false,
      push_body_safe: true
    },
    metadata: {
      status
    }
  });
}

export async function notifyEventCancelled(
  viewer: DevSession,
  event: CampusEvent,
  audienceUserIds: string[]
) {
  await cancelScheduledNotifications(`event.live_now:${event.id}:`);
  await emitNotification({
    eventKey: "event.cancelled",
    tenantId: viewer.tenantId,
    recipientScope: "event_audience",
    recipientUserIds: uniqueNotificationRecipients(audienceUserIds),
    actor: actor(viewer),
    entity: {
      type: "campus_event",
      id: event.id,
      parent_type: "tenant",
      parent_id: event.tenantId
    },
    priorityScore: 10,
    channels: ["in_app", "push"],
    deliveryPolicy: {
      collapse_key: `event:${event.id}:cancelled`,
      dedupe_key: `event.cancelled:${event.id}`,
      ttl_seconds: 60 * 60 * 24 * 7,
      respect_quiet_mode: false
    },
    copy: {
      title: `${event.title} was cancelled`,
      body: "Check the event page for any host updates.",
      cta_label: "Open",
      href: eventHref(event.id)
    },
    privacy: {
      contains_plaintext: false,
      push_body_safe: true
    }
  });
}

export async function notifyEventMaterialUpdate(
  viewer: DevSession,
  event: CampusEvent,
  audienceUserIds: string[],
  changedFields: string[]
) {
  await emitNotification({
    eventKey: "event.updated",
    tenantId: viewer.tenantId,
    recipientScope: "event_audience",
    recipientUserIds: uniqueNotificationRecipients(audienceUserIds),
    actor: actor(viewer),
    entity: {
      type: "campus_event",
      id: event.id,
      parent_type: "tenant",
      parent_id: event.tenantId
    },
    priorityScore: 7,
    channels: ["in_app", "push"],
    deliveryPolicy: {
      collapse_key: `event:${event.id}:updated`,
      dedupe_key: `event.updated:${event.id}:${changedFields.sort().join(",")}:${Date.now()}`,
      ttl_seconds: 60 * 60 * 24 * 7,
      respect_quiet_mode: true
    },
    copy: {
      title: `${event.title} was updated`,
      body: `The host changed ${changedFields.join(", ")}.`,
      cta_label: "Open",
      href: eventHref(event.id)
    },
    privacy: {
      contains_plaintext: false,
      push_body_safe: true
    },
    metadata: {
      changed_fields: changedFields
    }
  });
}

export async function notifyMarketContactCreated(viewer: DevSession, target: MarketTarget, targetType: "listing" | "request") {
  const owner = targetType === "listing" ? (target as MarketListing).seller : (target as MarketRequest).requester;
  const targetTitle = targetType === "listing" ? (target as MarketListing).title : (target as MarketRequest).title;
  const recipientUserIds = uniqueNotificationRecipients([owner.userId]);

  await emitNotification({
    eventKey: "market.contact.created",
    tenantId: viewer.tenantId,
    recipientScope: "market_watchers",
    recipientUserIds,
    actor: actor(viewer),
    entity: {
      type: `market_${targetType}`,
      id: target.id,
      parent_type: "market",
      parent_id: viewer.tenantId
    },
    priorityScore: 7,
    channels: ["in_app", "push"],
    deliveryPolicy: {
      collapse_key: `market:${targetType}:${target.id}:contact`,
      dedupe_key: `market.contact.created:${targetType}:${target.id}:${viewer.userId}`,
      ttl_seconds: 60 * 60 * 24 * 7,
      respect_quiet_mode: true
    },
    copy: {
      title: "New market message",
      body: `${viewer.displayName} contacted you about ${targetTitle}.`,
      cta_label: "Open",
      href: "/market"
    },
    privacy: {
      contains_plaintext: true,
      push_body_safe: true
    },
    metadata: {
      requester_user_id: viewer.userId,
      target_type: targetType,
      target_title: targetTitle
    }
  });
}

export async function cancelMarketReplyReminder(input: {
  targetType: "listing" | "request";
  targetId: string;
  requesterUserId: string;
  recipientUserId?: string | null;
}) {
  const prefix = `market.reply_reminder:${input.targetType}:${input.targetId}:${input.requesterUserId}:`;
  return cancelScheduledNotifications(input.recipientUserId ? `${prefix}${input.recipientUserId}` : prefix);
}

export async function notifyGameSquadActive(
  viewer: DevSession,
  input: {
    roomId: string;
    gameSlug: "scribble" | "connect" | "queens" | string;
    recipientUserIds: string[];
    activeCount: number;
  }
) {
  await emitNotification({
    eventKey: "game.squad_active",
    tenantId: viewer.tenantId,
    recipientScope: "tenant_user",
    recipientUserIds: uniqueNotificationRecipients(input.recipientUserIds),
    actor: actor(viewer),
    entity: {
      type: "game_room",
      id: input.roomId,
      parent_type: "game",
      parent_id: input.gameSlug
    },
    priorityScore: 7,
    channels: ["in_app", "push"],
    deliveryPolicy: {
      collapse_key: `game:${input.gameSlug}:${input.roomId}:squad-active`,
      dedupe_key: `game.squad_active:${input.gameSlug}:${input.roomId}`,
      ttl_seconds: 60 * 30,
      respect_quiet_mode: true
    },
    copy: {
      title: "Your squad is playing",
      body: `${input.activeCount}+ people are active in ${input.gameSlug}.`,
      cta_label: "Join",
      href: input.gameSlug === "scribble" ? scribbleRoomHref(input.roomId) : "/hub/gameshub"
    },
    privacy: {
      contains_plaintext: false,
      push_body_safe: true
    },
    metadata: {
      active_count: input.activeCount
    }
  });
}

export async function notifyGameTurnLive(
  viewer: DevSession,
  input: {
    roomId: string;
    gameSlug: "scribble" | string;
    drawerName: string;
    recipientUserIds: string[];
  }
) {
  await emitNotification({
    eventKey: "game.turn_live",
    tenantId: viewer.tenantId,
    recipientScope: "tenant_user",
    recipientUserIds: uniqueNotificationRecipients(input.recipientUserIds),
    actor: actor(viewer),
    entity: {
      type: "game_room",
      id: input.roomId,
      parent_type: "game",
      parent_id: input.gameSlug
    },
    priorityScore: 7,
    channels: ["in_app", "push"],
    deliveryPolicy: {
      collapse_key: `game:${input.gameSlug}:${input.roomId}:turn-live`,
      dedupe_key: `game.turn_live:${input.gameSlug}:${input.roomId}:${Date.now()}`,
      ttl_seconds: 60 * 10,
      respect_quiet_mode: true
    },
    copy: {
      title: "Someone is drawing",
      body: `${input.drawerName} is drawing in ${input.gameSlug}.`,
      cta_label: "Join",
      href: input.gameSlug === "scribble" ? scribbleRoomHref(input.roomId) : "/hub/gameshub"
    },
    privacy: {
      contains_plaintext: false,
      push_body_safe: true
    }
  });
}
