"use client";

import type { CommentItem, DeleteCommentResponse, FeedCard, ReactionKind, ReactionResponse } from "@vyb/contracts";
import { useEffect, useMemo, useState } from "react";

type CommentMediaKind = "gif" | "sticker";

export function useSocialPostEngagement(initialPosts: FeedCard[]) {
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

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

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

    if (!post) {
      return;
    }

    if (!body && !mediaUrl) {
      setThreadMessage("Write a comment or paste a GIF/sticker link before posting.");
      return;
    }

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
          parentCommentId: threadReplyTarget?.id ?? null,
          mediaUrl: mediaUrl || null,
          mediaType: mediaUrl ? threadMediaType : null,
          mediaMimeType: mediaUrl ? (threadMediaType === "sticker" ? "image/webp" : "image/gif") : null,
          isAnonymous: threadIsAnonymous && post.allowAnonymousComments !== false
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
        setThreadMessage(payload?.error?.message ?? "We could not publish this comment right now.");
        return;
      }

      setCommentsByPost((current) => ({
        ...current,
        [post.id]: [...(current[post.id] ?? []), payload.item!]
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
    } catch {
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
    loadComments,
    openThread,
    closeThread,
    beginReply,
    clearReplyTarget,
    react,
    reactToComment,
    deleteComment,
    submitComment
  };
}
