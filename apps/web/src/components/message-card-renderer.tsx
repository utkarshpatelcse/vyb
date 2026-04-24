import type {
  ChatDealCardPayload,
  ChatEventCardPayload,
  ChatProfileCardPayload,
  ChatShareCardKind,
  ChatShareCardPayload,
  ChatVibeCardPayload
} from "@vyb/contracts";
import { CampusAvatarContent } from "./campus-avatar";

export type MessageCardRendererProps = {
  kind: ChatShareCardKind;
  payload: ChatShareCardPayload | null;
  isOwnMessage: boolean;
  isDecrypting: boolean;
  onInterestedDeal?: (payload: ChatDealCardPayload) => void;
  onWatchVibe?: (payload: ChatVibeCardPayload) => void;
  onOpenEvent?: (payload: ChatEventCardPayload) => void;
  onOpenProfile?: (payload: ChatProfileCardPayload) => void;
};

function formatEventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Upcoming event";
  }

  return date.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getProfileInitials(payload: ChatProfileCardPayload) {
  return payload.displayName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function CardSkeleton({ kind }: { kind: ChatShareCardKind }) {
  return (
    <div className={`spm-message-card spm-message-card-${kind} spm-message-card-skeleton`} aria-hidden="true">
      <div className="spm-message-card-skeleton-media" />
      <div className="spm-message-card-skeleton-line spm-message-card-skeleton-line-strong" />
      <div className="spm-message-card-skeleton-line" />
      <div className="spm-message-card-skeleton-actions">
        <span className="spm-message-card-skeleton-pill" />
        <span className="spm-message-card-skeleton-pill" />
      </div>
    </div>
  );
}

export function MessageCardRenderer({
  kind,
  payload,
  isOwnMessage,
  isDecrypting,
  onInterestedDeal,
  onWatchVibe,
  onOpenEvent,
  onOpenProfile
}: MessageCardRendererProps) {
  if (!payload) {
    return isDecrypting ? <CardSkeleton kind={kind} /> : null;
  }

  if (kind === "vibe_card") {
    const vibe = payload as ChatVibeCardPayload;
    return (
      <div className="spm-message-card spm-message-card-vibe_card">
        {vibe.thumbnailUrl || vibe.mediaUrl ? (
          <div className="spm-message-card-media">
            <img src={vibe.thumbnailUrl ?? vibe.mediaUrl ?? ""} alt={vibe.title} loading="lazy" />
            <span className="spm-message-card-badge">Vibe</span>
          </div>
        ) : null}
        <div className="spm-message-card-copy">
          <strong>{vibe.title || "Campus vibe"}</strong>
          <span>@{vibe.authorUsername}</span>
          <p>{vibe.body || "Short video shared from Vyb."}</p>
        </div>
        <div className="spm-message-card-actions">
          <button
            type="button"
            className="spm-message-card-button"
            onClick={() => onWatchVibe?.(vibe)}
            disabled={!vibe.mediaUrl}
          >
            Watch now
          </button>
        </div>
      </div>
    );
  }

  if (kind === "event_card") {
    const event = payload as ChatEventCardPayload;
    return (
      <div className="spm-message-card spm-message-card-event_card">
        {event.imageUrl ? (
          <div className="spm-message-card-media">
            <img src={event.imageUrl} alt={event.title} loading="lazy" />
            <span className="spm-message-card-badge">Event</span>
          </div>
        ) : null}
        <div className="spm-message-card-copy">
          <strong>{event.title}</strong>
          <span>{formatEventDate(event.startsAt)}</span>
          <p>{event.location}</p>
          <small>{event.club} • {event.passLabel}</small>
        </div>
        <div className="spm-message-card-actions">
          <button type="button" className="spm-message-card-button" onClick={() => onOpenEvent?.(event)}>
            {event.responseMode === "interest" ? "Show event" : "Register"}
          </button>
        </div>
      </div>
    );
  }

  if (kind === "deal_card") {
    const deal = payload as ChatDealCardPayload;
    return (
      <div className="spm-message-card spm-message-card-deal_card">
        {deal.imageUrl ? (
          <div className="spm-message-card-media">
            <img src={deal.imageUrl} alt={deal.title} loading="lazy" />
            <span className="spm-message-card-badge">Market</span>
          </div>
        ) : null}
        <div className="spm-message-card-copy">
          <strong>{deal.title}</strong>
          <span>{deal.amountLabel}</span>
          <p>{deal.category}{deal.campusSpot ? ` • ${deal.campusSpot}` : ""}</p>
          <small>{deal.counterpartDisplayName}</small>
        </div>
        <div className="spm-message-card-actions">
          <button
            type="button"
            className="spm-message-card-button"
            onClick={() => onInterestedDeal?.(deal)}
            disabled={isOwnMessage}
          >
            {isOwnMessage ? "Shared by you" : "Interested"}
          </button>
        </div>
      </div>
    );
  }

  const profile = payload as ChatProfileCardPayload;
  return (
    <div className="spm-message-card spm-message-card-profile_card">
      <div className="spm-message-card-profile-head">
        <div className="spm-message-card-profile-avatar" aria-hidden="true">
          <CampusAvatarContent
            userId={profile.userId}
            username={profile.username}
            displayName={profile.displayName}
            avatarUrl={profile.avatarUrl ?? null}
            fallback={getProfileInitials(profile)}
            decorative
          />
        </div>
        <div className="spm-message-card-copy">
          <strong>{profile.displayName}</strong>
          <span>@{profile.username}</span>
          <p>{profile.bio || `${profile.course} • ${profile.stream}`}</p>
        </div>
      </div>
      <div className="spm-message-card-actions">
        <button type="button" className="spm-message-card-button" onClick={() => onOpenProfile?.(profile)}>
          View profile
        </button>
      </div>
    </div>
  );
}
