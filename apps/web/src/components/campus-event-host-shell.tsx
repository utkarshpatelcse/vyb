"use client";

import type { CampusEvent } from "@vyb/contracts";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { VybLogoLockup } from "./vyb-logo";

type CampusEventHostShellProps = {
  viewerName: string;
  viewerUsername: string;
  collegeName: string;
  role: string;
  initialEvent?: CampusEvent | null;
};

type EventMediaPreview = {
  id: string;
  kind: "image" | "video";
  previewUrl: string;
  fileName: string;
  file: File | null;
  shouldRevoke: boolean;
  source: "existing" | "upload";
};

const PASS_OPTIONS = [
  { value: "free", label: "Free entry" },
  { value: "rsvp", label: "RSVP needed" },
  { value: "paid", label: "Paid event" }
] as const;

function formatDateTimeLocalValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function getInitialPassLabel(passKind: string, existingLabel?: string) {
  if (existingLabel) {
    return existingLabel;
  }

  if (passKind === "free") {
    return "Free entry";
  }

  if (passKind === "paid") {
    return "Paid entry";
  }

  return "RSVP needed";
}

function buildExistingMedia(event?: CampusEvent | null): EventMediaPreview[] {
  if (!event) {
    return [];
  }

  return event.media.map((asset) => ({
    id: asset.id,
    kind: asset.kind,
    previewUrl: asset.url,
    fileName: asset.fileName,
    file: null,
    shouldRevoke: false,
    source: "existing"
  }));
}

function renderPreview(item: EventMediaPreview, className: string) {
  if (item.kind === "video") {
    return <video src={item.previewUrl} className={className} muted playsInline preload="metadata" />;
  }

  return <img src={item.previewUrl} alt={item.fileName} className={className} />;
}

