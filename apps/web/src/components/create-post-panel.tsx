"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface CommunityOption {
  id: string;
  name: string;
  type: string;
}

export function CreatePostPanel({
  enabled,
  communities
}: {
  enabled: boolean;
  communities: CommunityOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit() {
    if (!enabled) {
      setMessage("Pehle dev session start karo, phir post create hoga.");
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          title,
          body,
          communityId: communityId || null
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;

      if (!response.ok) {
        setMessage(payload?.error?.message ?? "Post create nahi ho paya.");
        return;
      }

      setTitle("");
      setBody("");
      setCommunityId("");
      setMessage("Post queue ho gaya. Router refresh ke baad latest feed dikh jayega.");
      router.refresh();
    });
  }

  return (
    <div className="cl-form-card">
      <h3>Create a campus post</h3>
      <p className="cl-panel-note">Phase 1 me text posts start kar rahe hain, lekin same flow baad me image/Vibes support karega.</p>
      <label className="cl-field">
        <span>Scope</span>
        <select value={communityId} onChange={(event) => setCommunityId(event.target.value)} disabled={!enabled || isPending}>
          <option value="">Campus-wide</option>
          {communities.map((community) => (
            <option key={community.id} value={community.id}>
              {community.name} · {community.type}
            </option>
          ))}
        </select>
      </label>
      <label className="cl-field">
        <span>Title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Prototype Night" disabled={!enabled || isPending} />
      </label>
      <label className="cl-field">
        <span>Body</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Club demo night is live..."
          rows={4}
          disabled={!enabled || isPending}
        />
      </label>
      <div className="cl-form-actions">
        <button type="button" className="cl-button-primary" onClick={handleSubmit} disabled={!enabled || isPending}>
          {isPending ? "Publishing..." : "Create post"}
        </button>
      </div>
      {message ? <p className="cl-form-message">{message}</p> : null}
    </div>
  );
}
