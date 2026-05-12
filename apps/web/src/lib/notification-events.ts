import "server-only";

import type {
  CampusEvent,
  CampusEventRegistrationStatus,
  ChatConversationPreview,
  ChatMessageRecord,
  MarketListing,
  MarketRequest
} from "@vyb/contracts";
import type { DevSession } from "./dev-session";
import {
  buildViewerNotificationActor,
  cancelScheduledNotifications,
  emitNotification,
  scheduleNotification,
  uniqueNotificationRecipients
} from "./notifications";

type MarketTarget = MarketListing | MarketRequest;

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
