"use client";

import type { CommentItem, FeedCard, ReactionResponse } from "@vyb/contracts";
import { useEffect, useMemo, useState } from "react";

export function useSocialPostEngagement(initialPosts: FeedCard[]) {
  const [posts, setPosts] = useState(initialPosts);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommentItem[]>>({});
  const [threadDraft, setThreadDraft] = useState("");
  const [threadMessage, setThreadMessage] = useState<string | null>(null);
  const [loadingPostId, setLoadingPostId] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadSubmitting, setThreadSubmitting] = useState(false);

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) ?? null,
    [posts, selectedPostId]
  );

  async function openThread(postId: string) {
    setSelectedPostId(postId);
    setThreadMessage(null);

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

  function closeThread() {
    setSelectedPostId(null);
    setThreadDraft("");
    setThreadMessage(null);
  }

  async function react(postId: string) {
    setLoadingPostId(postId);
    setThreadMessage(null);

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/reactions`, {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          reactionType: "like"
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
        setThreadMessage(
          payload && "error" in payload ? payload.error?.message ?? "We could not update that like right now." : "We could not update that like right now."
        );
        return false;
      }

      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                reactions: payload.aggregateCount,
                viewerReactionType: payload.viewerReactionType
              }
            : post
        )
      );
      return true;
    } catch {
      setThreadMessage("We could not update that like right now.");
      return false;
    } finally {
      setLoadingPostId(null);
    }
  }

  async function submitComment() {
    const post = selectedPost;
    const body = threadDraft.trim();

    if (!post) {
      return;
    }

    if (body.length < 2) {
      setThreadMessage("Write at least two characters before commenting.");
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
          body
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
    } catch {
      setThreadMessage("We could not publish this comment right now.");
    } finally {
      setThreadSubmitting(false);
    }
  }

  function prependPost(post: FeedCard) {
    setPosts((current) => [post, ...current]);
  }

  return {
    posts,
    prependPost,
    selectedPost,
    selectedComments: selectedPost ? commentsByPost[selectedPost.id] ?? [] : [],
    threadDraft,
    setThreadDraft,
    threadMessage,
    setThreadMessage,
    loadingPostId,
    threadLoading,
    threadSubmitting,
    openThread,
    closeThread,
    react,
    submitComment
  };
}
