"use client";

import type { CampusEvent, CampusEventFormField, CampusEventFormFieldType, CampusEventResponseMode } from "@vyb/contracts";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { buildDefaultAvatarUrl, useResolvedAvatarUrl } from "./campus-avatar";
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

const PRESET_EVENT_CATEGORIES = ["Cultural", "Tech", "Workshop", "Sports", "Film", "Food", "Networking", "Career", "Music"] as const;

const PASS_OPTIONS = [
  { value: "free", label: "Free entry" },
  { value: "rsvp", label: "RSVP needed" },
  { value: "paid", label: "Paid event" }
] as const;

const RESPONSE_MODE_OPTIONS = [
  { value: "interest", label: "Interest only", description: "People can simply mark interest." },
  { value: "register", label: "Registration", description: "People confirm a spot with a form." },
  { value: "apply", label: "Application", description: "People apply and the host reviews them." }
] as const;

const ENTRY_MODE_OPTIONS = [
  { value: "individual", label: "Individual entry" },
  { value: "team", label: "Team entry" }
] as const;

const FORM_FIELD_TYPES: Array<{ value: CampusEventFormFieldType; label: string }> = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "select", label: "Select" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" }
];

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

function buildDefaultFormField(): CampusEventFormField {
  return {
    id: crypto.randomUUID(),
    label: "",
    type: "short_text",
    required: true,
    placeholder: "",
    helpText: "",
    options: []
  };
}

