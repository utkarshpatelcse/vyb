"use client";

import type { CommentItem, DeleteCommentResponse, FeedCard, ReactionKind, ReactionResponse, UpdateCommentResponse } from "@vyb/contracts";
import { useEffect, useMemo, useRef, useState } from "react";

type CommentMediaKind = "gif" | "sticker";
type RealtimeState = "idle" | "connecting" | "live" | "reconnecting" | "offline";
type SocialEngagementViewer = {
  viewerName?: string;
  viewerUsername?: string;
  viewerUserId?: string | null;
};

type SocialRealtimeEvent =
  | { type: "social.connected"; tenantId?: string; payload?: never }
  | { type: "social.post.created"; payload?: { item?: FeedCard } }
  | { type: "social.post.updated"; payload?: { item?: FeedCard } }
  | { type: "social.post.deleted"; payload?: { postId?: string } }
  | { type: "social.post.reaction.updated"; payload?: { postId?: string; aggregateCount?: number } }
  | { type: "social.comment.created"; payload?: { postId?: string; item?: CommentItem } }
  | { type: "social.comment.updated"; payload?: { postId?: string; item?: CommentItem } }
  | { type: "social.comment.deleted"; payload?: { postId?: string; commentId?: string; deletedCount?: number } }
  | {
      type: "social.comment.reaction.updated";
      payload?: { postId?: string; commentId?: string; aggregateCount?: number };
    };

function isFeedCard(value: unknown): value is FeedCard {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as FeedCard).id === "string" &&
      typeof (value as FeedCard).placement === "string"
  );
}

function isCommentItem(value: unknown): value is CommentItem {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as CommentItem).id === "string" &&
      typeof (value as CommentItem).postId === "string"
  );
}

