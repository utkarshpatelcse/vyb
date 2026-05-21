"use client";

import type {
  CampusEvent,
  CommunityDetailResponse,
  CommunityMemberItem,
  CommunityMembersResponse,
  CommunityViewerState,
  FeedCard,
  ResourceItem
} from "@vyb/contracts";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CampusAvatarContent } from "./campus-avatar";
import { buildPrimaryCampusNav, CampusDesktopNavigation, CampusMobileNavigation } from "./campus-navigation";
import { SocialThreadSheet } from "./social-thread-sheet";
import { useSocialPostEngagement } from "./use-social-post-engagement";
import {
  formatBytes,
  prepareSocialUploadFile,
  uploadSocialMediaAsset,
  type UploadedSocialMediaAsset
} from "../lib/social-media-client";

type CommunityDetailTab = "feed" | "members" | "resources" | "events";
type CommunityPanel = "chat" | "members" | "resources" | "events";
type ComposerMediaItem = {
  id: string;
  file: File;
  previewUrl: string;
  mediaType: "image" | "video";
};

type CampusCommunityDetailShellProps = {
  viewerUserId: string;
  viewerName: string;
  viewerUsername: string;
  viewerAvatarUrl?: string | null;
  collegeName: string;
  detail: CommunityDetailResponse;
  members: CommunityMemberItem[];
  membersNextCursor?: string | null;
  memberLoadError?: string | null;
  feedItems: FeedCard[];
  feedLoadError?: string | null;
  resources: ResourceItem[];
  resourcesLoadError?: string | null;
  events: CampusEvent[];
  eventsLoadError?: string | null;
  initialTab?: CommunityDetailTab;
  initialPostId?: string | null;
  inviteRedemptionMessage?: string | null;
};

type CommunityIconName =
  | "attach"
  | "back"
  | "bell"
  | "bell-off"
  | "camera"
  | "calendar"
  | "chat"
  | "close"
  | "folder"
  | "globe"
  | "image"
  | "invite"
  | "leave"
  | "lock"
  | "menu"
  | "members"
  | "mic"
  | "pin"
  | "qr"
  | "request"
  | "search"
  | "send"
  | "shield"
  | "storage"
  | "timer"
  | "voice";

const COMMUNITY_TYPE_LABELS: Record<string, string> = {
  general: "Campus",
  batch: "Batch",
  branch: "Branch",
  section: "Section",
  hostel: "Hostel",
  club: "Club",
  personal: "Personal",
  interest: "Interest"
};

const panelTabs: Array<{ id: CommunityPanel; label: string; icon: CommunityIconName }> = [
  { id: "chat", label: "Chat", icon: "chat" },
  { id: "members", label: "Members", icon: "members" },
  { id: "resources", label: "Files", icon: "folder" },
  { id: "events", label: "Events", icon: "calendar" }
];

const emptyViewerState: CommunityViewerState = {
  muted: false,
  pinned: false,
  membershipStatus: "member",
  requestedAt: null,
  requestId: null,
  leftAt: null,
  updatedAt: new Date(0).toISOString()
};

