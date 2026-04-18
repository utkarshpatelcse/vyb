"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function CreateResourcePanel({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [type, setType] = useState("notes");
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit() {
    if (!enabled) {
      setMessage("Pehle dev session start karo, phir resource create hoga.");
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/resources", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          title,
          description,
          courseId: courseId || null,
          type
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;

      if (!response.ok) {
        setMessage(payload?.error?.message ?? "Resource create nahi ho paya.");
        return;
      }

      setTitle("");
      setDescription("");
      setCourseId("");
      setType("notes");
      setMessage("Resource queue ho gaya. Refresh ke baad vault me dikhega.");
      router.refresh();
    });
  }

  return (
    <div className="cl-form-card">
      <h3>Upload resource metadata</h3>
      <p className="cl-panel-note">
        Data Connect aur file uploads ke pehle hum metadata flow aur moderation states ko web shell se verify kar rahe hain.
      </p>
      <label className="cl-field">
        <span>Type</span>
        <select value={type} onChange={(event) => setType(event.target.value)} disabled={!enabled || isPending}>
          <option value="notes">Notes</option>
          <option value="pyq">PYQ</option>
          <option value="guide">Guide</option>
        </select>
      </label>
      <label className="cl-field">
        <span>Title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="DBMS Quick Revision Notes" disabled={!enabled || isPending} />
      </label>
      <label className="cl-field">
        <span>Course ID</span>
        <input value={courseId} onChange={(event) => setCourseId(event.target.value)} placeholder="course-dbms" disabled={!enabled || isPending} />
      </label>
      <label className="cl-field">
        <span>Description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Concise notes for normalization, transactions, and indexing."
          rows={4}
          disabled={!enabled || isPending}
        />
      </label>
      <div className="cl-form-actions">
        <button type="button" className="cl-button-primary" onClick={handleSubmit} disabled={!enabled || isPending}>
          {isPending ? "Saving..." : "Create resource"}
        </button>
      </div>
      {message ? <p className="cl-form-message">{message}</p> : null}
    </div>
  );
}