export function useSocialPostEngagement(
  initialPosts: FeedCard[],
  placementFilter: FeedCard["placement"] = "feed",
  viewer: SocialEngagementViewer = {}
) {
  const [posts, setPosts] = useState(initialPosts);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommentItem[]>>({});
  const [threadDraft, setThreadDraft] = useState("");
  const [threadMediaUrl, setThreadMediaUrl] = useState("");
  const [threadMediaType, setThreadMediaType] = useState<CommentMediaKind>("gif");
  const [threadReplyTarget, setThreadReplyTarget] = useState<CommentItem | null>(null);
  const [threadIsAnonymous, setThreadIsAnonymous] = useState(false);
  const [threadMessage, setThreadMessage] = useState<string | null>(null);
  const [loadingPostId, setLoadingPostId] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadSubmitting, setThreadSubmitting] = useState(false);
  const [threadDeletingCommentId, setThreadDeletingCommentId] = useState<string | null>(null);
  const [realtimeState, setRealtimeState] = useState<RealtimeState>("idle");
  const seenRealtimeCommentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    let connectInFlight = false;
    let closedByCleanup = false;

    function clearReconnectTimer() {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }

    function canKeepSocketAlive() {
      return navigator.onLine && document.visibilityState === "visible";
    }

    function scheduleReconnect() {
      if (closedByCleanup) {
        return;
      }

      clearReconnectTimer();
      if (!canKeepSocketAlive()) {
        setRealtimeState("offline");
        return;
      }

      setRealtimeState("reconnecting");
      const delayMs = Math.min(15000, 800 * 2 ** reconnectAttempt) + Math.floor(Math.random() * 250);
      reconnectAttempt += 1;
      reconnectTimer = window.setTimeout(() => {
        void connect();
      }, delayMs);
    }

    function closeSocket() {
      if (socket) {
        socket.onclose = null;
        socket.close();
        socket = null;
      }
    }

    function applyRealtimeEvent(event: SocialRealtimeEvent) {
      if (event.type === "social.connected") {
        return;
      }

      if (event.type === "social.post.created") {
        const item = event.payload?.item;
        if (!isFeedCard(item) || item.placement !== placementFilter) {
          return;
        }

        setPosts((current) => (current.some((post) => post.id === item.id) ? current : [item, ...current]));
        return;
      }

      if (event.type === "social.post.updated") {
        const item = event.payload?.item;
        if (!isFeedCard(item) || item.placement !== placementFilter) {
          return;
        }

        setPosts((current) =>
          current.map((post) =>
            post.id === item.id
              ? {
                  ...item,
                  isSaved: post.isSaved,
                  viewerCanManage: post.viewerCanManage,
                  viewerReactionType: post.viewerReactionType
                }
              : post
          )
        );
        return;
      }

      if (event.type === "social.post.deleted") {
        const postId = event.payload?.postId;
        if (!postId) {
          return;
        }

        setPosts((current) => current.filter((post) => post.id !== postId));
        setCommentsByPost((current) => {
          if (!current[postId]) {
            return current;
          }

          const next = { ...current };
          delete next[postId];
          return next;
        });
        setSelectedPostId((current) => (current === postId ? null : current));
        return;
      }

      if (event.type === "social.post.reaction.updated") {
        const postId = event.payload?.postId;
        const aggregateCount = event.payload?.aggregateCount;
        if (!postId || typeof aggregateCount !== "number") {
          return;
        }

        setPosts((current) =>
          current.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  reactions: aggregateCount
                }
              : post
          )
        );
        return;
      }

      if (event.type === "social.comment.created") {
        const item = event.payload?.item;
        const postId = event.payload?.postId ?? item?.postId;
        if (!postId || !isCommentItem(item)) {
          return;
        }

        if (seenRealtimeCommentIdsRef.current.has(item.id)) {
          return;
        }
        seenRealtimeCommentIdsRef.current.add(item.id);

        setCommentsByPost((current) => {
          const existing = current[postId];
          if (!existing || existing.some((comment) => comment.id === item.id)) {
            return current;
          }

          return {
            ...current,
            [postId]: [...existing, item]
          };
        });
        setPosts((current) =>
          current.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  comments: post.comments + 1
                }
              : post
          )
        );
        return;
      }

      if (event.type === "social.comment.deleted") {
        const postId = event.payload?.postId;
        const commentId = event.payload?.commentId;
        const deletedCount = typeof event.payload?.deletedCount === "number" ? event.payload.deletedCount : 1;
        if (!postId || !commentId) {
          return;
        }

        setCommentsByPost((current) => {
          const existing = current[postId];
          if (!existing) {
            return current;
          }

          return {
            ...current,
            [postId]: existing.filter((comment) => comment.id !== commentId && comment.parentCommentId !== commentId)
          };
        });
        setPosts((current) =>
          current.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  comments: Math.max(0, post.comments - deletedCount)
                }
              : post
          )
        );
        return;
      }

      if (event.type === "social.comment.updated") {
        const item = event.payload?.item;
        const postId = event.payload?.postId ?? item?.postId;
        if (!postId || !isCommentItem(item)) {
          return;
        }

        setCommentsByPost((current) => {
          const existing = current[postId];
          if (!existing) {
            return current;
          }

          return {
            ...current,
            [postId]: existing.map((comment) =>
              comment.id === item.id
                ? {
                    ...item,
                    viewerCanManage: comment.viewerCanManage,
                    viewerHasLiked: comment.viewerHasLiked
                  }
                : comment
            )
          };
        });
        return;
      }

      if (event.type === "social.comment.reaction.updated") {
        const postId = event.payload?.postId;
        const commentId = event.payload?.commentId;
        const aggregateCount = event.payload?.aggregateCount;
        if (!postId || !commentId || typeof aggregateCount !== "number") {
          return;
        }

        setCommentsByPost((current) => {
          const existing = current[postId];
          if (!existing) {
            return current;
          }

          return {
            ...current,
            [postId]: existing.map((comment) =>
              comment.id === commentId
                ? {
                    ...comment,
                    reactions: aggregateCount
                  }
                : comment
            )
          };
        });
      }
    }

    async function connect() {
      if (closedByCleanup || connectInFlight || !canKeepSocketAlive()) {
        return;
      }

      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return;
      }

      connectInFlight = true;
      setRealtimeState(reconnectAttempt > 0 ? "reconnecting" : "connecting");

      try {
        const response = await fetch("/api/social/socket-token", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { wsUrl?: string } | null;

        if (response.status === 401) {
          setRealtimeState("idle");
          return;
        }

        if (!response.ok || typeof payload?.wsUrl !== "string") {
          scheduleReconnect();
          return;
        }

        closeSocket();
        socket = new WebSocket(payload.wsUrl);

        socket.onopen = () => {
          reconnectAttempt = 0;
          setRealtimeState("live");
        };

        socket.onmessage = (message) => {
          try {
            applyRealtimeEvent(JSON.parse(String(message.data)) as SocialRealtimeEvent);
          } catch {
            // Ignore malformed realtime frames.
          }
        };

        socket.onerror = () => {
          socket?.close();
        };

        socket.onclose = () => {
          socket = null;
          scheduleReconnect();
        };
      } catch {
        scheduleReconnect();
      } finally {
        connectInFlight = false;
      }
    }

    function handleVisibilityOrNetworkChange() {
      if (canKeepSocketAlive()) {
        void connect();
        return;
      }

      closeSocket();
      setRealtimeState("offline");
    }

    void connect();
    window.addEventListener("online", handleVisibilityOrNetworkChange);
    window.addEventListener("offline", handleVisibilityOrNetworkChange);
    document.addEventListener("visibilitychange", handleVisibilityOrNetworkChange);

    return () => {
      closedByCleanup = true;
      clearReconnectTimer();
      closeSocket();
      window.removeEventListener("online", handleVisibilityOrNetworkChange);
      window.removeEventListener("offline", handleVisibilityOrNetworkChange);
      document.removeEventListener("visibilitychange", handleVisibilityOrNetworkChange);
    };
  }, [placementFilter]);

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) ?? null,
    [posts, selectedPostId]
  );

  useEffect(() => {
    if (selectedPost?.allowAnonymousComments === false) {
      setThreadIsAnonymous(false);
    }
  }, [selectedPost?.id, selectedPost?.allowAnonymousComments]);

  async function loadComments(postId: string) {
    if (commentsByPost[postId]) {
      return;
    }

    setThreadLoading(true);

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments`);
      const payload = (await response.json().catch(() => null)) as
        | {
          items?: CommentItem[];
          error?: {
            message?: string;
          };
        }
        | null;

      if (!response.ok) {
        setThreadMessage(payload?.error?.message ?? "We could not load comments right now.");
        return;
      }

      setCommentsByPost((current) => ({
        ...current,
        [postId]: payload?.items ?? []
      }));
    } catch {
      setThreadMessage("We could not load comments right now.");
    } finally {
      setThreadLoading(false);
    }
  }

  async function openThread(postId: string) {
    setSelectedPostId(postId);
    setThreadMessage(null);
    await loadComments(postId);
  }

  function closeThread() {
    setSelectedPostId(null);
    setThreadDraft("");
    setThreadMediaUrl("");
    setThreadMediaType("gif");
    setThreadReplyTarget(null);
    setThreadIsAnonymous(false);
    setThreadMessage(null);
  }

  async function react(postId: string, reactionType: ReactionKind = "like") {
    const currentPost = posts.find((item) => item.id === postId) ?? null;
    if (!currentPost) {
      return null;
    }
    const currentReactionType = currentPost.viewerReactionType;
    const isRemovingReaction = currentReactionType === reactionType;
    const optimisticReactionCount = Math.max(
      0,
      currentPost.reactions + (currentReactionType ? (isRemovingReaction ? -1 : 0) : 1)
    );
    const optimisticViewerReaction = isRemovingReaction ? null : reactionType;

    setLoadingPostId(postId);
    setThreadMessage(null);
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
            ...post,
            reactions: optimisticReactionCount,
            viewerReactionType: optimisticViewerReaction
          }
          : post
      )
    );

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/reactions`, {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          reactionType
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | ReactionResponse
        | {
          error?: {
            message?: string;
          };
        }
        | null;

      if (!response.ok || !payload || !("aggregateCount" in payload)) {
        setPosts((current) =>
          current.map((post) =>
            post.id === postId
              ? {
                ...post,
                reactions: currentPost.reactions,
                viewerReactionType: currentPost.viewerReactionType
              }
              : post
          )
        );
        setThreadMessage(
          payload && "error" in payload
            ? payload.error?.message ?? "We could not update that reaction right now."
            : "We could not update that reaction right now."
        );
        return null;
      }

      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
              ...post,
              reactions: payload.aggregateCount,
              viewerReactionType: payload.active ? payload.viewerReactionType : null
            }
            : post
        )
      );
      return payload;
    } catch {
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
              ...post,
              reactions: currentPost.reactions,
              viewerReactionType: currentPost.viewerReactionType
            }
            : post
        )
      );
      setThreadMessage("We could not update that reaction right now.");
      return null;
    } finally {
      setLoadingPostId(null);
    }
  }

  async function submitComment() {
    const post = selectedPost;
    const body = threadDraft.trim();
    const mediaUrl = threadMediaUrl.trim();
    const replyTarget = threadReplyTarget;
    const mediaType = threadMediaType;
    const requestedAnonymous = threadIsAnonymous && post?.allowAnonymousComments !== false;

    if (!post) {
      return;
    }

    if (!body && !mediaUrl) {
      setThreadMessage("Write a comment or paste a GIF/sticker link before posting.");
      return;
    }

    const optimisticCommentId = `optimistic-comment-${post.id}-${Date.now()}`;
    const optimisticComment: CommentItem = {
      id: optimisticCommentId,
      postId: post.id,
      membershipId: null,
      authorUserId: requestedAnonymous ? null : viewer.viewerUserId ?? null,
      parentCommentId: replyTarget?.id ?? null,
      body,
      mediaUrl: mediaUrl || null,
      mediaType: mediaUrl ? mediaType : null,
      isAnonymous: requestedAnonymous,
      createdAt: new Date().toISOString(),
      reactions: 0,
      viewerHasLiked: false,
      viewerCanManage: true,
      author: requestedAnonymous
        ? {
            userId: null,
            username: "anonymous",
            displayName: "Anonymous Vyber",
            avatarUrl: null,
            isAnonymous: true
          }
        : {
            userId: viewer.viewerUserId ?? null,
            username: viewer.viewerUsername || "you",
            displayName: viewer.viewerName || viewer.viewerUsername || "You",
            avatarUrl: null,
            isAnonymous: false
          }
    };

    seenRealtimeCommentIdsRef.current.add(optimisticCommentId);
    setCommentsByPost((current) => ({
      ...current,
      [post.id]: [...(current[post.id] ?? []), optimisticComment]
    }));
    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              comments: item.comments + 1
            }
          : item
      )
    );
    setThreadDraft("");
    setThreadMediaUrl("");
    setThreadMediaType("gif");
    setThreadReplyTarget(null);
    setThreadSubmitting(true);
    setThreadMessage(null);

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}/comments`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          body: body || undefined,
          parentCommentId: replyTarget?.id ?? null,
          mediaUrl: mediaUrl || null,
          mediaType: mediaUrl ? mediaType : null,
          mediaMimeType: mediaUrl ? (mediaType === "sticker" ? "image/webp" : "image/gif") : null,
          isAnonymous: requestedAnonymous
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
          item?: CommentItem;
          error?: {
            message?: string;
          };
        }
        | null;

      if (!response.ok || !payload?.item) {
        setCommentsByPost((current) => ({
          ...current,
          [post.id]: (current[post.id] ?? []).filter((comment) => comment.id !== optimisticCommentId)
        }));
        setPosts((current) =>
          current.map((item) =>
            item.id === post.id
              ? {
                  ...item,
                  comments: Math.max(0, item.comments - 1)
                }
              : item
          )
        );
        setThreadDraft(body);
        setThreadMediaUrl(mediaUrl);
        setThreadMediaType(mediaType);
        setThreadReplyTarget(replyTarget);
        setThreadMessage(payload?.error?.message ?? "We could not publish this comment right now.");
        return;
      }

      seenRealtimeCommentIdsRef.current.add(payload.item.id);
      setCommentsByPost((current) => ({
        ...current,
        [post.id]: (current[post.id] ?? []).map((comment) =>
          comment.id === optimisticCommentId ? payload.item! : comment
        )
      }));
    } catch {
      setCommentsByPost((current) => ({
        ...current,
        [post.id]: (current[post.id] ?? []).filter((comment) => comment.id !== optimisticCommentId)
      }));
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                comments: Math.max(0, item.comments - 1)
              }
            : item
        )
      );
      setThreadDraft(body);
      setThreadMediaUrl(mediaUrl);
      setThreadMediaType(mediaType);
      setThreadReplyTarget(replyTarget);
      setThreadMessage("We could not publish this comment right now.");
    } finally {
      setThreadSubmitting(false);
    }
  }

  async function reactToComment(commentId: string) {
    const post = selectedPost;
    if (!post) {
      return null;
    }

    const currentComment = (commentsByPost[post.id] ?? []).find((item) => item.id === commentId) ?? null;
    if (!currentComment) {
      return null;
    }
    const isRemovingLike = currentComment.viewerHasLiked;
    const optimisticReactionCount = Math.max(0, currentComment.reactions + (isRemovingLike ? -1 : 1));

    setCommentsByPost((current) => ({
      ...current,
      [post.id]: (current[post.id] ?? []).map((item) =>
        item.id === commentId
          ? {
            ...item,
            reactions: optimisticReactionCount,
            viewerHasLiked: !isRemovingLike
          }
          : item
      )
    }));
    setThreadMessage(null);

    try {
      const response = await fetch(`/api/comments/${encodeURIComponent(commentId)}/reactions`, {
        method: "PUT"
      });
      const payload = (await response.json().catch(() => null)) as
        | {
          aggregateCount?: number;
          active?: boolean;
          error?: {
            message?: string;
          };
        }
        | null;

      if (!response.ok || typeof payload?.aggregateCount !== "number") {
        setCommentsByPost((current) => ({
          ...current,
          [post.id]: (current[post.id] ?? []).map((item) =>
            item.id === commentId
              ? {
                ...item,
                reactions: currentComment.reactions,
                viewerHasLiked: currentComment.viewerHasLiked
              }
              : item
          )
        }));
        setThreadMessage(payload?.error?.message ?? "We could not like that comment right now.");
        return null;
      }

      setCommentsByPost((current) => ({
        ...current,
        [post.id]: (current[post.id] ?? []).map((item) =>
          item.id === commentId
            ? {
              ...item,
              reactions: payload.aggregateCount!,
              viewerHasLiked: Boolean(payload.active)
            }
            : item
        )
      }));

      return payload;
    } catch {
      setCommentsByPost((current) => ({
        ...current,
        [post.id]: (current[post.id] ?? []).map((item) =>
          item.id === commentId
            ? {
              ...item,
              reactions: currentComment.reactions,
              viewerHasLiked: currentComment.viewerHasLiked
            }
            : item
        )
      }));
      setThreadMessage("We could not like that comment right now.");
      return null;
    }
  }

  function prependPost(post: FeedCard) {
    setPosts((current) => [post, ...current]);
  }

  function appendPosts(nextPosts: FeedCard[]) {
    setPosts((current) => {
      const seenIds = new Set(current.map((post) => post.id));
      const uniqueNextPosts = nextPosts.filter((post) => {
        if (seenIds.has(post.id)) {
          return false;
        }

        seenIds.add(post.id);
        return true;
      });

      return uniqueNextPosts.length > 0 ? [...current, ...uniqueNextPosts] : current;
    });
  }

  function replacePost(post: FeedCard) {
    setPosts((current) => current.map((item) => (item.id === post.id ? post : item)));
  }

  function removePost(postId: string) {
    setPosts((current) => current.filter((item) => item.id !== postId));

    if (selectedPostId === postId) {
      closeThread();
    }
  }

  function beginReply(comment: CommentItem) {
    const replyPrefix = `@${comment.author?.username ?? "vyb_user"} `;
    setThreadReplyTarget(comment);
    setThreadDraft((current) => {
      const nextBody = current.replace(/^@\S+\s+/, "");
      return `${replyPrefix}${nextBody}`.trimStart();
    });
  }

  function collectCommentThreadIds(comments: CommentItem[], commentId: string) {
    const ids = new Set<string>([commentId]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const comment of comments) {
        if (comment.parentCommentId && ids.has(comment.parentCommentId) && !ids.has(comment.id)) {
          ids.add(comment.id);
          changed = true;
        }
      }
    }

    return ids;
  }

  async function deleteComment(commentId: string) {
    const post = selectedPost;
    if (!post) {
      return null;
    }

    const currentComments = commentsByPost[post.id] ?? [];
    const targetComment = currentComments.find((item) => item.id === commentId) ?? null;
    if (!targetComment) {
      return null;
    }

    const removedIds = collectCommentThreadIds(currentComments, commentId);
    const removedCount = removedIds.size;

    setThreadDeletingCommentId(commentId);
    setThreadMessage(null);
    setCommentsByPost((current) => ({
      ...current,
      [post.id]: (current[post.id] ?? []).filter((item) => !removedIds.has(item.id))
    }));
    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
            ...item,
            comments: Math.max(0, item.comments - removedCount)
          }
          : item
      )
    );

    try {
      const response = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, {
        method: "DELETE"
      });
      const payload = (await response.json().catch(() => null)) as
        | DeleteCommentResponse
        | {
          error?: {
            message?: string;
          };
        }
        | null;

      if (!response.ok || !payload || !("deleted" in payload) || !payload.deleted) {
        setCommentsByPost((current) => ({
          ...current,
          [post.id]: currentComments
        }));
        setPosts((current) =>
          current.map((item) =>
            item.id === post.id
              ? {
                ...item,
                comments: post.comments
              }
              : item
          )
        );
        setThreadMessage(
          payload && "error" in payload
            ? payload.error?.message ?? "We could not delete that comment right now."
            : "We could not delete that comment right now."
        );
        return null;
      }

      setThreadMessage("Comment deleted.");
      return payload;
    } catch {
      setCommentsByPost((current) => ({
        ...current,
        [post.id]: currentComments
      }));
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
              ...item,
              comments: post.comments
            }
            : item
        )
      );
      setThreadMessage("We could not delete that comment right now.");
      return null;
    } finally {
      setThreadDeletingCommentId(null);
    }
  }

  async function editComment(commentId: string, body: string) {
    const post = selectedPost;
    const trimmedBody = body.trim();
    if (!post || trimmedBody.length < 2) {
      setThreadMessage("Comment must be at least 2 characters long.");
      return null;
    }

    const currentComments = commentsByPost[post.id] ?? [];
    const targetComment = currentComments.find((item) => item.id === commentId) ?? null;
    if (!targetComment) {
      return null;
    }

    const optimisticComment: CommentItem = {
      ...targetComment,
      body: trimmedBody,
      updatedAt: new Date().toISOString()
    };

    setThreadMessage(null);
    setCommentsByPost((current) => ({
      ...current,
      [post.id]: (current[post.id] ?? []).map((item) => (item.id === commentId ? optimisticComment : item))
    }));

    try {
      const response = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          body: trimmedBody
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | UpdateCommentResponse
        | {
          error?: {
            message?: string;
          };
        }
        | null;

      if (!response.ok || !payload || !("item" in payload) || !payload.item) {
        setCommentsByPost((current) => ({
          ...current,
          [post.id]: currentComments
        }));
        setThreadMessage(
          payload && "error" in payload
            ? payload.error?.message ?? "We could not edit that comment right now."
            : "We could not edit that comment right now."
        );
        return null;
      }

      setCommentsByPost((current) => ({
        ...current,
        [post.id]: (current[post.id] ?? []).map((item) =>
          item.id === commentId
            ? {
              ...payload.item!,
              viewerCanManage: item.viewerCanManage,
              viewerHasLiked: item.viewerHasLiked
            }
            : item
        )
      }));
      return payload;
    } catch {
      setCommentsByPost((current) => ({
        ...current,
        [post.id]: currentComments
      }));
      setThreadMessage("We could not edit that comment right now.");
      return null;
    }
  }

  function clearReplyTarget() {
    setThreadReplyTarget(null);
  }

  return {
    posts,
    setPosts,
    prependPost,
    appendPosts,
    replacePost,
    removePost,
    selectedPost,
    selectedComments: selectedPost ? commentsByPost[selectedPost.id] ?? [] : [],
    commentsByPost,
    threadDraft,
    setThreadDraft,
    threadMediaUrl,
    setThreadMediaUrl,
    threadMediaType,
    setThreadMediaType,
    threadReplyTarget,
    threadIsAnonymous,
    setThreadIsAnonymous,
    threadMessage,
    setThreadMessage,
    loadingPostId,
    threadLoading,
    threadSubmitting,
    threadDeletingCommentId,
    realtimeState,
    loadComments,
    openThread,
    closeThread,
    beginReply,
    clearReplyTarget,
    react,
    reactToComment,
    deleteComment,
    editComment,
    submitComment
  };
}