function CommunityIcon({ name, className }: { name: CommunityIconName; className?: string }) {
  const commonProps = {
    "aria-hidden": true,
    className: className ?? "ccd-icon",
    fill: "none",
    viewBox: "0 0 24 24"
  };

  switch (name) {
    case "attach":
      return (
        <svg {...commonProps}>
          <path d="M7.5 12.5 13.8 6.2a3.2 3.2 0 0 1 4.5 4.5l-7.4 7.4a5 5 0 0 1-7.1-7.1l7.8-7.8" />
        </svg>
      );
    case "back":
      return (
        <svg {...commonProps}>
          <path d="M19 12H5" />
          <path d="m12 5-7 7 7 7" />
        </svg>
      );
    case "bell":
      return (
        <svg {...commonProps}>
          <path d="M18 9.8a6 6 0 1 0-12 0c0 6-2.2 7.2-2.2 7.2h16.4S18 15.8 18 9.8Z" />
          <path d="M9.8 20a2.4 2.4 0 0 0 4.4 0" />
        </svg>
      );
    case "bell-off":
      return (
        <svg {...commonProps}>
          <path d="m3 3 18 18" />
          <path d="M16.4 16.9H3.8S6 15.8 6 9.8c0-1.4.4-2.7 1.2-3.8" />
          <path d="M9.8 20a2.4 2.4 0 0 0 4.4 0" />
          <path d="M9.9 4.2A6 6 0 0 1 18 9.8c0 1.8.2 3.2.6 4.2" />
        </svg>
      );
    case "camera":
      return (
        <svg {...commonProps}>
          <path d="M8.5 6.2 10 4.4h4l1.5 1.8h2.7a2 2 0 0 1 2 2v8.6a2 2 0 0 1-2 2H5.8a2 2 0 0 1-2-2V8.2a2 2 0 0 1 2-2Z" />
          <path d="M15.2 12.5a3.2 3.2 0 1 1-6.4 0 3.2 3.2 0 0 1 6.4 0Z" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...commonProps}>
          <path d="M7 3v3M17 3v3M4.5 8.5h15" />
          <rect x="4.5" y="5" width="15" height="15.5" rx="2.4" />
          <path d="M8 12h2.2M13.8 12H16M8 16h2.2M13.8 16H16" />
        </svg>
      );
    case "chat":
      return (
        <svg {...commonProps}>
          <path d="M5 5.4h14a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2H9.2L5 20v-3.4a2 2 0 0 1-2-2V7.4a2 2 0 0 1 2-2Z" />
          <path d="M8 10h8M8 13h5" />
        </svg>
      );
    case "close":
      return (
        <svg {...commonProps}>
          <path d="m7 7 10 10M17 7 7 17" />
        </svg>
      );
    case "folder":
      return (
        <svg {...commonProps}>
          <path d="M3.8 6.8a2 2 0 0 1 2-2h4.1l2 2h6.3a2 2 0 0 1 2 2v8.6a2 2 0 0 1-2 2H5.8a2 2 0 0 1-2-2Z" />
          <path d="M3.8 10h16.4" />
        </svg>
      );
    case "globe":
      return (
        <svg {...commonProps}>
          <path d="M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" />
          <path d="M3.8 12h16.4" />
          <path d="M12 3.5c2.2 2.3 3.2 5.2 3.2 8.5s-1 6.2-3.2 8.5c-2.2-2.3-3.2-5.2-3.2-8.5S9.8 5.8 12 3.5Z" />
        </svg>
      );
    case "image":
      return (
        <svg {...commonProps}>
          <rect x="4.2" y="5" width="15.6" height="14" rx="2.1" />
          <path d="m5 16 4.2-4.2 3.1 3.1 2-2 4.7 4.7" />
          <path d="M15.4 8.8h.1" />
        </svg>
      );
    case "invite":
      return (
        <svg {...commonProps}>
          <path d="M15.5 7.8a3.3 3.3 0 1 1-6.6 0 3.3 3.3 0 0 1 6.6 0Z" />
          <path d="M4.7 20a7.5 7.5 0 0 1 15 0" />
          <path d="M19 6v5M16.5 8.5h5" />
        </svg>
      );
    case "leave":
      return (
        <svg {...commonProps}>
          <path d="M10 4.5H5.8a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" />
          <path d="M14.5 8.5 18 12l-3.5 3.5M8.5 12H18" />
        </svg>
      );
    case "lock":
      return (
        <svg {...commonProps}>
          <rect x="5.2" y="10.2" width="13.6" height="9.2" rx="2" />
          <path d="M8.5 10.2V7.8a3.5 3.5 0 0 1 7 0v2.4" />
        </svg>
      );
    case "menu":
      return (
        <svg {...commonProps}>
          <path d="M12 6.2h.1M12 12h.1M12 17.8h.1" />
        </svg>
      );
    case "members":
      return (
        <svg {...commonProps}>
          <path d="M9.4 11.2a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z" />
          <path d="M2.8 20a6.6 6.6 0 0 1 13.2 0" />
          <path d="M17.3 11.8a3 3 0 0 0-.6-5.9" />
          <path d="M18 19.6a5.1 5.1 0 0 0-2.2-4.2" />
        </svg>
      );
    case "mic":
      return (
        <svg {...commonProps}>
          <rect x="9" y="3.5" width="6" height="10" rx="3" />
          <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
          <path d="M12 18v2.5M9 20.5h6" />
        </svg>
      );
    case "pin":
      return (
        <svg {...commonProps}>
          <path d="m14.5 3.8 5.7 5.7" />
          <path d="M10.5 9.5 5.2 14.8l4 4 5.3-5.3 4.1-.8-7.3-7.3Z" />
          <path d="m8.8 18.8-4.6 4.6" />
        </svg>
      );
    case "request":
      return (
        <svg {...commonProps}>
          <path d="M12 3.8 20.2 8v5.2c0 4.1-3.4 6.4-8.2 7.8-4.8-1.4-8.2-3.7-8.2-7.8V8Z" />
          <path d="m8.8 12.2 2.2 2.2 4.6-4.8" />
        </svg>
      );
    case "qr":
      return (
        <svg {...commonProps}>
          <path d="M4.5 4.5h5v5h-5ZM14.5 4.5h5v5h-5ZM4.5 14.5h5v5h-5Z" />
          <path d="M14.5 14.5h2.2M19.5 14.5h.1M14.5 17.2h5M17.2 19.5h2.3" />
        </svg>
      );
    case "search":
      return (
        <svg {...commonProps}>
          <path d="M10.8 17.2a6.4 6.4 0 1 0 0-12.8 6.4 6.4 0 0 0 0 12.8Z" />
          <path d="m15.4 15.4 4.2 4.2" />
        </svg>
      );
    case "send":
      return (
        <svg {...commonProps}>
          <path d="M4 5.2 21 12 4 18.8l2.7-6.8Z" />
          <path d="M6.8 12H21" />
        </svg>
      );
    case "shield":
      return (
        <svg {...commonProps}>
          <path d="M12 3.8 19.2 7v5.1c0 3.9-2.8 6.6-7.2 8.1-4.4-1.5-7.2-4.2-7.2-8.1V7Z" />
          <path d="M12 7.8v8.6" />
        </svg>
      );
    case "storage":
      return (
        <svg {...commonProps}>
          <path d="M4.2 6.2h15.6v13H4.2Z" />
          <path d="M7 13.8 9.2 11l2.2 2.2 1.6-1.8 4 5" />
          <path d="M7.2 3.8h9.6" />
        </svg>
      );
    case "timer":
      return (
        <svg {...commonProps}>
          <path d="M12 6.2v5.3l3 2" />
          <path d="M18.5 7.2A8 8 0 1 1 8.2 4.8" />
          <path d="M8.2 2.8v4h-4" />
        </svg>
      );
    case "voice":
      return (
        <svg {...commonProps}>
          <path d="M7.5 16.5a5 5 0 0 1 0-9" />
          <path d="M16.5 7.5a5 5 0 0 1 0 9" />
          <path d="M10.2 13.8V10a1.8 1.8 0 0 1 3.6 0v3.8" />
          <path d="M9 14h6" />
        </svg>
      );
    default:
      return null;
  }
}

function getCommunityTypeLabel(type: string) {
  return COMMUNITY_TYPE_LABELS[type] ?? type;
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "0";
  }

  return value.toLocaleString("en-IN");
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Recent";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Recent";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short"
  }).format(parsed);
}

