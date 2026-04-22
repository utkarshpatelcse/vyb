"use client";

import type {
  CampusEvent,
  CampusEventFormField,
  CampusEventMediaAsset,
  CampusEventRegistration,
  CampusEventRegistrationAnswer,
  CampusEventRegistrationStatus,
  CampusEventScope,
  CampusEventsDashboardResponse,
  CampusEventTeamMember,
  CampusEventViewerRegistrationResponse,
  ManageCampusEventRegistrationResponse,
  UpsertCampusEventRegistrationResponse
} from "@vyb/contracts";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { SignOutButton } from "./sign-out-button";
import { VybLogoLockup } from "./vyb-logo";

type CampusEventsShellProps = {
  viewerName: string;
  viewerUsername: string;
  collegeName: string;
  viewerEmail: string;
  course?: string | null;
  stream?: string | null;
  role: string;
  initialDashboard?: CampusEventsDashboardResponse | null;
};

type ResizeSide = "left" | "right";

type RegistrationDraftMember = {
  id: string;
  name: string;
  email: string;
  username: string;
  phone: string;
  role: string;
};

type RegistrationDraft = {
  teamName: string;
  note: string;
  teamMembers: RegistrationDraftMember[];
  answers: Record<string, string>;
  attachments: Array<
    CampusEventMediaAsset & {
      file: File | null;
      shouldRevoke: boolean;
      source: "existing" | "upload";
    }
  >;
};

const DEFAULT_LEFT_WIDTH = 260;
const DEFAULT_RIGHT_WIDTH = 320;
const MIN_LEFT_WIDTH = 220;
const MAX_LEFT_WIDTH = 360;
const MIN_RIGHT_WIDTH = 280;
const MAX_RIGHT_WIDTH = 420;
const LEFT_WIDTH_STORAGE_KEY = "vyb-campus-left-width";
const RIGHT_WIDTH_STORAGE_KEY = "vyb-campus-right-width";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildEmptyDashboard(viewerUsername: string): CampusEventsDashboardResponse {
  return {
    tenantId: "tenant-demo",
    viewer: {
      userId: "viewer",
      username: viewerUsername,
      savedCount: 0,
      interestedCount: 0,
      hostedCount: 0,
      hostedPendingCount: 0,
      hostedRegistrationCount: 0
    },
    events: [],
    hostedEvents: [],
    categories: []
  };
}

function buildEmptyDraft(fields: CampusEventFormField[]): RegistrationDraft {
  return {
    teamName: "",
    note: "",
    teamMembers: [],
    answers: Object.fromEntries(fields.map((field) => [field.id, ""])),
    attachments: []
  };
}

function buildDraftFromRegistration(fields: CampusEventFormField[], registration: CampusEventRegistration | null): RegistrationDraft {
  if (!registration) {
    return buildEmptyDraft(fields);
  }

  return {
    teamName: registration.teamName ?? "",
    note: registration.note ?? "",
    teamMembers: registration.teamMembers.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email ?? "",
      username: member.username ?? "",
      phone: member.phone ?? "",
      role: member.role ?? ""
    })),
    answers: Object.fromEntries(fields.map((field) => [field.id, registration.answers.find((answer) => answer.fieldId === field.id)?.value ?? ""])),
    attachments: registration.attachments.map((attachment) => ({
      ...attachment,
      file: null,
      shouldRevoke: false,
      source: "existing"
    }))
  };
}

function formatEventDayLabel(value: string) {
  const timestamp = new Date(value);

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short"
  }).format(timestamp);
}

function formatEventTimeRange(event: CampusEvent) {
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  const startLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(start);

  if (!end) {
    return startLabel;
  }

  const sameDay = start.toDateString() === end.toDateString();
  const endLabel = new Intl.DateTimeFormat("en-IN", {
    ...(sameDay ? {} : { weekday: "short" }),
    hour: "numeric",
    minute: "2-digit"
  }).format(end);

  return `${startLabel} - ${endLabel}`;
}