export function CampusEventHostShell({
  viewerName,
  viewerUsername,
  collegeName,
  role,
  initialEvent
}: CampusEventHostShellProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialEvent?.title ?? "");
  const [club, setClub] = useState(initialEvent?.club ?? viewerName);
  const [category, setCategory] = useState(initialEvent?.category ?? "");
  const [description, setDescription] = useState(initialEvent?.description ?? "");
  const [location, setLocation] = useState(initialEvent?.location ?? "");
  const [startsAt, setStartsAt] = useState(formatDateTimeLocalValue(initialEvent?.startsAt));
  const [endsAt, setEndsAt] = useState(formatDateTimeLocalValue(initialEvent?.endsAt ?? null));
  const [passKind, setPassKind] = useState<"free" | "rsvp" | "paid">(initialEvent?.passKind ?? "free");
  const [passLabel, setPassLabel] = useState(getInitialPassLabel(initialEvent?.passKind ?? "free", initialEvent?.passLabel));
  const [capacity, setCapacity] = useState(initialEvent?.capacity ? String(initialEvent.capacity) : "");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [media, setMedia] = useState<EventMediaPreview[]>(() => buildExistingMedia(initialEvent));
  const mediaRef = useRef<EventMediaPreview[]>(buildExistingMedia(initialEvent));
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      for (const item of mediaRef.current) {
        if (item.shouldRevoke) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
    };
  }, []);

  function updateMedia(nextMedia: EventMediaPreview[]) {
    mediaRef.current = nextMedia;
    setMedia(nextMedia);
  }

  function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    const nextItems = files.slice(0, Math.max(0, 4 - media.length)).map((file) => {
      const previewUrl = URL.createObjectURL(file);
      return {
        id: `upload-${crypto.randomUUID()}`,
        kind: file.type.startsWith("video/") ? ("video" as const) : ("image" as const),
        previewUrl,
        fileName: file.name,
        file,
        shouldRevoke: true,
        source: "upload" as const
      };
    });

    updateMedia([...media, ...nextItems]);
    event.target.value = "";
  }

  function removeMedia(id: string) {
    const nextMedia = media.filter((item) => item.id !== id);
    const removed = media.find((item) => item.id === id);

    if (removed?.shouldRevoke) {
      URL.revokeObjectURL(removed.previewUrl);
    }

    updateMedia(nextMedia);
  }

  const primaryMedia = media[0] ?? null;
  const isEditMode = Boolean(initialEvent);

  const dynamicCategoryHint = useMemo(() => {
    if (!category.trim()) {
      return "The moment this event is published, its category becomes available in the live filter bar.";
    }

    return `"${category}" will show up automatically in the filter rail if it is available in the live event set.`;
  }, [category]);

  async function handleSubmit() {
    setIsSubmitting(true);
    setMessage(null);

    const formData = new FormData();
    formData.set("title", title.trim());
    formData.set("club", club.trim());
    formData.set("category", category.trim());
    formData.set("description", description.trim());
    formData.set("location", location.trim());
    formData.set("startsAt", startsAt);
    formData.set("endsAt", endsAt);
    formData.set("passKind", passKind);
    formData.set("passLabel", passLabel.trim());
    formData.set("capacity", capacity.trim());

    if (isEditMode && initialEvent) {
      formData.set("eventId", initialEvent.id);
    }

    for (const item of media) {
      if (item.source === "existing") {
        formData.append("keepMediaIds", item.id);
      } else if (item.file) {
        formData.append("media", item.file);
      }
    }

    try {
      const response = await fetch(isEditMode && initialEvent ? `/api/events/${initialEvent.id}` : "/api/events", {
        method: isEditMode ? "PATCH" : "POST",
        body: formData
      });

      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message || "We could not save the event.");
      }

      router.push("/events");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not save the event.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="vyb-campus-home">
      <section className="vyb-event-host-shell">
        <header className="vyb-event-host-topbar">
          <Link href="/events" className="vyb-event-host-backlink">
            Back to events
          </Link>
          <VybLogoLockup />
        </header>

        <div className="vyb-event-host-grid">
          <section className="vyb-event-host-form-card">
            <div className="vyb-event-host-copy">
              <span className="vyb-events-kicker">Campus calendar</span>
              <h1>{isEditMode ? "Edit hosted event" : "Host a campus event"}</h1>
              <p>Publish live events with poster media, timing, venue, pass type, and real discovery filters.</p>
            </div>

            {message ? <div className="vyb-campus-flash-message">{message}</div> : null}

            <div className="vyb-event-host-form-grid">
              <label className="vyb-event-host-field">
                <span>Event title</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Neon Night Showcase" />
              </label>

              <label className="vyb-event-host-field">
                <span>Club / host name</span>
                <input value={club} onChange={(event) => setClub(event.target.value)} placeholder="Cultural Council" />
              </label>

              <label className="vyb-event-host-field">
                <span>Category</span>
                <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Cultural / Tech / Workshop / Sports" />
              </label>

              <label className="vyb-event-host-field">
                <span>Location</span>
                <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Central lawn" />
              </label>

              <label className="vyb-event-host-field">
                <span>Starts at</span>
                <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
              </label>

              <label className="vyb-event-host-field">
                <span>Ends at</span>
                <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
              </label>

              <label className="vyb-event-host-field">
                <span>Access type</span>
                <select
                  value={passKind}
                  onChange={(event) => {
                    const nextPassKind = event.target.value as "free" | "rsvp" | "paid";
                    setPassKind(nextPassKind);
                    setPassLabel(getInitialPassLabel(nextPassKind));
                  }}
                >
                  {PASS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="vyb-event-host-field">
                <span>Pass label</span>
                <input value={passLabel} onChange={(event) => setPassLabel(event.target.value)} placeholder="Free entry / RSVP needed / Paid entry" />
              </label>

              <label className="vyb-event-host-field vyb-event-host-field-wide">
                <span>Description</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} placeholder="Tell people what happens at the event, what they should expect, and why they should show up." />
              </label>

              <label className="vyb-event-host-field">
                <span>Capacity (optional)</span>
                <input value={capacity} onChange={(event) => setCapacity(event.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="250" />
              </label>

              <div className="vyb-event-host-field vyb-event-host-field-wide">
                <div className="vyb-event-host-upload-head">
                  <div>
                    <span>Poster / media</span>
                    <p>Upload up to 4 files. Existing media can be removed or kept while editing.</p>
                  </div>
                  <button type="button" className="vyb-events-secondary-button" onClick={() => fileInputRef.current?.click()}>
                    Add media
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple hidden onChange={handleFilesSelected} />
                </div>

                {media.length === 0 ? (
                  <div className="vyb-event-host-upload-empty">Add at least one poster so the event feed feels complete.</div>
                ) : (
                  <div className="vyb-event-host-media-grid">
                    {media.map((item) => (
                      <div key={item.id} className="vyb-event-host-media-item">
                        <div className="vyb-event-host-media-preview">{renderPreview(item, "vyb-event-host-media-asset")}</div>
                        <div className="vyb-event-host-media-copy">
                          <strong>{item.fileName}</strong>
                          <span>{item.source === "existing" ? "Existing media" : "New upload"}</span>
                        </div>
                        <button type="button" className="vyb-event-host-media-remove" onClick={() => removeMedia(item.id)} aria-label={`Remove ${item.fileName}`}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="vyb-event-host-footer">
              <p>{dynamicCategoryHint}</p>
              <button type="button" className="vyb-events-host-button" disabled={isSubmitting} onClick={handleSubmit}>
                <span>{isSubmitting ? "Saving..." : isEditMode ? "Update event" : "Publish event"}</span>
              </button>
            </div>
          </section>

          <aside className="vyb-event-host-preview-card">
            <span className="vyb-campus-side-label">Live preview</span>
            <div className="vyb-event-host-preview-media">
              {primaryMedia ? renderPreview(primaryMedia, "vyb-event-host-preview-image") : <div className="vyb-event-host-preview-empty">Poster preview</div>}
            </div>
            <div className="vyb-event-host-preview-copy">
              <div className="vyb-events-feed-badges">
                <span className="vyb-events-club-tag">{club.trim() || "Your club"}</span>
                <span className="vyb-events-pass-badge">{passLabel.trim() || getInitialPassLabel(passKind)}</span>
              </div>
              <h2>{title.trim() || "Your event title"}</h2>
              <p>{description.trim() || "A sharp event description will help people instantly understand the vibe and show up."}</p>
              <div className="vyb-events-meta-list">
                <span>{location.trim() || collegeName}</span>
                <span>{startsAt ? startsAt.replace("T", " · ") : "Choose a time"}</span>
              </div>
            </div>

            <div className="vyb-campus-side-card">
              <span className="vyb-campus-side-label">Host identity</span>
              <div className="vyb-events-side-user">
                <img src={`https://i.pravatar.cc/120?u=${encodeURIComponent(viewerUsername)}`} alt={viewerName} />
                <div>
                  <strong>{viewerName}</strong>
                  <span>{role} • @{viewerUsername}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
