"use client";

import type {
  CampusEvent,
  CommunityDetailResponse,
  CommunityMemberItem,
  CommunityMembersResponse,
  FeedCard,
  ResourceItem
} from "@vyb/contracts";
import Link from "next/link";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CampusAvatarContent } from "./campus-avatar";
import { buildPrimaryCampusNav, CampusDesktopNavigation, CampusMobileNavigation } from "./campus-navigation";
import { SocialThreadSheet } from "./social-thread-sheet";
import { useSocialPostEngagement } from "./use-social-post-engagement";

type CommunityDetailTab = "feed" | "members" | "resources" | "events";

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
};

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

const tabs: Array<{ id: CommunityDetailTab; label: string }> = [
  { id: "feed", label: "Feed" },
  { id: "members", label: "Members" },
  { id: "resources", label: "Resources" },
  { id: "events", label: "Events" }
];

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

function CommunityMemberRow({ member }: { member: CommunityMemberItem }) {
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
      <span className="ccd-member-role">{member.role}</span>
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

function CommunityResourceRow({ resource }: { resource: ResourceItem }) {
  return (
    <Link href="/dashboard" className="ccd-preview-row">
      <span className="ccd-preview-icon">{resource.type.slice(0, 1).toUpperCase()}</span>
      <span className="ccd-preview-copy">
        <strong>{resource.title}</strong>
        <span>{resource.description || `${resource.type} resource`}</span>
      </span>
      <span className="ccd-preview-meta">{formatDate(resource.createdAt)}</span>
    </Link>
  );
}

function CommunityEventRow({ event }: { event: CampusEvent }) {
  return (
    <Link href={`/hub?event=${encodeURIComponent(event.id)}`} className="ccd-preview-row">
      <span className="ccd-preview-icon">{event.category.slice(0, 1).toUpperCase()}</span>
      <span className="ccd-preview-copy">
        <strong>{event.title}</strong>
        <span>{event.club} - {event.location}</span>
      </span>
      <span className="ccd-preview-meta">{formatEventDate(event.startsAt)}</span>
    </Link>
  );
}

function FeedPreview({
  item,
  canInteract,
  isReacting,
  onReact,
  onOpenComments
}: {
  item: FeedCard;
  canInteract: boolean;
  isReacting: boolean;
  onReact: (item: FeedCard) => void;
  onOpenComments: (item: FeedCard) => void;
}) {
  return (
    <article className="ccd-feed-card">
      <div className="ccd-feed-head">
        <span className="ccd-feed-avatar">
          <CampusAvatarContent
            userId={item.author.userId}
            username={item.author.username}
            avatarUrl={item.author.avatarUrl}
            displayName={item.author.displayName}
            decorative
          />
        </span>
        <span>
          <strong>{item.author.displayName}</strong>
          <small>{formatDate(item.createdAt)}</small>
        </span>
      </div>
      {item.title ? <h3>{item.title}</h3> : null}
      <p>{item.body}</p>
      <div className="ccd-feed-meta">
        <span>{formatNumber(item.reactions)} reactions</span>
        <span>{formatNumber(item.comments)} comments</span>
      </div>
      <div className="ccd-feed-actions">
        <button type="button" onClick={() => onReact(item)} disabled={!canInteract || isReacting}>
          {item.viewerReactionType ? "Liked" : "Like"}
        </button>
        <button type="button" onClick={() => onOpenComments(item)} disabled={!canInteract}>
          Comments
        </button>
        <span>{item.viewerReactionType ? "You reacted" : "Join the thread"}</span>
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
  eventsLoadError
}: CampusCommunityDetailShellProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CommunityDetailTab>("feed");
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [composerMessage, setComposerMessage] = useState<string | null>(null);
  const [interactionMessage, setInteractionMessage] = useState<string | null>(null);
  const [memberItems, setMemberItems] = useState(members);
  const [memberCursor, setMemberCursor] = useState<string | null>(membersNextCursor);
  const [memberPageMessage, setMemberPageMessage] = useState<string | null>(null);
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [resourceCourseId, setResourceCourseId] = useState("");
  const [resourceType, setResourceType] = useState<ResourceItem["type"]>("notes");
  const [resourceMessage, setResourceMessage] = useState<string | null>(null);
  const [isPosting, startPosting] = useTransition();
  const [isLoadingMembers, startLoadingMembers] = useTransition();
  const [isSubmittingResource, startSubmittingResource] = useTransition();
  const navItems = useMemo(() => buildPrimaryCampusNav("messages"), []);
  const community = detail.community;
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
  const [memberVisibleCount, setMemberVisibleCount] = useState(12);
  const visibleMembers = memberItems.slice(0, memberVisibleCount);
  const canPost = detail.viewer.isMember;
  const tabCounts: Record<CommunityDetailTab, string> = {
    feed: detail.summary.postCount === null ? formatNumber(engagement.posts.length) : formatNumber(detail.summary.postCount),
    members: formatNumber(Math.max(community.memberCount, memberItems.length)),
    resources: detail.summary.resourceCount === null ? formatNumber(resources.length) : formatNumber(detail.summary.resourceCount),
    events: detail.summary.eventCount === null ? formatNumber(events.length) : formatNumber(detail.summary.eventCount)
  };

  function handlePostSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = postBody.trim();
    const title = postTitle.trim();
    if (!body) {
      setComposerMessage("Post body is required.");
      return;
    }

    if (!canPost) {
      setComposerMessage("Only community members can post here.");
      return;
    }

    setComposerMessage(null);
    startPosting(async () => {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          title: title || community.name,
          body,
          communityId: community.id,
          kind: "text",
          placement: "feed",
          isAnonymous: false,
          allowAnonymousComments: false
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
        setComposerMessage(payload?.error?.message ?? "We could not publish this post.");
        return;
      }

      const createdItem = payload.item;
      engagement.prependPost(createdItem);
      setPostTitle("");
      setPostBody("");
      setComposerMessage("Posted.");
      setActiveTab("feed");
      router.refresh();
    });
  }

  function handlePostReaction(item: FeedCard) {
    if (!canPost) {
      setInteractionMessage("Only community members can react here.");
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
      setInteractionMessage("Only community members can view this thread.");
      return;
    }

    setInteractionMessage(null);
    void engagement.openThread(item.id);
  }

  function handleLoadMoreMembers() {
    if (memberVisibleCount < memberItems.length) {
      setMemberVisibleCount((current) => Math.min(memberItems.length, current + 12));
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
      setMemberVisibleCount((current) => current + 12);
    });
  }

  function handleResourceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = resourceTitle.trim();
    const description = resourceDescription.trim();
    const courseId = resourceCourseId.trim();

    if (!canPost) {
      setResourceMessage("Only community members can submit resources here.");
      return;
    }

    if (title.length < 4) {
      setResourceMessage("Resource title must be at least 4 characters.");
      return;
    }

    setResourceMessage(null);
    startSubmittingResource(async () => {
      const response = await fetch("/api/resources", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          title,
          description,
          courseId: courseId || null,
          communityId: community.id,
          type: resourceType
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
        setResourceMessage(payload?.error?.message ?? "We could not submit this resource.");
        return;
      }

      setResourceTitle("");
      setResourceDescription("");
      setResourceCourseId("");
      setResourceType("notes");
      setResourceMessage("Resource submitted for review.");
      router.refresh();
    });
  }

  return (
    <main className="spm-page ccd-page">
      <div className="spm-shell ccd-shell">
        <CampusDesktopNavigation navItems={navItems} viewerName={viewerName} viewerUsername={viewerUsername} />

        <section className="ccd-main" aria-label={`${community.name} community`}>
          <header className="ccd-topbar">
            <Link href="/messages" className="ccd-back-link">
              Connect
            </Link>
            <span>{collegeName}</span>
          </header>

          <section className="ccd-hero" aria-label="Community overview">
            <div className="ccd-hero-copy">
              <span className="ccd-kicker">{getCommunityTypeLabel(community.type).toUpperCase()}</span>
              <h1>{community.name}</h1>
              <p>{community.isOfficial ? "Official campus circle" : "Campus circle"} - {community.visibility}</p>
            </div>
            <div className="ccd-hero-stats" aria-label="Community stats">
              <span>
                <strong>{formatNumber(community.memberCount)}</strong>
                members
              </span>
              <span>
                <strong>{community.membershipRole ?? detail.viewer.role ?? "member"}</strong>
                your role
              </span>
              <span>
                <strong>{community.latestActivityAt ? formatDate(community.latestActivityAt) : "Live"}</strong>
                activity
              </span>
            </div>
          </section>

          <nav className="ccd-tabs" aria-label="Community sections">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? "ccd-tab ccd-tab-active" : "ccd-tab"}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.label}</span>
                <strong>{tabCounts[tab.id]}</strong>
              </button>
            ))}
          </nav>

          <section className="ccd-content">
            {activeTab === "feed" ? (
              <div className="ccd-feed-list">
                <form className="ccd-composer" onSubmit={handlePostSubmit}>
                  <div className="ccd-composer-head">
                    <span className="ccd-composer-avatar">
                      <CampusAvatarContent
                        userId={viewerUserId}
                        username={viewerUsername}
                        avatarUrl={viewerAvatarUrl}
                        displayName={viewerName}
                        decorative
                      />
                    </span>
                    <span className="ccd-composer-copy">
                      <strong>{viewerName}</strong>
                      <span>@{viewerUsername} - {community.name}</span>
                    </span>
                  </div>
                  <input
                    className="ccd-composer-title"
                    value={postTitle}
                    onChange={(event) => setPostTitle(event.target.value)}
                    placeholder="Title"
                    maxLength={100}
                    disabled={!canPost || isPosting}
                  />
                  <textarea
                    className="ccd-composer-body"
                    value={postBody}
                    onChange={(event) => setPostBody(event.target.value)}
                    placeholder={`Post to ${community.name}`}
                    rows={4}
                    maxLength={1200}
                    disabled={!canPost || isPosting}
                  />
                  <div className="ccd-composer-actions">
                    <span>{postBody.trim().length}/1200</span>
                    <button type="submit" disabled={!canPost || isPosting || !postBody.trim()}>
                      {isPosting ? "Posting..." : "Post"}
                    </button>
                  </div>
                  {composerMessage ? <p className="ccd-composer-message" role="status">{composerMessage}</p> : null}
                </form>
                {feedLoadError ? <p className="ccd-inline-error">{feedLoadError}</p> : null}
                {interactionMessage ? <p className="ccd-inline-error" role="status">{interactionMessage}</p> : null}
                {engagement.posts.length > 0 ? (
                  engagement.posts.map((item) => (
                    <FeedPreview
                      key={item.id}
                      item={item}
                      canInteract={canPost}
                      isReacting={engagement.loadingPostId === item.id}
                      onReact={handlePostReaction}
                      onOpenComments={handleOpenComments}
                    />
                  ))
                ) : (
                  <div className="ccd-empty-state">
                    <strong>No posts in this circle yet</strong>
                    <span>Start the first update for this circle.</span>
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === "members" ? (
              <div className="ccd-member-list">
                {memberLoadError ? <p className="ccd-inline-error">{memberLoadError}</p> : null}
                {visibleMembers.length > 0 ? (
                  <>
                    {visibleMembers.map((member) => <CommunityMemberRow key={member.membershipId} member={member} />)}
                    {visibleMembers.length < memberItems.length || memberCursor ? (
                      <button
                        type="button"
                        className="ccd-load-more"
                        onClick={handleLoadMoreMembers}
                        disabled={isLoadingMembers}
                      >
                        {isLoadingMembers ? "Loading..." : "Show more members"}
                      </button>
                    ) : null}
                    {memberPageMessage ? <p className="ccd-inline-error" role="status">{memberPageMessage}</p> : null}
                  </>
                ) : (
                  <div className="ccd-empty-state">
                    <strong>No visible members yet</strong>
                    <span>Verified members will appear here.</span>
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === "resources" ? (
              <div className="ccd-preview-list">
                <div className="ccd-preview-head">
                  <span>Campus resources</span>
                  <Link href="/dashboard">Open vault</Link>
                </div>
                {canPost ? (
                  <form className="ccd-resource-form" onSubmit={handleResourceSubmit}>
                    <div className="ccd-resource-grid">
                      <select
                        className="ccd-resource-select"
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
                        className="ccd-composer-title"
                        value={resourceTitle}
                        onChange={(event) => setResourceTitle(event.target.value)}
                        placeholder="DBMS quick revision notes"
                        maxLength={120}
                        disabled={isSubmittingResource}
                      />
                    </div>
                    <input
                      className="ccd-composer-title"
                      value={resourceCourseId}
                      onChange={(event) => setResourceCourseId(event.target.value)}
                      placeholder="Course ID"
                      maxLength={80}
                      disabled={isSubmittingResource}
                    />
                    <textarea
                      className="ccd-composer-body ccd-resource-body"
                      value={resourceDescription}
                      onChange={(event) => setResourceDescription(event.target.value)}
                      placeholder="Short description"
                      rows={3}
                      maxLength={500}
                      disabled={isSubmittingResource}
                    />
                    <div className="ccd-composer-actions">
                      <span>{resourceTitle.trim().length}/120</span>
                      <button type="submit" disabled={isSubmittingResource || resourceTitle.trim().length < 4}>
                        {isSubmittingResource ? "Submitting..." : "Submit"}
                      </button>
                    </div>
                    {resourceMessage ? <p className="ccd-composer-message" role="status">{resourceMessage}</p> : null}
                  </form>
                ) : null}
                {resourcesLoadError ? <p className="ccd-inline-error">{resourcesLoadError}</p> : null}
                {resources.length > 0 ? (
                  resources.map((resource) => <CommunityResourceRow key={resource.id} resource={resource} />)
                ) : (
                  <div className="ccd-empty-state">
                    <strong>No resources ready yet</strong>
                    <span>Published files attached to this community will appear here.</span>
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === "events" ? (
              <div className="ccd-preview-list">
                <div className="ccd-preview-head">
                  <span>Campus events</span>
                  <Link href={`/events/host?communityId=${encodeURIComponent(community.id)}`}>Host event</Link>
                </div>
                {eventsLoadError ? <p className="ccd-inline-error">{eventsLoadError}</p> : null}
                {events.length > 0 ? (
                  events.map((event) => <CommunityEventRow key={event.id} event={event} />)
                ) : (
                  <div className="ccd-empty-state">
                    <strong>No live events yet</strong>
                    <span>Published events attached to this community will appear here.</span>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        </section>

        <aside className="ccd-side" aria-label="Community members preview">
          <div className="ccd-side-head">
            <span>MEMBERS</span>
            <strong>{formatNumber(Math.max(community.memberCount, memberItems.length))}</strong>
          </div>
          <div className="ccd-member-list ccd-member-list-compact">
            {visibleMembers.length > 0 ? (
              visibleMembers.slice(0, 6).map((member) => <CommunityMemberRow key={member.membershipId} member={member} />)
            ) : (
              <div className="ccd-empty-state ccd-empty-compact">
                <strong>Member preview empty</strong>
                <span>{memberLoadError ?? "No visible members loaded."}</span>
              </div>
            )}
          </div>
        </aside>

        <CampusMobileNavigation navItems={navItems} />
      </div>
      <SocialThreadSheet
        viewerName={viewerName}
        viewerUsername={viewerUsername}
        desktopInsetLeft="260px"
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