function formatInterestLabel(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K responses`;
  }

  if (value <= 0) {
    return "Be the first to respond";
  }

  return `${value} responses`;
}

function formatResponseMode(mode: CampusEvent["responseMode"]) {
  if (mode === "apply") {
    return "Application";
  }

  if (mode === "register") {
    return "Registration";
  }

  return "Interest";
}

function formatRegistrationStatus(status: CampusEventRegistration["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatPrimaryActionLabel(event: CampusEvent) {
  if (event.status === "ended") {
    return "Ended";
  }

  if (event.responseMode === "interest") {
    return event.isInterested ? "Going" : "Interested";
  }

  if (event.viewerRegistration) {
    if (event.viewerRegistration.status === "approved") {
      return event.responseMode === "apply" ? "Review application" : "Edit registration";
    }
    if (event.viewerRegistration.status === "waitlisted") {
      return event.responseMode === "apply" ? "Edit application" : "Edit registration";
    }
    if (event.viewerRegistration.status === "rejected") {
      return "Re-apply";
    }
    return event.responseMode === "apply" ? "Edit application" : "Edit registration";
  }

  return event.responseMode === "apply" ? "Apply now" : "Register";
}

function isWithinNextWeek(event: CampusEvent) {
  const now = Date.now();
  const startsAt = new Date(event.startsAt).getTime();
  return startsAt >= now && startsAt <= now + 7 * 24 * 60 * 60_000;
}

function getPrimaryMedia(event: CampusEvent) {
  return event.media[0] ?? null;
}

function getScopeFilteredEvents(events: CampusEvent[], activeScope: CampusEventScope) {
  return events.filter((event) => {
    if (activeScope === "saved" && !event.isSaved) {
      return false;
    }

    if (activeScope === "week" && !isWithinNextWeek(event)) {
      return false;
    }

    if (activeScope === "ended") {
      return event.status === "ended";
    }

    return event.status === "published";
  });
}

function createDraftMember(): RegistrationDraftMember {
  return {
    id: crypto.randomUUID(),
    name: "",
    email: "",
    username: "",
    phone: "",
    role: ""
  };
}

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="vyb-campus-icon">
      {children}
    </svg>
  );
}

function HomeIcon() {
  return (
    <IconBase>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 22V12h6v10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function EventsIcon() {
  return (
    <IconBase>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function VibesIcon() {
  return (
    <IconBase>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function MarketIcon() {
  return (
    <IconBase>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 6h18M16 10a4 4 0 0 1-8 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function ProfileIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function SearchIcon() {
  return (
    <IconBase>
      <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m21 21-4.3-4.3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </IconBase>
  );
}

function BellIcon() {
  return (
    <IconBase>
      <path d="M12 4.5a4 4 0 0 1 4 4V11c0 .9.3 1.8.9 2.5l.7.8c.6.7.1 1.7-.8 1.7H7.2c-.9 0-1.4-1-.8-1.7l.7-.8A3.9 3.9 0 0 0 8 11V8.5a4 4 0 0 1 4-4Zm-1.7 13h3.4a1.7 1.7 0 0 1-3.4 0Z" fill="currentColor" />
    </IconBase>
  );
}

function CalendarIcon() {
  return (
    <IconBase>
      <path d="M7 3v3M17 3v3M5 8h14M6 5h12a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function LocationIcon() {
  return (
    <IconBase>
      <path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="11" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </IconBase>
  );
}

function TicketIcon() {
  return (
    <IconBase>
      <path d="M4 9a2.5 2.5 0 1 0 0 5v1.5A1.5 1.5 0 0 0 5.5 17h13a1.5 1.5 0 0 0 1.5-1.5V14a2.5 2.5 0 1 0 0-5V7.5A1.5 1.5 0 0 0 18.5 6h-13A1.5 1.5 0 0 0 4 7.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 6v11M15 6v11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2.4 2.4" />
    </IconBase>
  );
}

function HeartIcon() {
  return (
    <IconBase>
      <path d="M12 20.4s-6.6-4.3-8.6-8A4.8 4.8 0 0 1 11 6.9L12 8l1-1.1a4.8 4.8 0 0 1 7.6 5.5c-2 3.7-8.6 8-8.6 8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function BookmarkIcon() {
  return (
    <IconBase>
      <path d="M7 4.5h10a1 1 0 0 1 1 1v14l-6-3-6 3v-14a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function CommentIcon() {
  return (
    <IconBase>
      <path d="M5.8 17.8a7.7 7.7 0 1 1 3 1.1L4 20l1.8-4.2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function SendIcon() {
  return (
    <IconBase>
      <path d="M21 4 10 15M21 4l-7 17-4-6-6-4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function SparkIcon() {
  return (
    <IconBase>
      <path d="M12 3.5 14 9l5.5 2-5.5 2-2 5.5-2-5.5-5.5-2L10 9l2-5.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function CloseIcon() {
  return (
    <IconBase>
      <path d="M7 7 17 17M17 7 7 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  );
}

function DownloadIcon() {
  return (
    <IconBase>
      <path d="M12 3v11M8 10l4 4 4-4M5 19h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function UsersIcon() {
  return (
    <IconBase>
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8 14v-2a4 4 0 0 0-3-3.87M15 3.1a4 4 0 0 1 0 7.75" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

export function CampusEventsShell({
  viewerName,
  viewerUsername,
  collegeName,
  viewerEmail,
  course,
  stream,
  role,
  initialDashboard
}: CampusEventsShellProps) {
  const [dashboard, setDashboard] = useState(initialDashboard ?? buildEmptyDashboard(viewerUsername));
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [activeResize, setActiveResize] = useState<ResizeSide | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeScope, setActiveScope] = useState<CampusEventScope>("for-you");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [registrationSheetOpen, setRegistrationSheetOpen] = useState(false);
  const [registrationDraft, setRegistrationDraft] = useState<RegistrationDraft>(buildEmptyDraft([]));
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [brokenMediaIds, setBrokenMediaIds] = useState<string[]>([]);
  const [hostRegistrations, setHostRegistrations] = useState<CampusEventRegistration[]>([]);
  const [hostRegistrationsLoading, setHostRegistrationsLoading] = useState(false);
  const [hostRegistrationsError, setHostRegistrationsError] = useState<string | null>(null);
  const [hostRegistrationQuery, setHostRegistrationQuery] = useState("");
  const [hostRegistrationStatuses, setHostRegistrationStatuses] = useState<CampusEventRegistrationStatus[]>([]);
  const registrationFileInputRef = useRef<HTMLInputElement | null>(null);
  const resizeState = useRef<{ side: ResizeSide; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    setDashboard(initialDashboard ?? buildEmptyDashboard(viewerUsername));
  }, [initialDashboard, viewerUsername]);

  useEffect(() => {
    const storedLeftWidth = Number.parseInt(window.localStorage.getItem(LEFT_WIDTH_STORAGE_KEY) ?? "", 10);
    const storedRightWidth = Number.parseInt(window.localStorage.getItem(RIGHT_WIDTH_STORAGE_KEY) ?? "", 10);

    if (Number.isFinite(storedLeftWidth)) {
      setLeftWidth(clamp(storedLeftWidth, MIN_LEFT_WIDTH, MAX_LEFT_WIDTH));
    }

    if (Number.isFinite(storedRightWidth)) {
      setRightWidth(clamp(storedRightWidth, MIN_RIGHT_WIDTH, MAX_RIGHT_WIDTH));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LEFT_WIDTH_STORAGE_KEY, String(leftWidth));
  }, [leftWidth]);

  useEffect(() => {
    window.localStorage.setItem(RIGHT_WIDTH_STORAGE_KEY, String(rightWidth));
  }, [rightWidth]);

  useEffect(() => {
    if (!activeResize) {
      return;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const currentResize = resizeState.current;
      if (!currentResize) {
        return;
      }

      if (currentResize.side === "left") {
        setLeftWidth(clamp(currentResize.startWidth + (event.clientX - currentResize.startX), MIN_LEFT_WIDTH, MAX_LEFT_WIDTH));
        return;
      }

      setRightWidth(clamp(currentResize.startWidth - (event.clientX - currentResize.startX), MIN_RIGHT_WIDTH, MAX_RIGHT_WIDTH));
    }

    function handlePointerUp() {
      resizeState.current = null;
      setActiveResize(null);
    }

    document.body.classList.add("vyb-campus-is-resizing");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.body.classList.remove("vyb-campus-is-resizing");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activeResize]);

  useEffect(() => {
    if (!flashMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => setFlashMessage(null), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [flashMessage]);

  useEffect(() => {
    if (!selectedEventId) {
      return;
    }

    if (!dashboard.events.some((event) => event.id === selectedEventId) && !dashboard.hostedEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [dashboard, selectedEventId]);

  useEffect(() => {
    setHostRegistrationQuery("");
    setHostRegistrationStatuses([]);
  }, [selectedEventId]);

  const selectedEvent =
    dashboard.events.find((event) => event.id === selectedEventId) ??
    dashboard.hostedEvents.find((event) => event.id === selectedEventId) ??
    null;

  useEffect(() => {
    if (!selectedEvent || !selectedEvent.isHostedByViewer) {
      setHostRegistrations([]);
      setHostRegistrationsError(null);
      setHostRegistrationsLoading(false);
      return;
    }

    let cancelled = false;
    setHostRegistrationsLoading(true);
    setHostRegistrationsError(null);
    const searchParams = new URLSearchParams();
    if (hostRegistrationQuery.trim()) {
      searchParams.set("query", hostRegistrationQuery.trim());
    }
    if (hostRegistrationStatuses.length > 0) {
      searchParams.set("status", hostRegistrationStatuses.join(","));
    }
    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";

    fetch(`/api/events/${selectedEvent.id}/registrations${suffix}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { registrations?: CampusEventRegistration[]; error?: { message?: string } } | null;
        if (!response.ok) {
          throw new Error(payload?.error?.message || "We could not load registrations.");
        }
        if (!cancelled) {
          setHostRegistrations(payload?.registrations ?? []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setHostRegistrationsError(error instanceof Error ? error.message : "We could not load registrations.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHostRegistrationsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hostRegistrationQuery, hostRegistrationStatuses, selectedEvent?.id, selectedEvent?.isHostedByViewer]);

  function startResizeDrag(side: ResizeSide, event: PointerEvent<HTMLButtonElement>) {
    if (window.innerWidth < 900) {
      return;
    }

    event.preventDefault();
    resizeState.current = {
      side,
      startX: event.clientX,
      startWidth: side === "left" ? leftWidth : rightWidth
    };
    setActiveResize(side);
  }

  async function handleDashboardAction(
    actionKey: string,
    requestFactory: () => Promise<Response>,
    successMessage: string,
    errorMessage: string
  ) {
    setBusyAction(actionKey);

    try {
      const response = await requestFactory();
      const payload = (await response.json().catch(() => null)) as { dashboard?: CampusEventsDashboardResponse; error?: { message?: string } } | null;

      if (!response.ok || !payload?.dashboard) {
        throw new Error(payload?.error?.message || errorMessage);
      }

      setDashboard(payload.dashboard);
      setFlashMessage(successMessage);
    } catch (error) {
      setFlashMessage(error instanceof Error ? error.message : errorMessage);
    } finally {
      setBusyAction(null);
    }
  }

  async function toggleSaved(eventId: string) {
    await handleDashboardAction(
      `save:${eventId}`,
      () => fetch(`/api/events/${eventId}/save`, { method: "POST" }),
      "Saved events updated.",
      "We could not update your saved events."
    );
  }

  async function toggleInterested(eventId: string) {
    await handleDashboardAction(
      `interest:${eventId}`,
      () => fetch(`/api/events/${eventId}/interest`, { method: "POST" }),
      "Your response was updated.",
      "We could not update your response."
    );
  }

  async function cancelHostedEvent(eventId: string) {
    await handleDashboardAction(
      `cancel:${eventId}`,
      () => fetch(`/api/events/${eventId}/cancel`, { method: "POST" }),
      "Event cancelled.",
      "We could not cancel this event."
    );
  }

  async function deleteHostedEvent(eventId: string) {
    await handleDashboardAction(
      `delete:${eventId}`,
      () => fetch(`/api/events/${eventId}`, { method: "DELETE" }),
      "Event deleted.",
      "We could not delete this event."
    );
  }

  async function openRegistrationSheet(event: CampusEvent) {
    setRegistrationSheetOpen(true);
    setRegistrationLoading(true);
    setRegistrationError(null);
    setRegistrationDraft(buildEmptyDraft(event.registrationConfig.formFields));

    try {
      const response = await fetch(`/api/events/${event.id}/register`);
      const payload = (await response.json().catch(() => null)) as CampusEventViewerRegistrationResponse | { error?: { message?: string } } | null;

      if (!response.ok || !payload || !("event" in payload)) {
        throw new Error(payload && "error" in payload ? payload.error?.message || "We could not load your registration." : "We could not load your registration.");
      }

      setRegistrationDraft(buildDraftFromRegistration(payload.event.registrationConfig.formFields, payload.registration));
    } catch (error) {
      setRegistrationError(error instanceof Error ? error.message : "We could not load your registration.");
    } finally {
      setRegistrationLoading(false);
    }
  }

  function closeRegistrationSheet() {
    for (const attachment of registrationDraft.attachments) {
      if (attachment.shouldRevoke) {
        URL.revokeObjectURL(attachment.url);
      }
    }
    setRegistrationSheetOpen(false);
    setRegistrationError(null);
    setRegistrationLoading(false);
  }

  function addRegistrationAttachments(files: FileList | null) {
    const fileItems = Array.from(files ?? []);
    if (fileItems.length === 0) {
      return;
    }

    setRegistrationDraft((current) => ({
      ...current,
      attachments: [
        ...current.attachments,
        ...fileItems.slice(0, Math.max(0, 3 - current.attachments.length)).map((file) => ({
          id: `upload-${crypto.randomUUID()}`,
          kind: "image" as const,
          url: URL.createObjectURL(file),
          fileName: file.name,
          mimeType: file.type || "image/jpeg",
          sizeBytes: file.size,
          storagePath: null,
          file,
          shouldRevoke: true,
          source: "upload" as const
        }))
      ]
    }));
  }

  function removeRegistrationAttachment(attachmentId: string) {
    setRegistrationDraft((current) => {
      const target = current.attachments.find((attachment) => attachment.id === attachmentId);
      if (target?.shouldRevoke) {
        URL.revokeObjectURL(target.url);
      }

      return {
        ...current,
        attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId)
      };
    });
  }

  async function submitRegistration(event: CampusEvent) {
    if (event.registrationConfig.entryMode === "team" && !registrationDraft.teamName.trim()) {
      setFlashMessage("Add a team name before submitting.");
      return;
    }

    for (const field of event.registrationConfig.formFields) {
      const value = registrationDraft.answers[field.id] ?? "";
      if (field.required && !value.trim()) {
        setFlashMessage(`Complete "${field.label}" before submitting.`);
        return;
      }
    }

    if (event.registrationConfig.allowAttachments && registrationDraft.attachments.length === 0) {
      setFlashMessage(`Upload ${event.registrationConfig.attachmentLabel || "the required image"} before submitting.`);
      return;
    }

    setBusyAction(`register:${event.id}`);

    try {
      const answers: CampusEventRegistrationAnswer[] = event.registrationConfig.formFields.map((field) => ({
        fieldId: field.id,
        label: field.label,
        value: registrationDraft.answers[field.id] ?? ""
      }));
      const teamMembers: CampusEventTeamMember[] = registrationDraft.teamMembers.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email || null,
        username: member.username || null,
        phone: member.phone || null,
        role: member.role || null
      }));

      const formData = new FormData();
      formData.set("eventId", event.id);
      formData.set("teamName", registrationDraft.teamName);
      formData.set("note", registrationDraft.note);
      formData.set("teamMembers", JSON.stringify(teamMembers));
      formData.set("answers", JSON.stringify(answers));

      for (const attachment of registrationDraft.attachments) {
        if (attachment.source === "existing") {
          formData.append("keepAttachmentIds", attachment.id);
        } else if (attachment.file) {
          formData.append("attachments", attachment.file);
        }
      }

      const response = await fetch(`/api/events/${event.id}/register`, {
        method: "POST",
        body: formData
      });
      const payload = (await response.json().catch(() => null)) as UpsertCampusEventRegistrationResponse | { error?: { message?: string } } | null;

      if (!response.ok || !payload || !("dashboard" in payload)) {
        throw new Error(payload && "error" in payload ? payload.error?.message || "We could not submit this registration." : "We could not submit this registration.");
      }

      setDashboard(payload.dashboard);
      setSelectedEventId(payload.event.id);
      setRegistrationSheetOpen(false);
      setFlashMessage(event.responseMode === "apply" ? "Application submitted." : "Registration confirmed.");
    } catch (error) {
      setFlashMessage(error instanceof Error ? error.message : "We could not submit this registration.");
    } finally {
      setBusyAction(null);
    }
  }

  async function reviewRegistration(eventId: string, registrationId: string, status: "approved" | "waitlisted" | "rejected") {
    const reviewNote =
      status === "approved"
        ? ""
        : window.prompt(`Optional note for ${status}:`, "") ?? "";

    setBusyAction(`review:${registrationId}`);

    try {
      const response = await fetch(`/api/events/${eventId}/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status,
          reviewNote
        })
      });
      const payload = (await response.json().catch(() => null)) as ManageCampusEventRegistrationResponse | { error?: { message?: string } } | null;

      if (!response.ok || !payload || !("dashboard" in payload)) {
        throw new Error(payload && "error" in payload ? payload.error?.message || "We could not update this registration." : "We could not update this registration.");
      }

      setDashboard(payload.dashboard);
      setHostRegistrations(payload.registrations);
      setFlashMessage(`Registration ${status}.`);
    } catch (error) {
      setFlashMessage(error instanceof Error ? error.message : "We could not update this registration.");
    } finally {
      setBusyAction(null);
    }
  }

  async function shareEvent(event: CampusEvent) {
    const sharePayload = {
      title: event.title,
      text: `${event.title} by ${event.club} at ${collegeName} • ${formatEventTimeRange(event)}`,
      url: `${window.location.origin}/events`
    };

    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
      } else {
        await navigator.clipboard.writeText(`${sharePayload.text}\n${sharePayload.url}`);
      }

      setFlashMessage("Event link ready to share.");
    } catch {
      setFlashMessage("Share was cancelled.");
    }
  }

  function exportRegistrations(eventId: string) {
    const searchParams = new URLSearchParams();
    if (hostRegistrationQuery.trim()) {
      searchParams.set("query", hostRegistrationQuery.trim());
    }
    if (hostRegistrationStatuses.length > 0) {
      searchParams.set("status", hostRegistrationStatuses.join(","));
    }

    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
    window.open(`/api/events/${eventId}/registrations/export${suffix}`, "_blank", "noopener,noreferrer");
  }

  function toggleHostRegistrationStatus(status: CampusEventRegistrationStatus) {
    setHostRegistrationStatuses((current) => (current.includes(status) ? current.filter((candidate) => candidate !== status) : [...current, status]));
  }

  const navItems = [
    { label: "Home", href: "/home", icon: <HomeIcon /> },
    { label: "Events", href: "/events", icon: <EventsIcon />, active: true },
    { label: "Vibes", href: "/vibes", icon: <VibesIcon /> },
    { label: "Market", href: "/market", icon: <MarketIcon /> },
    { label: "Profile", href: "/dashboard", icon: <ProfileIcon /> }
  ];

  const normalizedQuery = searchValue.trim().toLowerCase();

  const scopedCounts = useMemo(
    () => ({
      "for-you": dashboard.events.filter((event) => event.status === "published").length,
      week: dashboard.events.filter((event) => event.status === "published" && isWithinNextWeek(event)).length,
      saved: dashboard.events.filter((event) => event.isSaved).length,
      ended: dashboard.events.filter((event) => event.status === "ended").length
    }),
    [dashboard.events]
  );

  const scopeFilteredEvents = useMemo(() => getScopeFilteredEvents(dashboard.events, activeScope), [activeScope, dashboard.events]);

  const searchableScopeEvents = useMemo(() => {
    return scopeFilteredEvents.filter((event) => {
      if (!normalizedQuery) {
        return true;
      }

      const haystack = `${event.title} ${event.club} ${event.host.username} ${event.description} ${event.location} ${event.category}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, scopeFilteredEvents]);

  const categories = useMemo(() => ["All", ...new Set(searchableScopeEvents.map((event) => event.category).filter(Boolean))], [searchableScopeEvents]);

  useEffect(() => {
    if (activeCategory !== "All" && !categories.includes(activeCategory)) {
      setActiveCategory("All");
    }
  }, [activeCategory, categories]);

  const filteredEvents = useMemo(() => {
    const nextEvents = searchableScopeEvents.filter((event) => {
      if (activeCategory !== "All" && event.category !== activeCategory) {
        return false;
      }

      return true;
    });

    return nextEvents.sort((left, right) => {
      const leftTime = new Date(left.startsAt).getTime();
      const rightTime = new Date(right.startsAt).getTime();
      return activeScope === "ended" ? rightTime - leftTime : leftTime - rightTime;
    });
  }, [activeCategory, activeScope, searchableScopeEvents]);

  const notificationEvents = useMemo(
    () =>
      dashboard.events
        .filter((event) => event.status === "published" && (event.isSaved || event.isInterested || event.viewerRegistration))
        .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
        .slice(0, 6),
    [dashboard.events]
  );

  const identityLine = [course, stream].filter(Boolean).join(" / ") || collegeName;
  const layoutStyle = {
    "--vyb-campus-left-width": `${leftWidth}px`,
    "--vyb-campus-right-width": `${rightWidth}px`
  } as CSSProperties;

  const scopeOptions: Array<{ id: CampusEventScope; label: string; count: number }> = [
    { id: "for-you", label: "Upcoming", count: scopedCounts["for-you"] },
    { id: "saved", label: "Saved", count: scopedCounts.saved },
    { id: "ended", label: "Ended", count: scopedCounts.ended }
  ];

  return (
    <main className="vyb-campus-home" style={layoutStyle}>
      <aside className="vyb-campus-sidebar vyb-campus-rail">
        <Link href="/home" className="vyb-campus-branding">
          <VybLogoLockup priority />
        </Link>

        <nav className="vyb-campus-nav">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} className={`vyb-campus-nav-item${item.active ? " is-active" : ""}`}>
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="vyb-campus-sidebar-footer">
          <div className="vyb-campus-sidebar-user">
            <strong>{viewerName}</strong>
            <span>{collegeName}</span>
          </div>
          <SignOutButton className="vyb-campus-signout" />
        </div>
      </aside>

      <button
        type="button"
        className={`vyb-campus-resizer vyb-campus-resizer-left${activeResize === "left" ? " is-active" : ""}`}
        aria-label="Resize left sidebar"
        onPointerDown={(event) => startResizeDrag("left", event)}
      />

      <section className="vyb-campus-main vyb-events-main">
        <header className="vyb-events-header">
          <div className="vyb-events-brand-block">
            <span className="vyb-events-kicker">Campus calendar</span>
            <strong>Events</strong>
          </div>

          <label className="vyb-events-search">
            <SearchIcon />
            <input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search clubs, nights, workshops, or venues"
              aria-label="Search campus events"
            />
          </label>

          <button
            type="button"
            className={`vyb-events-icon-button${notificationsOpen ? " is-active" : ""}`}
            aria-label="Open event notifications"
            onClick={() => setNotificationsOpen((current) => !current)}
          >
            <BellIcon />
          </button>
          <Link href="/events/host" className="vyb-events-host-button">
            <TicketIcon />
            <span>Host event</span>
          </Link>
        </header>

        {flashMessage ? <div className="vyb-campus-flash-message">{flashMessage}</div> : null}

        {notificationsOpen ? (
          <section className="vyb-events-notifications-panel">
            <div className="vyb-events-notifications-head">
              <strong>Your upcoming reminders</strong>
              <button type="button" className="vyb-events-close-button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications">
                <CloseIcon />
              </button>
            </div>
            {notificationEvents.length === 0 ? (
              <p className="vyb-events-notifications-empty">Saved, interested, and registered events will show up here.</p>
            ) : (
              <div className="vyb-events-notifications-list">
                {notificationEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="vyb-events-notification-item"
                    onClick={() => {
                      setSelectedEventId(event.id);
                      setNotificationsOpen(false);
                    }}
                  >
                    <strong>{event.title}</strong>
                    <span>{formatEventTimeRange(event)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <div className="vyb-events-shell vyb-events-shell-compact">
          <section className="vyb-events-toolbar vyb-events-toolbar-compact">
            <div className="vyb-insta-tabs vyb-events-scope-row-scroll" role="tablist" aria-label="Event scopes">
              {scopeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={activeScope === option.id}
                  aria-label={`${option.label} (${option.count})`}
                  className={`vyb-insta-tab${activeScope === option.id ? " active" : ""}`}
                  onClick={() => setActiveScope(option.id)}
                >
                  <span>{option.label.toUpperCase()}</span>
                </button>
              ))}
            </div>

            <div className="vyb-events-chip-row-scroll">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`vyb-events-chip${activeCategory === category ? " is-active" : ""}`}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </section>

          {filteredEvents.length > 0 ? (
            <div className="vyb-events-feed">
              {filteredEvents.map((event) => {
                const primaryMedia = getPrimaryMedia(event);
                const isSaved = event.isSaved;
                const isOwnEvent = event.isHostedByViewer;
                const busySave = busyAction === `save:${event.id}`;
                const busyInterest = busyAction === `interest:${event.id}`;

                return (
                  <article key={event.id} className="vyb-events-feed-card" role="button" tabIndex={0} onClick={() => setSelectedEventId(event.id)}>
                    <div className="vyb-events-feed-date">
                      <span>{formatEventDayLabel(event.startsAt)}</span>
                      <small>{formatEventTimeRange(event)}</small>
                    </div>

                    <div className="vyb-events-feed-media">
                      {primaryMedia && !brokenMediaIds.includes(primaryMedia.id) ? (
                        primaryMedia.kind === "video" ? (
                          <video
                            src={primaryMedia.url}
                            className="vyb-events-feed-image"
                            muted
                            playsInline
                            preload="metadata"
                            onError={() => setBrokenMediaIds((current) => (current.includes(primaryMedia.id) ? current : [...current, primaryMedia.id]))}
                          />
                        ) : (
                          <img
                            src={primaryMedia.url}
                            alt={event.title}
                            className="vyb-events-feed-image"
                            onError={() => setBrokenMediaIds((current) => (current.includes(primaryMedia.id) ? current : [...current, primaryMedia.id]))}
                          />
                        )
                      ) : (
                        <div className="vyb-events-feed-fallback">
                          <SparkIcon />
                          <span>{event.category}</span>
                        </div>
                      )}
                    </div>

                    <div className="vyb-events-feed-content">
                      <div className="vyb-events-feed-topline">
                        <div className="vyb-events-feed-badges">
                          <span className="vyb-events-club-tag">{event.club}</span>
                          <span className="vyb-events-pass-badge">{event.passLabel}</span>
                          <span className="vyb-events-response-badge">{formatResponseMode(event.responseMode)}</span>
                        </div>

                        <button
                          type="button"
                          className={`vyb-events-save-button${isSaved ? " is-active" : ""}`}
                          aria-label={isSaved ? `Unsave ${event.title}` : `Save ${event.title}`}
                          disabled={busySave}
                          onClick={(actionEvent) => {
                            actionEvent.stopPropagation();
                            void toggleSaved(event.id);
                          }}
                        >
                          <BookmarkIcon />
                        </button>
                      </div>

                      <div className="vyb-events-feed-copy">
                        <div>
                          <h3>{event.title}</h3>
                          <p>@{event.host.username}</p>
                        </div>
                        <span className="vyb-events-attendance">{formatInterestLabel(event.interestCount)}</span>
                      </div>

                      <p className="vyb-events-feed-description">{event.description}</p>

                      <div className="vyb-events-meta-list">
                        <span>
                          <CalendarIcon />
                          {formatEventTimeRange(event)}
                        </span>
                        <span>
                          <LocationIcon />
                          {event.location}
                        </span>
                        {event.capacity ? (
                          <span>
                            <UsersIcon />
                            {event.spotsLeft ?? 0} spots left
                          </span>
                        ) : null}
                      </div>

                      <div className="vyb-events-feed-social">
                        <span>
                          <HeartIcon />
                          {event.viewerRegistration ? `${formatRegistrationStatus(event.viewerRegistration.status)} • ${formatInterestLabel(event.interestCount)}` : formatInterestLabel(event.interestCount)}
                        </span>
                        <span>
                          <CommentIcon />
                          {event.registrationSummary.total} registrations
                        </span>
                      </div>

                      <div className="vyb-events-feed-actions">
                        {isOwnEvent ? (
                          <Link
                            href={`/events/host?edit=${encodeURIComponent(event.id)}`}
                            className="vyb-events-primary-button"
                            onClick={(actionEvent) => actionEvent.stopPropagation()}
                          >
                            <span>Edit</span>
                          </Link>
                        ) : event.responseMode === "interest" ? (
                          <button
                            type="button"
                            className={`vyb-events-primary-button${event.isInterested ? " is-active" : ""}`}
                            disabled={busyInterest || event.status !== "published"}
                            onClick={(actionEvent) => {
                              actionEvent.stopPropagation();
                              void toggleInterested(event.id);
                            }}
                          >
                            <TicketIcon />
                            <span>{formatPrimaryActionLabel(event)}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`vyb-events-primary-button${event.viewerRegistration ? " is-active" : ""}`}
                            disabled={busyAction === `register:${event.id}` || !event.isRegistrationOpen}
                            onClick={(actionEvent) => {
                              actionEvent.stopPropagation();
                              openRegistrationSheet(event);
                            }}
                          >
                            <TicketIcon />
                            <span>{formatPrimaryActionLabel(event)}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className="vyb-events-secondary-button"
                          onClick={(actionEvent) => {
                            actionEvent.stopPropagation();
                            void shareEvent(event);
                          }}
                        >
                          <SendIcon />
                          <span>Share</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="vyb-events-empty-state">
              <strong>No events match that lane right now.</strong>
              <p>Try another category, switch scopes, or clear the search to see more campus activity.</p>
            </div>
          )}
        </div>
      </section>

      <button
        type="button"
        className={`vyb-campus-resizer vyb-campus-resizer-right${activeResize === "right" ? " is-active" : ""}`}
        aria-label="Resize right sidebar"
        onPointerDown={(event) => startResizeDrag("right", event)}
      />

      <aside className="vyb-campus-right-panel vyb-campus-rail">
        <div className="vyb-campus-side-card vyb-events-side-card">
          <span className="vyb-campus-side-label">Your event lane</span>
          <div className="vyb-events-side-user">
            <img src={`https://i.pravatar.cc/120?u=${encodeURIComponent(viewerEmail)}`} alt={viewerName} />
            <div>
              <strong>{viewerName}</strong>
              <span>{identityLine}</span>
            </div>
          </div>

          <div className="vyb-events-side-pill">
            <SparkIcon />
            <span>{role} access active for {collegeName}</span>
          </div>
        </div>

        <div className="vyb-campus-side-card vyb-events-side-card">
          <span className="vyb-campus-side-label">Your signals</span>
          <div className="vyb-events-side-stats">
            <div>
              <span>Saved</span>
              <strong>{dashboard.viewer.savedCount}</strong>
            </div>
            <div>
              <span>Responded</span>
              <strong>{dashboard.viewer.interestedCount}</strong>
            </div>
            <div>
              <span>Hosted</span>
              <strong>{dashboard.viewer.hostedCount}</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong>{dashboard.viewer.hostedPendingCount}</strong>
            </div>
          </div>
        </div>

        <div className="vyb-campus-side-card vyb-events-side-card">
          <div className="vyb-events-side-list-head">
            <span className="vyb-campus-side-label">Hosted by you</span>
            <Link href="/events/host" className="vyb-events-inline-link">
              New
            </Link>
          </div>
          <div className="vyb-events-side-list">
            {dashboard.hostedEvents.length === 0 ? (
              <div className="vyb-events-side-list-item">
                <strong>No hosted events yet</strong>
                <span>Open the host page and publish your first campus event.</span>
              </div>
            ) : (
              dashboard.hostedEvents.slice(0, 4).map((event) => (
                <button key={event.id} type="button" className="vyb-events-side-list-item vyb-events-side-list-button" onClick={() => setSelectedEventId(event.id)}>
                  <strong>{event.title}</strong>
                  <span>{event.registrationSummary.total} registrations • {event.registrationSummary.submitted} pending</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="vyb-campus-side-card vyb-events-side-card">
          <span className="vyb-campus-side-label">Live categories</span>
          <div className="vyb-events-chip-row">
            {categories.filter((category) => category !== "All").slice(0, 6).map((category) => (
              <button key={category} type="button" className="vyb-events-chip" onClick={() => setActiveCategory(category)}>
                {category}
              </button>
            ))}
          </div>
        </div>

        <SignOutButton className="vyb-campus-signout vyb-campus-signout-wide" />
      </aside>

      <nav className="vyb-campus-bottom-nav">
        {navItems.map((item) => (
          <Link key={item.label} href={item.href} className={`vyb-campus-bottom-item${item.active ? " is-active" : ""}`}>
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {selectedEvent ? (
        <div className="vyb-events-detail-backdrop" role="presentation" onClick={() => setSelectedEventId(null)}>
          <aside className="vyb-events-detail-sheet" role="dialog" aria-modal="true" aria-label={selectedEvent.title} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="vyb-events-detail-close" aria-label="Close event details" onClick={() => setSelectedEventId(null)}>
              <CloseIcon />
            </button>

            <div className="vyb-events-detail-media">
              {getPrimaryMedia(selectedEvent) && !brokenMediaIds.includes(getPrimaryMedia(selectedEvent)!.id) ? (
                getPrimaryMedia(selectedEvent)?.kind === "video" ? (
                  <video
                    src={getPrimaryMedia(selectedEvent)?.url}
                    controls
                    playsInline
                    className="vyb-events-detail-image"
                    onError={() => {
                      const media = getPrimaryMedia(selectedEvent);
                      if (media) {
                        setBrokenMediaIds((current) => (current.includes(media.id) ? current : [...current, media.id]));
                      }
                    }}
                  />
                ) : (
                  <img
                    src={getPrimaryMedia(selectedEvent)?.url}
                    alt={selectedEvent.title}
                    className="vyb-events-detail-image"
                    onError={() => {
                      const media = getPrimaryMedia(selectedEvent);
                      if (media) {
                        setBrokenMediaIds((current) => (current.includes(media.id) ? current : [...current, media.id]));
                      }
                    }}
                  />
                )
              ) : (
                <div className="vyb-events-detail-fallback">
                  <SparkIcon />
                  <span>{selectedEvent.category}</span>
                </div>
              )}
            </div>

            <div className="vyb-events-detail-copy">
              <div className="vyb-events-detail-badges">
                <span className="vyb-events-club-tag">{selectedEvent.club}</span>
                <span className="vyb-events-pass-badge">{selectedEvent.passLabel}</span>
                <span className="vyb-events-response-badge">{formatResponseMode(selectedEvent.responseMode)}</span>
                <span className={`vyb-events-status-pill is-${selectedEvent.status}`}>{selectedEvent.status}</span>
              </div>

              <div className="vyb-events-detail-head">
                <div>
                  <h2>{selectedEvent.title}</h2>
                  <p>@{selectedEvent.host.username}</p>
                </div>
                <strong>{formatInterestLabel(selectedEvent.interestCount)}</strong>
              </div>

              <p className="vyb-events-detail-description">{selectedEvent.description}</p>

              <div className="vyb-events-detail-meta">
                <span>
                  <CalendarIcon />
                  {formatEventTimeRange(selectedEvent)}
                </span>
                <span>
                  <LocationIcon />
                  {selectedEvent.location}
                </span>
                {selectedEvent.capacity ? (
                  <span>
                    <UsersIcon />
                    {selectedEvent.spotsLeft ?? 0} / {selectedEvent.capacity} spots left
                  </span>
                ) : null}
                {selectedEvent.registrationConfig.entryMode === "team" ? (
                  <span>
                    <TicketIcon />
                    Team {selectedEvent.registrationConfig.teamSizeMin}-{selectedEvent.registrationConfig.teamSizeMax}
                  </span>
                ) : null}
              </div>

              <div className="vyb-events-detail-summary-grid">
                <div className="vyb-events-detail-summary-card">
                  <span>Total responses</span>
                  <strong>{selectedEvent.registrationSummary.total}</strong>
                </div>
                <div className="vyb-events-detail-summary-card">
                  <span>Approved</span>
                  <strong>{selectedEvent.registrationSummary.approved}</strong>
                </div>
                <div className="vyb-events-detail-summary-card">
                  <span>Pending</span>
                  <strong>{selectedEvent.registrationSummary.submitted}</strong>
                </div>
              </div>

              {!selectedEvent.isHostedByViewer ? (
                <div className="vyb-events-detail-actions">
                  {selectedEvent.responseMode === "interest" ? (
                    <button
                      type="button"
                      className={`vyb-events-primary-button${selectedEvent.isInterested ? " is-active" : ""}`}
                      disabled={busyAction === `interest:${selectedEvent.id}` || selectedEvent.status !== "published"}
                      onClick={() => toggleInterested(selectedEvent.id)}
                    >
                      <TicketIcon />
                      <span>{formatPrimaryActionLabel(selectedEvent)}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`vyb-events-primary-button${selectedEvent.viewerRegistration ? " is-active" : ""}`}
                      disabled={busyAction === `register:${selectedEvent.id}` || !selectedEvent.isRegistrationOpen}
                      onClick={() => openRegistrationSheet(selectedEvent)}
                    >
                      <TicketIcon />
                      <span>{formatPrimaryActionLabel(selectedEvent)}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className={`vyb-events-secondary-button${selectedEvent.isSaved ? " is-active" : ""}`}
                    disabled={busyAction === `save:${selectedEvent.id}`}
                    onClick={() => toggleSaved(selectedEvent.id)}
                  >
                    <BookmarkIcon />
                    <span>{selectedEvent.isSaved ? "Saved" : "Save"}</span>
                  </button>
                  <button type="button" className="vyb-events-secondary-button" onClick={() => shareEvent(selectedEvent)}>
                    <SendIcon />
                    <span>Share</span>
                  </button>
                </div>
              ) : (
                <div className="vyb-events-detail-actions">
                  <Link href={`/events/host?edit=${encodeURIComponent(selectedEvent.id)}`} className="vyb-events-primary-button">
                    <span>Edit event</span>
                  </Link>
                  <button type="button" className="vyb-events-secondary-button" onClick={() => exportRegistrations(selectedEvent.id)}>
                    <DownloadIcon />
                    <span>Export CSV</span>
                  </button>
                  {selectedEvent.status === "published" ? (
                    <button
                      type="button"
                      className="vyb-events-secondary-button"
                      disabled={busyAction === `cancel:${selectedEvent.id}`}
                      onClick={() => cancelHostedEvent(selectedEvent.id)}
                    >
                      <span>Cancel event</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="vyb-events-secondary-button"
                    disabled={busyAction === `delete:${selectedEvent.id}`}
                    onClick={() => deleteHostedEvent(selectedEvent.id)}
                  >
                    <span>Delete</span>
                  </button>
                </div>
              )}

              {selectedEvent.viewerRegistration && !selectedEvent.isHostedByViewer ? (
                <div className={`vyb-events-registration-state is-${selectedEvent.viewerRegistration.status}`}>
                  <strong>{formatRegistrationStatus(selectedEvent.viewerRegistration.status)}</strong>
                  <span>
                    {selectedEvent.viewerRegistration.teamName ? `${selectedEvent.viewerRegistration.teamName} | ` : ""}
                    {selectedEvent.viewerRegistration.teamSize} attendee{selectedEvent.viewerRegistration.teamSize > 1 ? "s" : ""}
                  </span>
                  {selectedEvent.viewerRegistration.attachmentCount > 0 ? <span>{selectedEvent.viewerRegistration.attachmentCount} attachment(s) uploaded</span> : null}
                  {selectedEvent.viewerRegistration.reviewNote ? <p>{selectedEvent.viewerRegistration.reviewNote}</p> : null}
                </div>
              ) : null}

              {selectedEvent.registrationConfig.formFields.length > 0 ? (
                <section className="vyb-events-form-preview">
                  <strong>Registration asks for</strong>
                  <div className="vyb-events-form-preview-list">
                    {selectedEvent.registrationConfig.formFields.map((field) => (
                      <div key={field.id} className="vyb-events-form-preview-item">
                        <span>{field.label}</span>
                        <small>{field.type.replace("_", " ")}{field.required ? " | required" : ""}</small>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {selectedEvent.registrationConfig.allowAttachments ? (
                <section className="vyb-events-form-preview">
                  <strong>Attachment request</strong>
                  <div className="vyb-events-form-preview-list">
                    <div className="vyb-events-form-preview-item">
                      <span>{selectedEvent.registrationConfig.attachmentLabel || "Supporting image"}</span>
                      <small>Image upload</small>
                    </div>
                  </div>
                </section>
              ) : null}

              {selectedEvent.isHostedByViewer ? (
                <section className="vyb-events-registration-admin">
                  <div className="vyb-events-side-list-head">
                    <span className="vyb-campus-side-label">Registrations</span>
                    <span className="vyb-events-inline-link">{hostRegistrations.length} total</span>
                  </div>

                  <div className="vyb-events-registration-admin-filters">
                    <label className="vyb-events-search vyb-events-search-compact">
                      <SearchIcon />
                      <input
                        type="search"
                        value={hostRegistrationQuery}
                        onChange={(event) => setHostRegistrationQuery(event.target.value)}
                        placeholder="Search people, answers, or teams"
                        aria-label="Search registrations"
                      />
                    </label>
                    <div className="vyb-events-registration-filter-row">
                      {(["submitted", "approved", "waitlisted", "rejected"] as CampusEventRegistrationStatus[]).map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={`vyb-events-status-pill${hostRegistrationStatuses.includes(status) ? ` is-${status}` : ""}`}
                          onClick={() => toggleHostRegistrationStatus(status)}
                        >
                          {formatRegistrationStatus(status)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {hostRegistrationsLoading ? <p className="vyb-events-notifications-empty">Loading registrations...</p> : null}
                  {hostRegistrationsError ? <p className="vyb-events-notifications-empty">{hostRegistrationsError}</p> : null}
                  {!hostRegistrationsLoading && !hostRegistrationsError && hostRegistrations.length === 0 ? (
                    <p className="vyb-events-notifications-empty">No registrations yet. Responses will appear here with full form data.</p>
                  ) : null}

                  <div className="vyb-events-registration-list">
                    {hostRegistrations.map((registration) => (
                      <article key={registration.id} className="vyb-events-registration-card">
                        <div className="vyb-events-registration-head">
                          <div>
                            <strong>{registration.attendee.displayName}</strong>
                            <span>
                              @{registration.attendee.username}
                              {registration.teamName ? ` | ${registration.teamName}` : ""}
                            </span>
                          </div>
                          <span className={`vyb-events-status-pill is-${registration.status}`}>{formatRegistrationStatus(registration.status)}</span>
                        </div>

                        <div className="vyb-events-registration-meta">
                          <span>Submitted {new Date(registration.submittedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                          <span>{registration.teamSize} attendee{registration.teamSize > 1 ? "s" : ""}</span>
                        </div>

                        {registration.teamMembers.length > 0 ? (
                          <div className="vyb-events-registration-block">
                            <strong>Team members</strong>
                            <p>
                              {registration.teamMembers.map((member) => [member.name, member.username, member.role].filter(Boolean).join(" | ")).join(" || ")}
                            </p>
                          </div>
                        ) : null}

                        {registration.attachments.length > 0 ? (
                          <div className="vyb-events-registration-block">
                            <strong>Attachments</strong>
                            <div className="vyb-events-registration-attachment-list">
                              {registration.attachments.map((attachment) => (
                                <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="vyb-events-registration-attachment">
                                  <img src={attachment.url} alt={attachment.fileName} />
                                  <span>{attachment.fileName}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {registration.answers.length > 0 ? (
                          <div className="vyb-events-registration-block">
                            <strong>Form answers</strong>
                            <div className="vyb-events-registration-answers">
                              {registration.answers.map((answer) => (
                                <div key={`${registration.id}:${answer.fieldId}`} className="vyb-events-registration-answer">
                                  <span>{answer.label}</span>
                                  <p>{answer.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {registration.note ? (
                          <div className="vyb-events-registration-block">
                            <strong>Applicant note</strong>
                            <p>{registration.note}</p>
                          </div>
                        ) : null}

                        {registration.reviewNote ? (
                          <div className="vyb-events-registration-block">
                            <strong>Host note</strong>
                            <p>{registration.reviewNote}</p>
                          </div>
                        ) : null}

                        <div className="vyb-events-registration-actions">
                          <button
                            type="button"
                            className="vyb-events-secondary-button"
                            disabled={busyAction === `review:${registration.id}`}
                            onClick={() => reviewRegistration(selectedEvent.id, registration.id, "approved")}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="vyb-events-secondary-button"
                            disabled={busyAction === `review:${registration.id}`}
                            onClick={() => reviewRegistration(selectedEvent.id, registration.id, "waitlisted")}
                          >
                            Waitlist
                          </button>
                          <button
                            type="button"
                            className="vyb-events-secondary-button"
                            disabled={busyAction === `review:${registration.id}`}
                            onClick={() => reviewRegistration(selectedEvent.id, registration.id, "rejected")}
                          >
                            Reject
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      {registrationSheetOpen && selectedEvent && !selectedEvent.isHostedByViewer && selectedEvent.responseMode !== "interest" ? (
        <div className="vyb-events-detail-backdrop" role="presentation" onClick={closeRegistrationSheet}>
          <aside className="vyb-events-registration-sheet" role="dialog" aria-modal="true" aria-label={`${selectedEvent.title} registration`} onClick={(event) => event.stopPropagation()}>
            <div className="vyb-events-notifications-head">
              <strong>{selectedEvent.responseMode === "apply" ? "Apply for event" : "Register for event"}</strong>
              <button type="button" className="vyb-events-close-button" onClick={closeRegistrationSheet} aria-label="Close registration form">
                <CloseIcon />
              </button>
            </div>

            <div className="vyb-events-registration-copy">
              <h3>{selectedEvent.title}</h3>
              <p>{selectedEvent.registrationConfig.entryMode === "team" ? "Team entry is enabled. Add teammates and complete the host form." : "Fill the required details to confirm your spot."}</p>
            </div>

            {registrationLoading ? <p className="vyb-events-notifications-empty">Loading your saved answers...</p> : null}
            {registrationError ? <p className="vyb-events-notifications-empty">{registrationError}</p> : null}

            {selectedEvent.registrationConfig.entryMode === "team" ? (
              <>
                <label className="vyb-event-host-field">
                  <span>Team name</span>
                  <input value={registrationDraft.teamName} onChange={(event) => setRegistrationDraft((current) => ({ ...current, teamName: event.target.value }))} placeholder="Byte Brigade" />
                </label>

                <div className="vyb-events-registration-team-head">
                  <strong>Team members</strong>
                  <button
                    type="button"
                    className="vyb-events-secondary-button"
                    onClick={() =>
                      setRegistrationDraft((current) => ({
                        ...current,
                        teamMembers: [...current.teamMembers, createDraftMember()]
                      }))
                    }
                  >
                    Add member
                  </button>
                </div>

                <div className="vyb-events-team-member-list">
                  {registrationDraft.teamMembers.map((member) => (
                    <div key={member.id} className="vyb-events-team-member-card">
                      <div className="vyb-events-team-member-grid">
                        <input
                          value={member.name}
                          onChange={(event) =>
                            setRegistrationDraft((current) => ({
                              ...current,
                              teamMembers: current.teamMembers.map((candidate) => (candidate.id === member.id ? { ...candidate, name: event.target.value } : candidate))
                            }))
                          }
                          placeholder="Member name"
                        />
                        <input
                          value={member.username}
                          onChange={(event) =>
                            setRegistrationDraft((current) => ({
                              ...current,
                              teamMembers: current.teamMembers.map((candidate) => (candidate.id === member.id ? { ...candidate, username: event.target.value } : candidate))
                            }))
                          }
                          placeholder="@username"
                        />
                        <input
                          value={member.email}
                          onChange={(event) =>
                            setRegistrationDraft((current) => ({
                              ...current,
                              teamMembers: current.teamMembers.map((candidate) => (candidate.id === member.id ? { ...candidate, email: event.target.value } : candidate))
                            }))
                          }
                          placeholder="Email"
                        />
                        <input
                          value={member.role}
                          onChange={(event) =>
                            setRegistrationDraft((current) => ({
                              ...current,
                              teamMembers: current.teamMembers.map((candidate) => (candidate.id === member.id ? { ...candidate, role: event.target.value } : candidate))
                            }))
                          }
                          placeholder="Role"
                        />
                      </div>
                      <button
                        type="button"
                        className="vyb-event-host-media-remove"
                        onClick={() =>
                          setRegistrationDraft((current) => ({
                            ...current,
                            teamMembers: current.teamMembers.filter((candidate) => candidate.id !== member.id)
                          }))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            <div className="vyb-events-registration-fields">
              {selectedEvent.registrationConfig.formFields.map((field) => (
                <label key={field.id} className="vyb-event-host-field">
                  <span>
                    {field.label}
                    {field.required ? " *" : ""}
                  </span>
                  {field.type === "long_text" ? (
                    <textarea
                      rows={4}
                      value={registrationDraft.answers[field.id] ?? ""}
                      onChange={(event) =>
                        setRegistrationDraft((current) => ({
                          ...current,
                          answers: {
                            ...current.answers,
                            [field.id]: event.target.value
                          }
                        }))
                      }
                      placeholder={field.placeholder ?? ""}
                    />
                  ) : field.type === "select" ? (
                    <select
                      value={registrationDraft.answers[field.id] ?? ""}
                      onChange={(event) =>
                        setRegistrationDraft((current) => ({
                          ...current,
                          answers: {
                            ...current.answers,
                            [field.id]: event.target.value
                          }
                        }))
                      }
                    >
                      <option value="">Choose one</option>
                      {(field.options ?? []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === "email" ? "email" : field.type === "number" ? "text" : "text"}
                      inputMode={field.type === "number" || field.type === "phone" ? "numeric" : undefined}
                      value={registrationDraft.answers[field.id] ?? ""}
                      onChange={(event) =>
                        setRegistrationDraft((current) => ({
                          ...current,
                          answers: {
                            ...current.answers,
                            [field.id]: event.target.value
                          }
                        }))
                      }
                      placeholder={field.placeholder ?? ""}
                    />
                  )}
                  {field.helpText ? <small className="vyb-event-host-help">{field.helpText}</small> : null}
                </label>
              ))}
            </div>

            {selectedEvent.registrationConfig.allowAttachments ? (
              <div className="vyb-events-registration-block">
                <div className="vyb-events-registration-team-head">
                  <strong>{selectedEvent.registrationConfig.attachmentLabel || "Supporting image"}</strong>
                  <button type="button" className="vyb-events-secondary-button" onClick={() => registrationFileInputRef.current?.click()}>
                    Add image
                  </button>
                  <input
                    ref={registrationFileInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    multiple
                    onChange={(event) => {
                      addRegistrationAttachments(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </div>
                <div className="vyb-events-registration-attachment-list">
                  {registrationDraft.attachments.map((attachment) => (
                    <div key={attachment.id} className="vyb-events-registration-attachment is-editable">
                      <img src={attachment.url} alt={attachment.fileName} />
                      <span>{attachment.fileName}</span>
                      <button type="button" className="vyb-event-host-media-remove" onClick={() => removeRegistrationAttachment(attachment.id)}>
                        Remove
                      </button>
                    </div>
                  ))}
                  {registrationDraft.attachments.length === 0 ? <p className="vyb-events-notifications-empty">No image uploaded yet.</p> : null}
                </div>
              </div>
            ) : null}

            <label className="vyb-event-host-field">
              <span>Note for host</span>
              <textarea
                rows={3}
                value={registrationDraft.note}
                onChange={(event) => setRegistrationDraft((current) => ({ ...current, note: event.target.value }))}
                placeholder="Anything else the host should know?"
              />
            </label>

            <div className="vyb-events-registration-footer">
              <button type="button" className="vyb-events-secondary-button" onClick={closeRegistrationSheet}>
                Cancel
              </button>
              <button
                type="button"
                className="vyb-events-host-button"
                disabled={busyAction === `register:${selectedEvent.id}` || registrationLoading}
                onClick={() => submitRegistration(selectedEvent)}
              >
                <span>
                  {busyAction === `register:${selectedEvent.id}`
                    ? "Saving..."
                    : selectedEvent.viewerRegistration
                      ? selectedEvent.responseMode === "apply"
                        ? "Update application"
                        : "Update registration"
                      : selectedEvent.responseMode === "apply"
                        ? "Submit application"
                        : "Confirm registration"}
                </span>
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