function formatInlineDateTime(value: string) {
  if (!value) {
    return "Choose a time";
  }

  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) {
    return "Choose a time";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(timestamp);
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
  const initialCategoryChoice = initialEvent?.category && PRESET_EVENT_CATEGORIES.includes(initialEvent.category as (typeof PRESET_EVENT_CATEGORIES)[number]) ? initialEvent.category : "Other";
  const [title, setTitle] = useState(initialEvent?.title ?? "");
  const [club, setClub] = useState(initialEvent?.club ?? viewerName);
  const [category, setCategory] = useState(initialEvent?.category ?? "");
  const [categoryChoice, setCategoryChoice] = useState<string>(initialCategoryChoice);
  const [description, setDescription] = useState(initialEvent?.description ?? "");
  const [location, setLocation] = useState(initialEvent?.location ?? "");
  const [startsAt, setStartsAt] = useState(formatDateTimeLocalValue(initialEvent?.startsAt));
  const [endsAt, setEndsAt] = useState(formatDateTimeLocalValue(initialEvent?.endsAt ?? null));
  const [passKind, setPassKind] = useState<"free" | "rsvp" | "paid">(initialEvent?.passKind ?? "free");
  const [passLabel, setPassLabel] = useState(getInitialPassLabel(initialEvent?.passKind ?? "free", initialEvent?.passLabel));
  const [capacity, setCapacity] = useState(initialEvent?.capacity ? String(initialEvent.capacity) : "");
  const [responseMode, setResponseMode] = useState<CampusEventResponseMode>(initialEvent?.responseMode ?? "interest");
  const [registrationClosesAt, setRegistrationClosesAt] = useState(formatDateTimeLocalValue(initialEvent?.registrationConfig.closesAt ?? null));
  const [entryMode, setEntryMode] = useState<"individual" | "team">(initialEvent?.registrationConfig.entryMode ?? "individual");
  const [teamSizeMin, setTeamSizeMin] = useState(initialEvent?.registrationConfig.teamSizeMin ? String(initialEvent.registrationConfig.teamSizeMin) : "2");
  const [teamSizeMax, setTeamSizeMax] = useState(initialEvent?.registrationConfig.teamSizeMax ? String(initialEvent.registrationConfig.teamSizeMax) : "4");
  const [allowAttachments, setAllowAttachments] = useState(initialEvent?.registrationConfig.allowAttachments ?? false);
  const [attachmentLabel, setAttachmentLabel] = useState(initialEvent?.registrationConfig.attachmentLabel ?? "proof image");
  const [formFields, setFormFields] = useState<CampusEventFormField[]>(
    initialEvent?.registrationConfig.formFields.length ? initialEvent.registrationConfig.formFields : responseMode === "interest" ? [] : [buildDefaultFormField()]
  );
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [media, setMedia] = useState<EventMediaPreview[]>(() => buildExistingMedia(initialEvent));
  const mediaRef = useRef<EventMediaPreview[]>(buildExistingMedia(initialEvent));
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const viewerAvatarUrl = useResolvedAvatarUrl({
    username: viewerUsername
  });

  useEffect(() => {
    return () => {
      for (const item of mediaRef.current) {
        if (item.shouldRevoke) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (responseMode === "interest") {
      setEntryMode("individual");
      setAllowAttachments(false);
      if (formFields.length > 0) {
        setFormFields([]);
      }
      return;
    }

    if (formFields.length === 0) {
      setFormFields([buildDefaultFormField()]);
    }
  }, [formFields.length, responseMode]);

  function updateMedia(nextMedia: EventMediaPreview[]) {
    mediaRef.current = nextMedia;
    setMedia(nextMedia);
  }

  function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    const nextItems = files.slice(0, Math.max(0, 6 - media.length)).map((file) => {
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

  function updateField(fieldId: string, patch: Partial<CampusEventFormField>) {
    setFormFields((current) => current.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)));
  }

  function addFieldOption(fieldId: string) {
    const nextValue = optionDrafts[fieldId]?.trim() ?? "";
    if (!nextValue) {
      return;
    }

    const targetField = formFields.find((field) => field.id === fieldId);
    updateField(fieldId, { options: [...new Set([...(targetField?.options ?? []), nextValue])] });
    setOptionDrafts((current) => ({ ...current, [fieldId]: "" }));
  }

  function removeFieldOption(fieldId: string, optionValue: string) {
    const targetField = formFields.find((field) => field.id === fieldId);
    if (!targetField) {
      return;
    }

    updateField(fieldId, { options: (targetField.options ?? []).filter((option) => option !== optionValue) });
  }

  const primaryMedia = media[0] ?? null;
  const isEditMode = Boolean(initialEvent);

  const dynamicCategoryHint = useMemo(() => {
    if (!category.trim()) {
      return "The moment this event is published, its category becomes available in the live filter bar.";
    }

    return `"${category}" will show up automatically in the filter rail if it is available in the live event set.`;
  }, [category]);

  const responseCopy = useMemo(() => {
    if (responseMode === "apply") {
      return "Students submit a form, and the host approves, waitlists, or rejects them.";
    }

    if (responseMode === "register") {
      return "Students fill the form and immediately secure a spot if capacity is available.";
    }

    return "Students only signal interest. No registration form is required.";
  }, [responseMode]);

  const validationMessage = useMemo(() => {
    if (!title.trim()) {
      return "Add an event title.";
    }

    if (!club.trim()) {
      return "Add the club or host name.";
    }

    if (!category.trim()) {
      return "Add an event category.";
    }

    if (!location.trim()) {
      return "Add an event location.";
    }

    if (!description.trim()) {
      return "Add an event description.";
    }

    if (!startsAt) {
      return "Choose an event start time.";
    }

    const startTime = new Date(startsAt).getTime();
    if (!Number.isFinite(startTime)) {
      return "Choose a valid start date and time.";
    }
    if (!isEditMode && startTime <= Date.now()) {
      return "Choose a future start date and time.";
    }

    if (endsAt) {
      const endTime = new Date(endsAt).getTime();
      if (!Number.isFinite(endTime)) {
        return "Choose a valid end date and time.";
      }
      if (endTime <= startTime) {
        return "End time must be after the start time.";
      }
    }

    if (responseMode !== "interest") {
      if (registrationClosesAt) {
        const closeTime = new Date(registrationClosesAt).getTime();
        if (!Number.isFinite(closeTime)) {
          return "Choose a valid registration close time.";
        }
        if (closeTime > startTime) {
          return "Registration should close on or before the event start time.";
        }
      }

      if (entryMode === "team") {
        const minSize = Number(teamSizeMin || "0");
        const maxSize = Number(teamSizeMax || "0");
        if (!Number.isFinite(minSize) || minSize < 2) {
          return "Team events need a minimum team size of at least 2.";
        }
        if (!Number.isFinite(maxSize) || maxSize < minSize) {
          return "Max team size must be greater than or equal to the minimum.";
        }
      }

      if (allowAttachments && !attachmentLabel.trim()) {
        return "Add a short attachment label so students know what to upload.";
      }

      if (formFields.length === 0) {
        return "Add at least one registration question.";
      }

      for (const field of formFields) {
        if (!field.label.trim()) {
          return "Each registration question needs a label.";
        }

        if (field.type === "select" && (field.options ?? []).length < 2) {
          return `Add at least 2 options for \"${field.label || "your select question"}\".`;
        }
      }
    }

    if (media.length === 0) {
      return "Add at least one poster or media file.";
    }

    return null;
  }, [
    allowAttachments,
    attachmentLabel,
    category,
    club,
    description,
    endsAt,
    entryMode,
    formFields,
    location,
    media.length,
    registrationClosesAt,
    responseMode,
    startsAt,
    teamSizeMax,
    teamSizeMin,
    title
  ]);

  async function handleSubmit() {
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

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
    formData.set("responseMode", responseMode);
    formData.set("registrationClosesAt", registrationClosesAt);
    formData.set("entryMode", responseMode === "interest" ? "individual" : entryMode);
    formData.set("teamSizeMin", responseMode === "interest" || entryMode !== "team" ? "" : teamSizeMin.trim());
    formData.set("teamSizeMax", responseMode === "interest" || entryMode !== "team" ? "" : teamSizeMax.trim());
    formData.set("allowAttachments", responseMode === "interest" ? "false" : String(allowAttachments));
    formData.set("attachmentLabel", responseMode === "interest" || !allowAttachments ? "" : attachmentLabel.trim());
    formData.set(
      "formFields",
      JSON.stringify(
        responseMode === "interest"
          ? []
          : formFields.map((field) => ({
              ...field,
              label: field.label.trim(),
              placeholder: field.placeholder?.trim() || null,
              helpText: field.helpText?.trim() || null,
              options: field.type === "select" ? (field.options ?? []).map((option) => option.trim()).filter(Boolean) : []
            }))
      )
    );

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

      router.push("/hub");
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
          <Link href="/hub" className="vyb-event-host-backlink">
            Back to hub
          </Link>
          <VybLogoLockup />
        </header>

        <div className="vyb-event-host-grid">
          <section className="vyb-event-host-form-card">
            <div className="vyb-event-host-copy">
              <span className="vyb-events-kicker">Campus calendar</span>
              <h1>{isEditMode ? "Edit hosted event" : "Host a campus event"}</h1>
              <p>Configure the live event, choose how students respond, and set up the exact registration flow you need.</p>
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
                <select
                  value={categoryChoice}
                  onChange={(event) => {
                    const nextChoice = event.target.value;
                    setCategoryChoice(nextChoice);
                    if (nextChoice !== "Other") {
                      setCategory(nextChoice);
                    } else if (PRESET_EVENT_CATEGORIES.includes(category as (typeof PRESET_EVENT_CATEGORIES)[number])) {
                      setCategory("");
                    }
                  }}
                >
                  {PRESET_EVENT_CATEGORIES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value="Other">Other</option>
                </select>
              </label>

              {categoryChoice === "Other" ? (
                <label className="vyb-event-host-field">
                  <span>Custom category</span>
                  <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Gaming / Open mic / Design" />
                </label>
              ) : null}

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

              <div className="vyb-event-host-field vyb-event-host-field-wide vyb-event-host-mode-card">
                <div className="vyb-event-host-section-head">
                  <div>
                    <span>Response flow</span>
                    <p>{responseCopy}</p>
                  </div>
                </div>

                <div className="vyb-event-host-mode-grid">
                  {RESPONSE_MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`vyb-event-host-mode-option${responseMode === option.value ? " is-active" : ""}`}
                      onClick={() => setResponseMode(option.value)}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </button>
                  ))}
                </div>

                {responseMode !== "interest" ? (
                  <div className="vyb-event-host-inline-grid">
                    <label className="vyb-event-host-field">
                      <span>Registration closes at</span>
                      <input type="datetime-local" value={registrationClosesAt} onChange={(event) => setRegistrationClosesAt(event.target.value)} />
                    </label>

                    <label className="vyb-event-host-field">
                      <span>Entry format</span>
                      <select value={entryMode} onChange={(event) => setEntryMode(event.target.value as "individual" | "team")}>
                        {ENTRY_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {entryMode === "team" ? (
                      <>
                        <label className="vyb-event-host-field">
                          <span>Min team size</span>
                          <input value={teamSizeMin} onChange={(event) => setTeamSizeMin(event.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="2" />
                        </label>

                        <label className="vyb-event-host-field">
                          <span>Max team size</span>
                          <input value={teamSizeMax} onChange={(event) => setTeamSizeMax(event.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="4" />
                        </label>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {responseMode !== "interest" ? (
                  <div className="vyb-event-host-inline-grid">
                    <label className="vyb-event-host-checkbox">
                      <input type="checkbox" checked={allowAttachments} onChange={(event) => setAllowAttachments(event.target.checked)} />
                      <span>Ask attendees to upload supporting images</span>
                    </label>

                    {allowAttachments ? (
                      <label className="vyb-event-host-field">
                        <span>Attachment label</span>
                        <input value={attachmentLabel} onChange={(event) => setAttachmentLabel(event.target.value)} placeholder="ID card / project screenshot / proof image" />
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {responseMode !== "interest" ? (
                <div className="vyb-event-host-field vyb-event-host-field-wide">
                  <div className="vyb-event-host-section-head">
                    <div>
                      <span>Registration form</span>
                      <p>Add the exact questions students should answer before they register or apply.</p>
                    </div>
                    <button
                      type="button"
                      className="vyb-events-secondary-button vyb-event-host-utility-button"
                      onClick={() => setFormFields((current) => [...current, buildDefaultFormField()])}
                    >
                      Add question
                    </button>
                  </div>

                  <div className="vyb-event-host-question-list">
                    {formFields.map((field) => (
                      <div key={field.id} className="vyb-event-host-question-card">
                        <div className="vyb-event-host-question-grid">
                          <input value={field.label} onChange={(event) => updateField(field.id, { label: event.target.value })} placeholder="Question label" />
                          <select value={field.type} onChange={(event) => updateField(field.id, { type: event.target.value as CampusEventFormFieldType })}>
                            {FORM_FIELD_TYPES.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input value={field.placeholder ?? ""} onChange={(event) => updateField(field.id, { placeholder: event.target.value })} placeholder="Placeholder (optional)" />
                          <input value={field.helpText ?? ""} onChange={(event) => updateField(field.id, { helpText: event.target.value })} placeholder="Help text (optional)" />
                        </div>

                        {field.type === "select" ? (
                          <div className="vyb-event-host-option-builder">
                            <div className="vyb-event-host-option-list">
                              {(field.options ?? []).map((option) => (
                                <span key={`${field.id}:${option}`} className="vyb-event-host-option-chip">
                                  {option}
                                  <button type="button" onClick={() => removeFieldOption(field.id, option)} aria-label={`Remove ${option}`}>
                                    x
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="vyb-event-host-option-input">
                              <input
                                value={optionDrafts[field.id] ?? ""}
                                onChange={(event) => setOptionDrafts((current) => ({ ...current, [field.id]: event.target.value }))}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    addFieldOption(field.id);
                                  }
                                }}
                                placeholder="Type one option"
                              />
                              <button type="button" className="vyb-events-secondary-button vyb-event-host-utility-button" onClick={() => addFieldOption(field.id)}>
                                Add option
                              </button>
                            </div>
                          </div>
                        ) : null}

                        <div className="vyb-event-host-question-actions">
                          <label className="vyb-event-host-checkbox">
                            <input type="checkbox" checked={field.required} onChange={(event) => updateField(field.id, { required: event.target.checked })} />
                            <span>Required</span>
                          </label>
                          <button
                            type="button"
                            className="vyb-event-host-media-remove vyb-event-host-question-remove"
                            onClick={() => setFormFields((current) => current.filter((candidate) => candidate.id !== field.id))}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="vyb-event-host-field vyb-event-host-field-wide">
                <div className="vyb-event-host-upload-head">
                  <div>
                    <span>Poster / media</span>
                    <p>Upload up to 6 files. Existing media can be removed or kept while editing.</p>
                  </div>
                  <button type="button" className="vyb-events-secondary-button vyb-event-host-utility-button" onClick={() => fileInputRef.current?.click()}>
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
              <p>{message ?? validationMessage ?? dynamicCategoryHint}</p>
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
                <span className="vyb-events-response-badge">
                  {responseMode === "apply" ? "Application" : responseMode === "register" ? "Registration" : "Interest"}
                </span>
              </div>
              <h2>{title.trim() || "Your event title"}</h2>
              <p>{description.trim() || "A sharp event description will help people instantly understand the vibe and show up."}</p>
              <div className="vyb-events-meta-list">
                <span>{location.trim() || collegeName}</span>
                <span>{formatInlineDateTime(startsAt)}</span>
                {responseMode !== "interest" ? <span>{entryMode === "team" ? `Team entry ${teamSizeMin || "2"}-${teamSizeMax || "4"}` : "Individual entry"}</span> : null}
              </div>
            </div>

            <div className="vyb-campus-side-card">
              <span className="vyb-campus-side-label">Registration setup</span>
              <div className="vyb-event-host-preview-stack">
                <div>
                  <strong>Mode</strong>
                  <span>{responseMode === "apply" ? "Host approval required" : responseMode === "register" ? "Instant confirmation" : "Simple interest"}</span>
                </div>
                <div>
                  <strong>Questions</strong>
                  <span>{responseMode === "interest" ? "None" : `${formFields.length} field${formFields.length === 1 ? "" : "s"}`}</span>
                </div>
                <div>
                  <strong>Attachments</strong>
                  <span>{responseMode === "interest" || !allowAttachments ? "Not requested" : attachmentLabel.trim() || "Supporting image"}</span>
                </div>
                <div>
                  <strong>Close time</strong>
                  <span>{registrationClosesAt ? formatInlineDateTime(registrationClosesAt) : "Open until start"}</span>
                </div>
              </div>
            </div>

            <div className="vyb-campus-side-card">
              <span className="vyb-campus-side-label">Host identity</span>
              <div className="vyb-events-side-user">
                    <img
                      src={viewerAvatarUrl ?? buildDefaultAvatarUrl({ seed: viewerUsername, displayName: viewerName, username: viewerUsername, size: 120 })}
                      alt={viewerName}
                    />
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