function formatChatTime(value: string | null | undefined) {
  if (!value) {
    return "now";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "now";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

function formatEventDate(value: string | null | undefined) {
  if (!value) {
    return "Soon";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Soon";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

function formatFileSize(sizeBytes: number | null | undefined) {
  if (!Number.isFinite(sizeBytes) || !sizeBytes || sizeBytes <= 0) {
    return "File";
  }

  return formatBytes(sizeBytes);
}

function buildMemberMeta(member: CommunityMemberItem) {
  return [
    member.course,
    member.branch,
    member.batchYear ? `Batch ${member.batchYear}` : null,
    member.section ? `Sec ${member.section}` : null,
    member.hostel
  ]
    .filter(Boolean)
    .join(" - ");
}

function buildInitialViewerState(detail: CommunityDetailResponse): CommunityViewerState {
  return {
    ...emptyViewerState,
    muted: detail.viewer.muted === true || detail.community.muted === true,
    pinned: detail.viewer.pinned === true || detail.community.pinned === true,
    membershipStatus:
      detail.viewer.membershipStatus ??
      detail.community.membershipStatus ??
      (detail.viewer.isMember ? "member" : "not_member"),
    requestedAt: detail.viewer.requestedAt ?? detail.community.requestedAt ?? null,
    requestId: detail.viewer.requestId ?? null,
    leftAt: detail.viewer.leftAt ?? detail.community.leftAt ?? null,
    updatedAt: new Date().toISOString()
  };
}

function getMessageMedia(item: FeedCard) {
  if (Array.isArray(item.media) && item.media.length > 0) {
    return item.media;
  }

  if (item.mediaUrl) {
    return [
      {
        url: item.mediaUrl,
        kind: item.kind === "video" ? "video" : "image",
        mimeType: undefined,
        sizeBytes: undefined,
        storagePath: undefined,
        variants: undefined,
        processingStatus: "ready" as const
      }
    ];
  }

  return [];
}

function renderMentions(text: string): ReactNode[] {
  return text.split(/(@[a-zA-Z0-9_.-]+)/g).map((part, index) =>
    part.startsWith("@") ? (
      <span key={`${part}-${index}`} className="ccd-message-mention">
        {part}
      </span>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function getMentionQuery(value: string) {
  const match = value.match(/(?:^|\s)@([a-zA-Z0-9_.-]{0,32})$/);
  return match ? match[1].toLowerCase() : null;
}

function CommunityMemberRow({ member, compact = false }: { member: CommunityMemberItem; compact?: boolean }) {
  const meta = buildMemberMeta(member);
  const body = (
    <>
      <span className="ccd-member-avatar">
        <CampusAvatarContent
          userId={member.userId}
          username={member.username}
          avatarUrl={member.avatarUrl}
          displayName={member.displayName}
          decorative
        />
      </span>
      <span className="ccd-member-copy">
        <strong>{member.displayName}</strong>
        <span>{meta || member.role}</span>
      </span>
      {!compact ? <span className="ccd-member-role">{member.role}</span> : null}
    </>
  );

  if (member.username) {
    return (
      <Link href={`/u/${encodeURIComponent(member.username)}`} className="ccd-member-row">
        {body}
      </Link>
    );
  }

  return <div className="ccd-member-row">{body}</div>;
}

function CommunityResourceRow({ resource, communitySlug }: { resource: ResourceItem; communitySlug: string }) {
  const files = resource.files ?? [];
  const primaryFile = files.find((file) => file.url) ?? null;
  const href =
    primaryFile?.url ??
    `/messages/community/${encodeURIComponent(communitySlug)}?tab=resources&resourceId=${encodeURIComponent(resource.id)}`;
  const fileMeta = primaryFile
    ? `${primaryFile.fileName} - ${formatFileSize(primaryFile.sizeBytes)}`
    : resource.status === "pending"
      ? "Submitted for review"
      : `${resource.type} resource`;

  return (
    <a href={href} className="ccd-preview-row" target={primaryFile ? "_blank" : undefined} rel={primaryFile ? "noreferrer" : undefined}>
      <span className="ccd-preview-icon">{resource.type.slice(0, 1).toUpperCase()}</span>
      <span className="ccd-preview-copy">
        <strong>{resource.title}</strong>
        <span>{resource.description || fileMeta}</span>
      </span>
      <span className="ccd-preview-meta">{files.length > 1 ? `${files.length} files` : fileMeta || formatDate(resource.createdAt)}</span>
    </a>
  );
}

function CommunityEventRow({ event }: { event: CampusEvent }) {
  return (
    <Link href={`/hub?tab=events&eventId=${encodeURIComponent(event.id)}`} className="ccd-preview-row">
      <span className="ccd-preview-icon">{event.category.slice(0, 1).toUpperCase()}</span>
      <span className="ccd-preview-copy">
        <strong>{event.title}</strong>
        <span>{event.club} - {event.location}</span>
      </span>
      <span className="ccd-preview-meta">{formatEventDate(event.startsAt)}</span>
    </Link>
  );
}

function CommunityMessage({
  item,
  isOwn,
  canInteract,
  isReacting,
  onReply,
  onReact,
  onOpenThread,
  onShare
}: {
  item: FeedCard;
  isOwn: boolean;
  canInteract: boolean;
  isReacting: boolean;
  onReply: (item: FeedCard) => void;
  onReact: (item: FeedCard) => void;
  onOpenThread: (item: FeedCard) => void;
  onShare: (item: FeedCard) => void;
}) {
  const media = getMessageMedia(item);

  return (
    <article className={`ccd-message${isOwn ? " ccd-message-own" : ""}`}>
      {!isOwn ? (
        <span className="ccd-message-avatar">
          <CampusAvatarContent
            userId={item.author.userId ?? item.id}
            username={item.author.username}
            avatarUrl={item.author.avatarUrl}
            displayName={item.author.displayName}
            decorative
          />
        </span>
      ) : null}

      <div className="ccd-message-stack">
        <div className="ccd-message-meta">
          <strong>{isOwn ? "You" : item.author.displayName}</strong>
          <span>@{item.author.username}</span>
          <time dateTime={item.createdAt}>{formatChatTime(item.createdAt)}</time>
        </div>

        <div className="ccd-message-bubble">
          {item.title && item.title !== item.body ? <span className="ccd-message-title">{item.title}</span> : null}
          {item.body ? <p>{renderMentions(item.body)}</p> : null}
          {media.length > 0 ? (
            <div className={`ccd-message-media-grid${media.length > 1 ? " ccd-message-media-grid-multi" : ""}`}>
              {media.map((asset, index) => (
                <a
                  key={`${asset.url}-${index}`}
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ccd-message-media"
                  aria-label={`Open ${asset.kind} attachment`}
                >
                  {asset.kind === "video" ? (
                    <video src={asset.url} playsInline muted preload="metadata" />
                  ) : (
                    <img src={asset.url} alt="" loading="lazy" />
                  )}
                  <span>{asset.kind === "video" ? "Video" : "Photo"}</span>
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <div className="ccd-message-actions">
          <button type="button" onClick={() => onReact(item)} disabled={!canInteract || isReacting}>
            {item.viewerReactionType ? "Liked" : "Like"} {formatNumber(item.reactions)}
          </button>
          <button type="button" onClick={() => onReply(item)} disabled={!canInteract}>
            Reply
          </button>
          <button type="button" onClick={() => onOpenThread(item)} disabled={!canInteract}>
            Thread {formatNumber(item.comments)}
          </button>
          <button type="button" onClick={() => onShare(item)}>
            Share
          </button>
        </div>
      </div>
    </article>
  );
}

export function CampusCommunityDetailShell({
  viewerUserId,
  viewerName,
  viewerUsername,
  viewerAvatarUrl,
  collegeName,
  detail,
  members,
  membersNextCursor = null,
  memberLoadError,
  feedItems,
  feedLoadError,
  resources,
  resourcesLoadError,
  events,
  eventsLoadError,
  initialTab = "feed",
  initialPostId = null,
  inviteRedemptionMessage = null
}: CampusCommunityDetailShellProps) {
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<CommunityPanel>(initialTab === "feed" ? "chat" : initialTab);
  const [composerText, setComposerText] = useState("");
  const [composerStatus, setComposerStatus] = useState<string | null>(null);
  const [interactionMessage, setInteractionMessage] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<FeedCard | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<ComposerMediaItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [communityState, setCommunityState] = useState<CommunityViewerState>(() => buildInitialViewerState(detail));
  const [communityActionMessage, setCommunityActionMessage] = useState<string | null>(inviteRedemptionMessage);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [memberItems, setMemberItems] = useState(members);
  const [memberCursor, setMemberCursor] = useState<string | null>(membersNextCursor);
  const [memberPageMessage, setMemberPageMessage] = useState<string | null>(null);
  const [memberVisibleCount, setMemberVisibleCount] = useState(14);
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [resourceCourseId, setResourceCourseId] = useState("");
  const [resourceType, setResourceType] = useState<ResourceItem["type"]>("notes");
  const [resourceFiles, setResourceFiles] = useState<File[]>([]);
  const [resourceItems, setResourceItems] = useState(resources);
  const [resourceMessage, setResourceMessage] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const resourceFileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selectedMediaRef = useRef<ComposerMediaItem[]>([]);
  const initialThreadOpenRef = useRef(false);
  const [isPosting, startPosting] = useTransition();
  const [isLoadingMembers, startLoadingMembers] = useTransition();
  const [isSubmittingResource, startSubmittingResource] = useTransition();
  const [isUpdatingCommunity, startUpdatingCommunity] = useTransition();
  const [isInviting, startInviting] = useTransition();
  const navItems = useMemo(() => buildPrimaryCampusNav("messages"), []);
  const community = detail.community;
  const communityInitial = community.name.trim().slice(0, 1).toUpperCase() || getCommunityTypeLabel(community.type).slice(0, 1).toUpperCase();
  const engagement = useSocialPostEngagement(
    feedItems,
    "feed",
    {
      viewerName,
      viewerUsername,
      viewerUserId
    },
    {
      communityId: community.id
    }
  );
  const visibleMembers = memberItems.slice(0, memberVisibleCount);
  const canPost = communityState.membershipStatus === "member";
  const isLocked = !canPost;
  const displayMemberCount = Math.max(community.memberCount, memberItems.length);
  const mentionQuery = getMentionQuery(composerText);
  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) {
      return [];
    }

    return memberItems
      .filter((member) => {
        const username = member.username?.toLowerCase() ?? "";
        const displayName = member.displayName.toLowerCase();
        return username.includes(mentionQuery) || displayName.includes(mentionQuery);
      })
      .slice(0, 5);
  }, [memberItems, mentionQuery]);
  const selectedMediaSummary = selectedMedia.length > 0
    ? `${selectedMedia.length} attachment${selectedMedia.length === 1 ? "" : "s"}`
    : "Attach";
  const panelCounts: Record<CommunityPanel, string> = {
    chat: formatNumber(engagement.posts.length),
    members: formatNumber(displayMemberCount),
    resources: formatNumber(resourceItems.length),
    events: formatNumber(events.length)
  };
  const membershipLabel =
    communityState.membershipStatus === "requested"
      ? "Request pending"
      : communityState.membershipStatus === "left"
        ? "Left"
        : communityState.membershipStatus === "member"
          ? "Member"
          : "Not joined";

  useEffect(() => {
    setResourceItems(resources);
  }, [resources]);

  useEffect(() => {
    setCommunityState(buildInitialViewerState(detail));
  }, [detail]);

  useEffect(() => {
    setCommunityActionMessage(inviteRedemptionMessage);
  }, [inviteRedemptionMessage]);

  useEffect(() => {
    selectedMediaRef.current = selectedMedia;
  }, [selectedMedia]);

  useEffect(() => () => {
    selectedMediaRef.current.forEach((item) => window.URL.revokeObjectURL(item.previewUrl));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [engagement.posts.length]);

  useEffect(() => {
    if (!initialPostId || initialThreadOpenRef.current) {
      return;
    }

    if (!engagement.posts.some((post) => post.id === initialPostId)) {
      return;
    }

    initialThreadOpenRef.current = true;
    setActivePanel("chat");
    void engagement.openThread(initialPostId);
  }, [engagement, initialPostId]);

  function clearSelectedMedia() {
    selectedMedia.forEach((item) => window.URL.revokeObjectURL(item.previewUrl));
    setSelectedMedia([]);
    if (mediaInputRef.current) {
      mediaInputRef.current.value = "";
    }
  }

  function removeSelectedMedia(id: string) {
    setSelectedMedia((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        window.URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  }

  function handleMediaSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const nextItems = files
      .filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
      .slice(0, 6)
      .map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        previewUrl: window.URL.createObjectURL(file),
        mediaType: file.type.startsWith("video/") ? "video" as const : "image" as const
      }));

    if (nextItems.length === 0) {
      setComposerStatus("Only photos and videos can be shared here.");
      return;
    }

    setSelectedMedia((current) => [...current, ...nextItems].slice(0, 6));
    setComposerStatus(null);
  }

  function insertMention(member: CommunityMemberItem) {
    const handle = member.username ?? member.displayName.toLowerCase().replace(/\s+/g, ".");
    setComposerText((current) => current.replace(/(?:^|\s)@[a-zA-Z0-9_.-]{0,32}$/, (prefix) => {
      const leadingSpace = prefix.startsWith(" ") ? " " : "";
      return `${leadingSpace}@${handle} `;
    }));
    composerRef.current?.focus();
  }

  function patchCommunityState(payload: { muted?: boolean; pinned?: boolean; membershipAction?: "leave" | "request_join" | "cancel_request" }, successMessage: string) {
    setCommunityActionMessage(null);
    startUpdatingCommunity(async () => {
      const response = await fetch(`/api/communities/${encodeURIComponent(community.slug)}/me`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = (await response.json().catch(() => null)) as
        | {
            state?: CommunityViewerState;
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !result?.state) {
        setCommunityActionMessage(result?.error?.message ?? "Community action could not be saved.");
        return;
      }

      setCommunityState(result.state);
      setCommunityActionMessage(successMessage);
      router.refresh();
    });
  }

  function handleInviteCopy() {
    setCommunityActionMessage(null);
    startInviting(async () => {
      const response = await fetch(`/api/communities/${encodeURIComponent(community.slug)}/invites`, {
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            invite?: {
              inviteUrl: string;
            };
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !payload?.invite?.inviteUrl) {
        setCommunityActionMessage(payload?.error?.message ?? "Invite could not be created.");
        return;
      }

      setInviteUrl(payload.invite.inviteUrl);
      await navigator.clipboard?.writeText(payload.invite.inviteUrl).catch(() => undefined);
      setCommunityActionMessage("Invite link copied.");
    });
  }

  function handleShareMessage(item: FeedCard) {
    const url = `${window.location.origin}/messages/community/${encodeURIComponent(community.slug)}?postId=${encodeURIComponent(item.id)}`;
    void navigator.clipboard?.writeText(url).catch(() => undefined);
    setInteractionMessage("Message link copied.");
  }

  function handlePostReaction(item: FeedCard) {
    if (!canPost) {
      setInteractionMessage("Join this community before reacting.");
      return;
    }

    setInteractionMessage(null);
    void engagement.react(item.id, "like").then((result) => {
      if (!result) {
        setInteractionMessage("Reaction was not saved.");
      }
    });
  }

  function handleOpenComments(item: FeedCard) {
    if (!canPost) {
      setInteractionMessage("Join this community before opening the thread.");
      return;
    }

    setInteractionMessage(null);
    void engagement.openThread(item.id);
  }

  function handleReplyToPost(item: FeedCard) {
    if (!canPost) {
      setInteractionMessage("Join this community before replying.");
      return;
    }

    setReplyTarget(item);
    setActivePanel("chat");
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  async function submitReply(target: FeedCard, body: string) {
    const response = await fetch(`/api/posts/${encodeURIComponent(target.id)}/comments`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        body,
        parentCommentId: null,
        isAnonymous: false
      })
    });
    const payload = (await response.json().catch(() => null)) as
      | {
          error?: {
            message?: string;
          };
        }
      | null;

    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "Reply was not sent.");
    }

    void engagement.openThread(target.id);
  }

  async function uploadComposerMedia() {
    const uploaded: UploadedSocialMediaAsset[] = [];

    for (const [index, media] of selectedMedia.entries()) {
      setUploadProgress(index / selectedMedia.length);
      const prepared = await prepareSocialUploadFile(media.file, {
        targetVideoBytes: 28 * 1024 * 1024
      });
      if (prepared.optimizationSummary) {
        setComposerStatus(prepared.optimizationSummary);
      }
      const asset = await uploadSocialMediaAsset(prepared.file, "post", {
        debugStage: "CommunityChat",
        onUploadProgress: (progress) => {
          setUploadProgress((index + progress) / selectedMedia.length);
        }
      });
      uploaded.push(asset);
    }

    setUploadProgress(null);
    return uploaded;
  }

  function handleSendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const body = composerText.trim();
    if (isLocked) {
      setComposerStatus("Request access before sending messages here.");
      return;
    }

    if (!body && selectedMedia.length === 0) {
      setComposerStatus("Type a message or attach media.");
      return;
    }

    if (replyTarget && selectedMedia.length > 0) {
      setComposerStatus("Media replies are not supported in threads yet. Send text reply or clear reply.");
      return;
    }

    setComposerStatus(null);
    startPosting(async () => {
      try {
        if (replyTarget) {
          await submitReply(replyTarget, body);
          setComposerText("");
          setReplyTarget(null);
          setComposerStatus("Reply sent.");
          router.refresh();
          return;
        }

        const uploaded = selectedMedia.length > 0 ? await uploadComposerMedia() : [];
        const primaryAsset = uploaded[0] ?? null;
        const response = await fetch("/api/posts", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            title: community.name,
            body,
            communityId: community.id,
            kind: primaryAsset ? primaryAsset.mediaType : "text",
            placement: "feed",
            isAnonymous: false,
            allowAnonymousComments: false,
            mediaUrl: primaryAsset?.url ?? null,
            mediaStoragePath: primaryAsset?.storagePath ?? null,
            mediaMimeType: primaryAsset?.mimeType ?? null,
            mediaSizeBytes: primaryAsset?.sizeBytes ?? null,
            mediaAssets: uploaded.map((asset) => ({
              url: asset.url,
              kind: asset.mediaType,
              mimeType: asset.mimeType,
              sizeBytes: asset.sizeBytes,
              storagePath: asset.storagePath,
              variants: asset.variants,
              processingStatus: asset.processingStatus
            }))
          })
        });

        const payload = (await response.json().catch(() => null)) as
          | {
              item?: FeedCard;
              error?: {
                message?: string;
              };
            }
          | null;

        if (!response.ok || !payload?.item) {
          setComposerStatus(payload?.error?.message ?? "Message was not sent.");
          return;
        }

        engagement.prependPost(payload.item);
        setComposerText("");
        clearSelectedMedia();
        setComposerStatus("Sent.");
        setActivePanel("chat");
        router.refresh();
      } catch (error) {
        setUploadProgress(null);
        setComposerStatus(error instanceof Error ? error.message : "Message was not sent.");
      }
    });
  }

  function handleLoadMoreMembers() {
    if (memberVisibleCount < memberItems.length) {
      setMemberVisibleCount((current) => Math.min(memberItems.length, current + 14));
      return;
    }

    if (!memberCursor || isLoadingMembers) {
      return;
    }

    setMemberPageMessage(null);
    startLoadingMembers(async () => {
      const params = new URLSearchParams({
        limit: "24",
        cursor: memberCursor
      });
      const response = await fetch(`/api/communities/${encodeURIComponent(community.slug)}/members?${params.toString()}`);
      const payload = (await response.json().catch(() => null)) as
        | (CommunityMembersResponse & {
            error?: {
              message?: string;
            };
          })
        | null;

      if (!response.ok || !payload?.items) {
        setMemberPageMessage(payload?.error?.message ?? "We could not load more members.");
        return;
      }

      setMemberItems((current) => {
        const existing = new Set(current.map((member) => member.membershipId));
        const nextItems = payload.items.filter((member) => !existing.has(member.membershipId));
        return [...current, ...nextItems];
      });
      setMemberCursor(payload.nextCursor);
      setMemberVisibleCount((current) => current + 14);
    });
  }

  function handleResourceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = resourceTitle.trim();
    const description = resourceDescription.trim();
    const courseId = resourceCourseId.trim();

    if (!canPost) {
      setResourceMessage("Join this community before uploading files.");
      return;
    }

    if (title.length < 4) {
      setResourceMessage("Resource title must be at least 4 characters.");
      return;
    }

    if (resourceFiles.length === 0) {
      setResourceMessage("Attach at least one file.");
      return;
    }

    setResourceMessage(null);
    startSubmittingResource(async () => {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("description", description);
      formData.set("courseId", courseId || "");
      formData.set("communityId", community.id);
      formData.set("type", resourceType);
      for (const file of resourceFiles) {
        formData.append("files", file);
      }

      const response = await fetch("/api/resources", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            item?: ResourceItem;
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok) {
        setResourceMessage(payload?.error?.message ?? "We could not submit this resource.");
        return;
      }

      setResourceTitle("");
      setResourceDescription("");
      setResourceCourseId("");
      setResourceType("notes");
      setResourceFiles([]);
      if (resourceFileInputRef.current) {
        resourceFileInputRef.current.value = "";
      }
      if (payload?.item) {
        setResourceItems((current) => [payload.item!, ...current.filter((item) => item.id !== payload.item!.id)]);
      }
      setResourceMessage("Resource uploaded. File links are ready.");
    });
  }

  return (
    <main className="spm-page ccd-page">
      <div className="spm-shell ccd-shell" data-active-panel={activePanel}>
        <CampusDesktopNavigation navItems={navItems} viewerName={viewerName} viewerUsername={viewerUsername} />

        <aside className="ccd-community-rail" aria-label="Community navigation">
          <Link href="/messages" className="ccd-back-link">
            Connect
          </Link>
          <div className="ccd-community-card">
            <span className="ccd-community-mark" aria-hidden="true">{communityInitial}</span>
            <div>
              <strong>{community.name}</strong>
              <span>{collegeName}</span>
            </div>
          </div>
          <div className="ccd-rail-status">
            <span>{membershipLabel}</span>
            {communityState.pinned ? <strong>Pinned</strong> : null}
            {communityState.muted ? <strong>Muted</strong> : null}
          </div>
          <nav className="ccd-panel-tabs" aria-label="Community sections">
            {panelTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activePanel === tab.id ? "ccd-panel-tab is-active" : "ccd-panel-tab"}
                onClick={() => setActivePanel(tab.id)}
              >
                <span className="ccd-tab-label">
                  <CommunityIcon name={tab.icon} />
                  <span>{tab.label}</span>
                </span>
                <strong>{panelCounts[tab.id]}</strong>
              </button>
            ))}
          </nav>
          <div className="ccd-rail-actions">
            <button
              type="button"
              onClick={() => patchCommunityState({ muted: !communityState.muted }, communityState.muted ? "Community unmuted." : "Community muted.")}
              disabled={isUpdatingCommunity}
            >
              <CommunityIcon name={communityState.muted ? "bell" : "bell-off"} />
              <span>{communityState.muted ? "Unmute" : "Mute"}</span>
            </button>
            <button
              type="button"
              onClick={() => patchCommunityState({ pinned: !communityState.pinned }, communityState.pinned ? "Removed from top." : "Pinned to top.")}
              disabled={isUpdatingCommunity}
            >
              <CommunityIcon name="pin" />
              <span>{communityState.pinned ? "Unpin" : "Pin top"}</span>
            </button>
            <button type="button" onClick={handleInviteCopy} disabled={!canPost || isInviting}>
              <CommunityIcon name="invite" />
              <span>{isInviting ? "Creating..." : "Invite"}</span>
            </button>
            {canPost ? (
              <button
                type="button"
                className="ccd-danger-action"
                onClick={() => patchCommunityState({ membershipAction: "leave" }, "You left this community.")}
                disabled={isUpdatingCommunity}
              >
                <CommunityIcon name="leave" />
                <span>Leave</span>
              </button>
            ) : communityState.membershipStatus === "requested" ? (
              <button
                type="button"
                onClick={() => patchCommunityState({ membershipAction: "cancel_request" }, "Join request cancelled.")}
                disabled={isUpdatingCommunity}
              >
                <CommunityIcon name="close" />
                <span>Cancel request</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => patchCommunityState({ membershipAction: "request_join" }, "Join request sent.")}
                disabled={isUpdatingCommunity}
              >
                <CommunityIcon name="request" />
                <span>Request to join</span>
              </button>
            )}
          </div>
          {communityActionMessage ? <p className="ccd-status-line" role="status">{communityActionMessage}</p> : null}
          {inviteUrl ? <p className="ccd-invite-line">{inviteUrl}</p> : null}
        </aside>

        <section className="ccd-chat-pane" aria-label={`${community.name} community chat`}>
          <header className="ccd-chat-header">
            <div className="ccd-chat-identity">
              <span className="ccd-chat-mark" aria-hidden="true">{communityInitial}</span>
              <div className="ccd-chat-title">
                <span className="ccd-kicker">{getCommunityTypeLabel(community.type).toUpperCase()}</span>
                <h1>{community.name}</h1>
                <p className="ccd-chat-meta">
                  <span>{formatNumber(displayMemberCount)} members</span>
                  <span>{community.visibility}</span>
                  <span>{membershipLabel}</span>
                </p>
              </div>
            </div>
            <div className="ccd-chat-header-actions">
              <button
                type="button"
                className="ccd-header-icon-action"
                onClick={() => patchCommunityState({ muted: !communityState.muted }, communityState.muted ? "Community unmuted." : "Community muted.")}
                disabled={isUpdatingCommunity}
                aria-label={communityState.muted ? "Unmute community" : "Mute community"}
                aria-pressed={communityState.muted}
                title={communityState.muted ? "Unmute" : "Mute"}
              >
                <CommunityIcon name={communityState.muted ? "bell" : "bell-off"} />
              </button>
              <button
                type="button"
                className="ccd-header-icon-action"
                onClick={() => patchCommunityState({ pinned: !communityState.pinned }, communityState.pinned ? "Removed from top." : "Pinned to top.")}
                disabled={isUpdatingCommunity}
                aria-label={communityState.pinned ? "Unpin community" : "Pin community to top"}
                aria-pressed={communityState.pinned}
                title={communityState.pinned ? "Unpin" : "Pin top"}
              >
                <CommunityIcon name="pin" />
              </button>
              <button
                type="button"
                className="ccd-header-icon-action ccd-header-invite"
                onClick={handleInviteCopy}
                disabled={!canPost || isInviting}
                aria-label="Invite members"
                title="Invite"
              >
                <CommunityIcon name="invite" />
                <span>{isInviting ? "Creating" : "Invite"}</span>
              </button>
            </div>
          </header>

          <div className="ccd-mobile-tabs" aria-label="Community quick sections">
            {panelTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activePanel === tab.id ? "is-active" : ""}
                onClick={() => setActivePanel(tab.id)}
              >
                <CommunityIcon name={tab.icon} />
                <span>{tab.label}</span>
                <strong>{panelCounts[tab.id]}</strong>
              </button>
            ))}
          </div>

          <div ref={scrollRef} className="ccd-message-list">
            {feedLoadError ? <p className="ccd-inline-error">{feedLoadError}</p> : null}
            {interactionMessage ? <p className="ccd-inline-error" role="status">{interactionMessage}</p> : null}
            {engagement.posts.length > 0 ? (
              engagement.posts.map((item) => (
                <CommunityMessage
                  key={item.id}
                  item={item}
                  isOwn={item.author.userId === viewerUserId}
                  canInteract={canPost}
                  isReacting={engagement.loadingPostId === item.id}
                  onReply={handleReplyToPost}
                  onReact={handlePostReaction}
                  onOpenThread={handleOpenComments}
                  onShare={handleShareMessage}
                />
              ))
            ) : (
              <div className="ccd-chat-empty">
                <span className="ccd-chat-empty-icon" aria-hidden="true">
                  <CommunityIcon name="chat" />
                </span>
                <strong>No messages yet</strong>
                <span>Start the first community message.</span>
              </div>
            )}
          </div>

          <div className="ccd-composer-wrap">
            {isLocked ? (
              <div className="ccd-locked-composer">
                <strong>{membershipLabel}</strong>
                <span>
                  {communityState.membershipStatus === "requested"
                    ? "Your request is pending."
                    : "Request access to send messages, replies, reactions, and media."}
                </span>
                {communityState.membershipStatus === "requested" ? (
                  <button type="button" onClick={() => patchCommunityState({ membershipAction: "cancel_request" }, "Join request cancelled.")}>
                    Cancel request
                  </button>
                ) : (
                  <button type="button" onClick={() => patchCommunityState({ membershipAction: "request_join" }, "Join request sent.")}>
                    Request to join
                  </button>
                )}
              </div>
            ) : (
              <>
                {replyTarget ? (
                  <div className="ccd-reply-bar">
                    <div>
                      <strong>Replying to @{replyTarget.author.username}</strong>
                      <span>{replyTarget.body || replyTarget.title || "Media message"}</span>
                    </div>
                    <button type="button" onClick={() => setReplyTarget(null)} aria-label="Clear reply">
                      <CommunityIcon name="close" />
                    </button>
                  </div>
                ) : null}

                {selectedMedia.length > 0 ? (
                  <div className="ccd-media-strip" aria-label="Selected media">
                    {selectedMedia.map((media) => (
                      <div key={media.id} className="ccd-media-tile">
                        {media.mediaType === "video" ? (
                          <video src={media.previewUrl} muted playsInline preload="metadata" />
                        ) : (
                          <img src={media.previewUrl} alt="" />
                        )}
                        <button type="button" onClick={() => removeSelectedMedia(media.id)} aria-label={`Remove ${media.file.name}`}>
                          <CommunityIcon name="close" />
                        </button>
                        <span>{media.mediaType === "video" ? "Video" : "Photo"}</span>
                      </div>
                    ))}
                    <button type="button" className="ccd-clear-media" onClick={clearSelectedMedia}>
                      Clear all
                    </button>
                  </div>
                ) : null}

                {mentionMatches.length > 0 ? (
                  <div className="ccd-mention-menu" aria-label="Mention suggestions">
                    {mentionMatches.map((member) => (
                      <button key={member.membershipId} type="button" onClick={() => insertMention(member)}>
                        <CampusAvatarContent
                          userId={member.userId}
                          username={member.username}
                          avatarUrl={member.avatarUrl}
                          displayName={member.displayName}
                          decorative
                        />
                        <span>
                          <strong>{member.displayName}</strong>
                          <small>@{member.username ?? "member"}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <form className="ccd-composer" onSubmit={handleSendMessage}>
                  <span className="ccd-composer-avatar">
                    <CampusAvatarContent
                      userId={viewerUserId}
                      username={viewerUsername}
                      avatarUrl={viewerAvatarUrl}
                      displayName={viewerName}
                      decorative
                    />
                  </span>
                  <input
                    ref={mediaInputRef}
                    type="file"
                    hidden
                    multiple
                    accept="image/*,video/*"
                    onChange={handleMediaSelection}
                  />
                  <button
                    type="button"
                    className="ccd-attach-button"
                    onClick={() => mediaInputRef.current?.click()}
                    disabled={isPosting}
                    aria-label={selectedMedia.length > 0 ? selectedMediaSummary : "Attach media"}
                    title={selectedMedia.length > 0 ? selectedMediaSummary : "Attach media"}
                  >
                    <CommunityIcon name="attach" />
                    {selectedMedia.length > 0 ? <span>{selectedMedia.length}</span> : null}
                  </button>
                  <textarea
                    ref={composerRef}
                    value={composerText}
                    onChange={(event) => setComposerText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={replyTarget ? "Write a reply" : `Message ${community.name}`}
                    rows={1}
                    maxLength={1600}
                    disabled={isPosting}
                  />
                  <button type="submit" className="ccd-send-button" disabled={isPosting || (!composerText.trim() && selectedMedia.length === 0)}>
                    <CommunityIcon name="send" />
                    <span>{isPosting ? "Sending" : "Send"}</span>
                  </button>
                </form>
                {uploadProgress !== null ? <div className="ccd-upload-progress"><span style={{ width: `${Math.round(uploadProgress * 100)}%` }} /></div> : null}
                {composerStatus ? <p className="ccd-status-line" role="status">{composerStatus}</p> : null}
              </>
            )}
          </div>
        </section>

        <aside className="ccd-info-panel" aria-label="Community details">
          {activePanel === "chat" ? (
            <div className="ccd-info-section">
              <div className="ccd-info-head">
                <span>About</span>
                <strong>{membershipLabel}</strong>
              </div>
              <div className="ccd-info-stats">
                <span><strong>{formatNumber(displayMemberCount)}</strong> members</span>
                <span><strong>{formatNumber(engagement.posts.length)}</strong> messages</span>
                <span><strong>{communityState.muted ? "Off" : "On"}</strong> notifications</span>
              </div>
              <div className="ccd-info-actions">
                <button type="button" onClick={() => patchCommunityState({ muted: !communityState.muted }, communityState.muted ? "Community unmuted." : "Community muted.")}>
                  <CommunityIcon name={communityState.muted ? "bell" : "bell-off"} />
                  <span>{communityState.muted ? "Unmute" : "Mute"}</span>
                </button>
                <button type="button" onClick={() => patchCommunityState({ pinned: !communityState.pinned }, communityState.pinned ? "Removed from top." : "Pinned to top.")}>
                  <CommunityIcon name="pin" />
                  <span>{communityState.pinned ? "Unpin" : "Pin to top"}</span>
                </button>
              </div>
            </div>
          ) : null}

          {activePanel === "members" || activePanel === "chat" ? (
            <div className="ccd-info-section">
              <div className="ccd-info-head">
                <span>Members</span>
                <strong>{formatNumber(displayMemberCount)}</strong>
              </div>
              <div className="ccd-member-list ccd-member-list-compact">
                {memberLoadError ? <p className="ccd-inline-error">{memberLoadError}</p> : null}
                {visibleMembers.length > 0 ? (
                  visibleMembers.slice(0, activePanel === "members" ? visibleMembers.length : 7).map((member) => (
                    <CommunityMemberRow key={member.membershipId} member={member} compact />
                  ))
                ) : (
                  <div className="ccd-empty-state">
                    <strong>No visible members</strong>
                    <span>Verified members will appear here.</span>
                  </div>
                )}
              </div>
              {visibleMembers.length < memberItems.length || memberCursor ? (
                <button type="button" className="ccd-load-more" onClick={handleLoadMoreMembers} disabled={isLoadingMembers}>
                  {isLoadingMembers ? "Loading..." : "Show more members"}
                </button>
              ) : null}
              {memberPageMessage ? <p className="ccd-inline-error" role="status">{memberPageMessage}</p> : null}
            </div>
          ) : null}

          {activePanel === "resources" ? (
            <div className="ccd-info-section">
              <div className="ccd-info-head">
                <span>Shared files</span>
                <Link href="/dashboard">Vault</Link>
              </div>
              {canPost ? (
                <form className="ccd-resource-form" onSubmit={handleResourceSubmit}>
                  <select
                    value={resourceType}
                    onChange={(event) => setResourceType(event.target.value as ResourceItem["type"])}
                    disabled={isSubmittingResource}
                    aria-label="Resource type"
                  >
                    <option value="notes">Notes</option>
                    <option value="pyq">PYQ</option>
                    <option value="guide">Guide</option>
                  </select>
                  <input
                    value={resourceTitle}
                    onChange={(event) => setResourceTitle(event.target.value)}
                    placeholder="Resource title"
                    maxLength={120}
                    disabled={isSubmittingResource}
                  />
                  <input
                    value={resourceCourseId}
                    onChange={(event) => setResourceCourseId(event.target.value)}
                    placeholder="Course ID"
                    maxLength={80}
                    disabled={isSubmittingResource}
                  />
                  <textarea
                    value={resourceDescription}
                    onChange={(event) => setResourceDescription(event.target.value)}
                    placeholder="Short description"
                    rows={3}
                    maxLength={500}
                    disabled={isSubmittingResource}
                  />
                  <label className="ccd-resource-file-picker">
                    <input
                      ref={resourceFileInputRef}
                      type="file"
                      multiple
                      onChange={(event) => setResourceFiles(Array.from(event.target.files ?? []))}
                      disabled={isSubmittingResource}
                    />
                    <span>{resourceFiles.length > 0 ? `${resourceFiles.length} selected` : "Attach files"}</span>
                  </label>
                  {resourceFiles.length > 0 ? (
                    <div className="ccd-resource-file-list">
                      {resourceFiles.map((file) => (
                        <span key={`${file.name}-${file.size}-${file.lastModified}`}>
                          {file.name} - {formatFileSize(file.size)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <button type="submit" disabled={isSubmittingResource || resourceTitle.trim().length < 4 || resourceFiles.length === 0}>
                    {isSubmittingResource ? "Uploading..." : "Upload"}
                  </button>
                  {resourceMessage ? <p className="ccd-status-line" role="status">{resourceMessage}</p> : null}
                </form>
              ) : null}
              {resourcesLoadError ? <p className="ccd-inline-error">{resourcesLoadError}</p> : null}
              <div className="ccd-preview-list">
                {resourceItems.length > 0 ? (
                  resourceItems.map((resource) => <CommunityResourceRow key={resource.id} resource={resource} communitySlug={community.slug} />)
                ) : (
                  <div className="ccd-empty-state">
                    <strong>No files yet</strong>
                    <span>Shared files will appear here.</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activePanel === "events" ? (
            <div className="ccd-info-section">
              <div className="ccd-info-head">
                <span>Events</span>
                <Link href={`/events/host?communityId=${encodeURIComponent(community.id)}`}>Host</Link>
              </div>
              {eventsLoadError ? <p className="ccd-inline-error">{eventsLoadError}</p> : null}
              <div className="ccd-preview-list">
                {events.length > 0 ? (
                  events.map((event) => <CommunityEventRow key={event.id} event={event} />)
                ) : (
                  <div className="ccd-empty-state">
                    <strong>No events yet</strong>
                    <span>Published events attached to this community will appear here.</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </aside>

        <CampusMobileNavigation navItems={navItems} />
      </div>
      <SocialThreadSheet
        viewerName={viewerName}
        viewerUsername={viewerUsername}
        desktopInsetLeft="338px"
        desktopInsetRight="22rem"
        post={engagement.selectedPost}
        comments={engagement.selectedComments}
        draft={engagement.threadDraft}
        mediaUrl={engagement.threadMediaUrl}
        mediaType={engagement.threadMediaType}
        replyTarget={engagement.threadReplyTarget}
        message={engagement.threadMessage}
        isLoading={engagement.threadLoading}
        isSubmitting={engagement.threadSubmitting}
        deletingCommentId={engagement.threadDeletingCommentId}
        isAnonymousComment={engagement.threadIsAnonymous}
        onClose={engagement.closeThread}
        onDraftChange={engagement.setThreadDraft}
        onMediaUrlChange={engagement.setThreadMediaUrl}
        onMediaTypeChange={engagement.setThreadMediaType}
        onAnonymousCommentChange={engagement.setThreadIsAnonymous}
        onReply={engagement.beginReply}
        onCommentLike={(commentId) => {
          void engagement.reactToComment(commentId);
        }}
        onDeleteComment={(comment) => {
          void engagement.deleteComment(comment.id);
        }}
        onEditComment={(comment, body) => engagement.editComment(comment.id, body)}
        onClearReply={engagement.clearReplyTarget}
        onSubmit={() => void engagement.submitComment()}
      />
    </main>
  );
}
