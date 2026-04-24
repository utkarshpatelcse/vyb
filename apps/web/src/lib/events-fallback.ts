import "server-only";

import type {
  CampusEvent,
  CampusEventActorSummary,
  CampusEventEntryMode,
  CampusEventFormField,
  CampusEventMediaAsset,
  CampusEventPassKind,
  CampusEventRegistration,
  CampusEventRegistrationAnswer,
  CampusEventRegistrationConfig,
  CampusEventRegistrationListResponse,
  CampusEventRegistrationStatus,
  CampusEventRegistrationSummary,
  CampusEventResponseMode,
  CampusEventStatus,
  CampusEventTeamMember,
  CampusEventsDashboardResponse,
  CreateCampusEventRequest,
  CreateCampusEventResponse,
  ManageCampusEventRegistrationRequest,
  ManageCampusEventRegistrationResponse,
  ManageCampusEventResponse,
  ToggleCampusEventInterestResponse,
  ToggleCampusEventSaveResponse,
  UpdateCampusEventRequest,
  UpdateCampusEventResponse,
  UpsertCampusEventRegistrationRequest,
  UpsertCampusEventRegistrationResponse
} from "@vyb/contracts";
import { getFirebaseDataConnect } from "@vyb/config";
import type { DevSession } from "./dev-session";
import { deleteEventMediaAssets } from "./events-media-server";
import type { EventViewerIdentity } from "./events-types";

type StoredRegistration = CampusEventRegistration;

type StoredEvent = {
  id: string;
  tenantId: string;
  host: CampusEventActorSummary;
  title: string;
  club: string;
  category: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string | null;
  media: CampusEventMediaAsset[];
  passKind: CampusEventPassKind;
  passLabel: string;
  capacity: number | null;
  commentCount: number;
  status: Exclude<CampusEventStatus, "ended">;
  createdAt: string;
  savedByUserIds: string[];
  interestedUserIds: string[];
  responseMode: CampusEventResponseMode;
  registrationConfig: CampusEventRegistrationConfig;
  registrations: StoredRegistration[];
};

type EventStore = {
  events: StoredEvent[];
};

type CampusEventStoreRecord = {
  id: string;
  tenantId: string;
  eventsJson: string;
  updatedAt?: string | null;
};

const defaultStore: EventStore = {
  events: []
};
const campusConnectorConfig = {
  connector: "campus",
  serviceId: "vyb",
  location: "asia-south1"
} as const;

const GET_CAMPUS_EVENT_STORE_QUERY = `
  query GetCampusEventStoreByTenant($id: UUID!) {
    campusEventStore(key: { id: $id }) {
      id
      tenantId
      eventsJson
      updatedAt
    }
  }
`;

const CREATE_CAMPUS_EVENT_STORE_MUTATION = `
  mutation CreateCampusEventStore($id: UUID!, $tenantId: UUID!, $eventsJson: String!) {
    campusEventStore_insert(
      data: {
        id: $id
        tenantId: $tenantId
        eventsJson: $eventsJson
        createdAt_expr: "request.time"
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const UPDATE_CAMPUS_EVENT_STORE_MUTATION = `
  mutation UpdateCampusEventStore($id: UUID!, $eventsJson: String!) {
    campusEventStore_update(
      key: { id: $id }
      data: {
        eventsJson: $eventsJson
        updatedAt_expr: "request.time"
      }
    ) {
      id
    }
  }
`;

const seedMediaByCategory: Record<string, string> = {
  Cultural: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80&auto=format&fit=crop",
  Tech: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80&auto=format&fit=crop",
  Workshop: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80&auto=format&fit=crop",
  Sports: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80&auto=format&fit=crop",
  Film: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&q=80&auto=format&fit=crop"
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowMinusMinutes(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60_000).toISOString();
}

function normalizeText(value: string | null | undefined, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function normalizeInteger(value: number | null | undefined, min = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(min, Math.round(value));
}

function normalizeBoolean(value: boolean | null | undefined) {
  return value === true;
}

function buildSeedMedia(category: string): CampusEventMediaAsset[] {
  const url = seedMediaByCategory[category] ?? seedMediaByCategory.Cultural;
  return [
    {
      id: makeId("event-media"),
      kind: "image",
      url,
      fileName: `${category.toLowerCase()}-event.jpg`,
      mimeType: "image/jpeg",
      sizeBytes: 0,
      storagePath: null
    }
  ];
}

function defaultFormFieldsForMode(mode: CampusEventResponseMode): CampusEventFormField[] {
  if (mode === "interest") {
    return [];
  }

  return [
    {
      id: makeId("event-field"),
      label: "Why do you want to join?",
      type: "long_text",
      required: mode === "apply",
      placeholder: mode === "apply" ? "Tell the host why you are a good fit." : "Anything the host should know?",
      helpText: mode === "apply" ? "This answer helps the host review applications." : "Optional but useful for the host.",
      options: []
    }
  ];
}

function normalizeStoredRegistration(registration: Partial<StoredRegistration>): StoredRegistration {
  return {
    id: normalizeText(registration.id) || makeId("event-reg"),
    eventId: normalizeText(registration.eventId),
    attendee: {
      userId: normalizeText(registration.attendee?.userId),
      username: normalizeText(registration.attendee?.username),
      displayName: normalizeText(registration.attendee?.displayName),
      role: registration.attendee?.role ?? "student"
    },
    status: registration.status ?? "submitted",
    submittedAt: normalizeText(registration.submittedAt) || new Date().toISOString(),
    updatedAt: normalizeText(registration.updatedAt) || normalizeText(registration.submittedAt) || new Date().toISOString(),
    teamName: normalizeText(registration.teamName ?? "", "") || null,
    teamSize: normalizeInteger(registration.teamSize ?? 1, 1) ?? 1,
    teamMembers: normalizeTeamMembers(registration.teamMembers),
    answers: normalizeAnswers(registration.answers),
    attachments: Array.isArray(registration.attachments) ? registration.attachments : [],
    note: normalizeText(registration.note ?? "", "") || null,
    reviewNote: normalizeText(registration.reviewNote ?? "", "") || null
  };
}

function normalizeStoredEvent(event: Partial<StoredEvent>): StoredEvent {
  const responseMode = event.responseMode ?? "interest";
  return {
    id: normalizeText(event.id) || makeId("event"),
    tenantId: normalizeText(event.tenantId),
    host: {
      userId: normalizeText(event.host?.userId),
      username: normalizeText(event.host?.username),
      displayName: normalizeText(event.host?.displayName),
      role: event.host?.role ?? "student"
    },
    title: normalizeText(event.title),
    club: normalizeText(event.club),
    category: normalizeText(event.category),
    description: normalizeText(event.description),
    location: normalizeText(event.location),
    startsAt: normalizeText(event.startsAt),
    endsAt: normalizeText(event.endsAt ?? "", "") || null,
    media: Array.isArray(event.media) ? event.media : [],
    passKind: event.passKind ?? "free",
    passLabel: buildPassLabel(event.passKind ?? "free", event.passLabel),
    capacity: normalizeInteger(event.capacity),
    commentCount: normalizeInteger(event.commentCount ?? 0, 0) ?? 0,
    status: event.status ?? "published",
    createdAt: normalizeText(event.createdAt) || new Date().toISOString(),
    savedByUserIds: Array.isArray(event.savedByUserIds) ? event.savedByUserIds.filter(Boolean) : [],
    interestedUserIds: Array.isArray(event.interestedUserIds) ? event.interestedUserIds.filter(Boolean) : [],
    responseMode,
    registrationConfig: buildRegistrationConfig({
      responseMode,
      registrationClosesAt: event.registrationConfig?.closesAt ?? null,
      entryMode: event.registrationConfig?.entryMode ?? "individual",
      teamSizeMin: event.registrationConfig?.teamSizeMin ?? null,
      teamSizeMax: event.registrationConfig?.teamSizeMax ?? null,
      allowAttachments: event.registrationConfig?.allowAttachments ?? false,
      attachmentLabel: event.registrationConfig?.attachmentLabel ?? null,
      formFields: event.registrationConfig?.formFields ?? []
    }),
    registrations: Array.isArray(event.registrations) ? event.registrations.map((registration) => normalizeStoredRegistration(registration)) : []
  };
}

function normalizeFormFields(fields: CampusEventFormField[] | null | undefined, mode: CampusEventResponseMode) {
  const source = Array.isArray(fields) && fields.length > 0 ? fields : defaultFormFieldsForMode(mode);

  return source
    .map((field) => ({
      id: normalizeText(field.id) || makeId("event-field"),
      label: normalizeText(field.label),
      type: field.type,
      required: Boolean(field.required),
      placeholder: normalizeText(field.placeholder ?? "", "") || null,
      helpText: normalizeText(field.helpText ?? "", "") || null,
      options:
        field.type === "select"
          ? [...new Set((field.options ?? []).map((option) => normalizeText(option)).filter(Boolean))]
          : []
    }))
    .filter((field) => field.label);
}

function buildRegistrationConfig(
  payload: Pick<
    CreateCampusEventRequest | UpdateCampusEventRequest,
    "responseMode" | "registrationClosesAt" | "entryMode" | "teamSizeMin" | "teamSizeMax" | "formFields" | "allowAttachments" | "attachmentLabel"
  >
): CampusEventRegistrationConfig {
  const mode = payload.responseMode;
  const entryMode: CampusEventEntryMode = mode === "interest" ? "individual" : payload.entryMode === "team" ? "team" : "individual";
  const teamSizeMin = entryMode === "team" ? normalizeInteger(payload.teamSizeMin ?? 2, 2) ?? 2 : null;
  const proposedTeamSizeMax = entryMode === "team" ? normalizeInteger(payload.teamSizeMax ?? Math.max(teamSizeMin ?? 2, 4), 2) : null;
  const teamSizeMax = entryMode === "team" ? Math.max(teamSizeMin ?? 2, proposedTeamSizeMax ?? (teamSizeMin ?? 2)) : null;

  return {
    mode,
    entryMode,
    closesAt: payload.registrationClosesAt?.trim() || null,
    requiresApproval: mode === "apply",
    teamSizeMin,
    teamSizeMax,
    allowAttachments: mode !== "interest" && normalizeBoolean(payload.allowAttachments),
    attachmentLabel: mode !== "interest" ? normalizeText(payload.attachmentLabel ?? "", "") || null : null,
    formFields: normalizeFormFields(payload.formFields, mode)
  };
}

function buildPassLabel(passKind: CampusEventPassKind, inputLabel: string | null | undefined) {
  const explicit = normalizeText(inputLabel);

  if (explicit) {
    return explicit;
  }

  if (passKind === "free") {
    return "Free entry";
  }

  if (passKind === "paid") {
    return "Paid entry";
  }

  return "RSVP needed";
}

function buildSeedRegistrations(eventId: string, host: CampusEventActorSummary): StoredRegistration[] {
  const submittedAt = nowMinusMinutes(55);
  return [
    {
      id: makeId("event-reg"),
      eventId,
      attendee: {
        userId: `${host.userId}-guest-1`,
        username: "arya.codes",
        displayName: "Arya Sharma",
        role: "student"
      },
      status: "submitted",
      submittedAt,
      updatedAt: submittedAt,
      teamName: "Byte Brigade",
      teamSize: 3,
      teamMembers: [
        { id: makeId("team"), name: "Riya Kapoor", username: "riya.builds", email: "riya@kiet.edu", role: "UI" },
        { id: makeId("team"), name: "Kabir Khan", username: "kabir.ops", email: "kabir@kiet.edu", role: "Backend" }
      ],
      answers: [
        { fieldId: "seed-stack", label: "Primary stack", value: "Next.js + Firebase" },
        { fieldId: "seed-why", label: "What are you building?", value: "A campus ops platform with fast team workflows." }
      ],
      attachments: [],
      note: "Happy to present during screening if needed.",
      reviewNote: null
    }
  ];
}

function buildSeedEvents(tenantId: string): StoredEvent[] {
  const hackHost: CampusEventActorSummary = {
    userId: "seed-codecell",
    username: "codecell.live",
    displayName: "CodeCell",
    role: "student"
  };
  const hackEventId = `event-${tenantId}-2`;

  return [
    {
      id: `event-${tenantId}-1`,
      tenantId,
      host: {
        userId: "seed-culture",
        username: "culture.live",
        displayName: "Cultural Council",
        role: "student"
      },
      title: "Neon Night Showcase",
      club: "Cultural Council",
      category: "Cultural",
      description: "Student performances, live visuals, crowd moments, and late-evening campus energy in one outdoor setup.",
      location: "Central lawn",
      startsAt: hoursFromNow(18),
      endsAt: hoursFromNow(22),
      media: buildSeedMedia("Cultural"),
      passKind: "free",
      passLabel: "Free entry",
      capacity: 800,
      commentCount: 84,
      status: "published",
      createdAt: nowMinusMinutes(25),
      savedByUserIds: [],
      interestedUserIds: ["seed-1", "seed-2", "seed-3", "seed-4", "seed-5", "seed-6", "seed-7"],
      responseMode: "interest",
      registrationConfig: {
        mode: "interest",
        entryMode: "individual",
        closesAt: null,
        requiresApproval: false,
        teamSizeMin: null,
        teamSizeMax: null,
        allowAttachments: false,
        attachmentLabel: null,
        formFields: []
      },
      registrations: []
    },
    {
      id: hackEventId,
      tenantId,
      host: hackHost,
      title: "Hack Sprint Zero",
      club: "CodeCell",
      category: "Tech",
      description: "A quick pre-hackathon mixer with demo tables, team matching, and a fast mentor round.",
      location: "Innovation lab",
      startsAt: hoursFromNow(30),
      endsAt: hoursFromNow(35),
      media: buildSeedMedia("Tech"),
      passKind: "rsvp",
      passLabel: "Apply with team",
      capacity: 150,
      commentCount: 39,
      status: "published",
      createdAt: nowMinusMinutes(90),
      savedByUserIds: [],
      interestedUserIds: ["seed-8", "seed-9", "seed-10", "seed-11"],
      responseMode: "apply",
      registrationConfig: {
        mode: "apply",
        entryMode: "team",
        closesAt: hoursFromNow(24),
        requiresApproval: true,
        teamSizeMin: 2,
        teamSizeMax: 4,
        allowAttachments: true,
        attachmentLabel: "team proof",
        formFields: [
          {
            id: "seed-stack",
            label: "Primary stack",
            type: "short_text",
            required: true,
            placeholder: "MERN / Flutter / AI agents",
            helpText: "Mention the main technologies your team is comfortable with.",
            options: []
          },
          {
            id: "seed-why",
            label: "What are you planning to build?",
            type: "long_text",
            required: true,
            placeholder: "Describe your idea in 2-3 lines.",
            helpText: "The host uses this to shortlist applications.",
            options: []
          }
        ]
      },
      registrations: buildSeedRegistrations(hackEventId, hackHost)
    },
    {
      id: `event-${tenantId}-3`,
      tenantId,
      host: {
        userId: "seed-ecell",
        username: "ecell.live",
        displayName: "E-Cell",
        role: "student"
      },
      title: "Startup Jam",
      club: "E-Cell",
      category: "Workshop",
      description: "Pitch warmups, sharp founder feedback, and fast room energy for teams building in public.",
      location: "Seminar block",
      startsAt: hoursFromNow(28),
      endsAt: hoursFromNow(31),
      media: buildSeedMedia("Workshop"),
      passKind: "rsvp",
      passLabel: "Register now",
      capacity: 180,
      commentCount: 26,
      status: "published",
      createdAt: nowMinusMinutes(140),
      savedByUserIds: [],
      interestedUserIds: ["seed-12", "seed-13", "seed-14"],
      responseMode: "register",
      registrationConfig: {
        mode: "register",
        entryMode: "individual",
        closesAt: hoursFromNow(20),
        requiresApproval: false,
        teamSizeMin: null,
        teamSizeMax: null,
        allowAttachments: false,
        attachmentLabel: null,
        formFields: [
          {
            id: "seed-stage",
            label: "Startup stage",
            type: "select",
            required: true,
            placeholder: null,
            helpText: "This helps the mentors group the room.",
            options: ["Idea", "Prototype", "Live users"]
          }
        ]
      },
      registrations: []
    },
    {
      id: `event-${tenantId}-4`,
      tenantId,
      host: {
        userId: "seed-sports",
        username: "fit.on.campus",
        displayName: "Sports Board",
        role: "student"
      },
      title: "Sunrise Run Club",
      club: "Sports Board",
      category: "Sports",
      description: "Campus laps, stretch stops, and a recovery corner for early-morning runners.",
      location: "Sports complex",
      startsAt: hoursFromNow(52),
      endsAt: hoursFromNow(54),
      media: buildSeedMedia("Sports"),
      passKind: "free",
      passLabel: "Open drop-in",
      capacity: 120,
      commentCount: 18,
      status: "published",
      createdAt: nowMinusMinutes(200),
      savedByUserIds: [],
      interestedUserIds: ["seed-15", "seed-16"],
      responseMode: "interest",
      registrationConfig: {
        mode: "interest",
        entryMode: "individual",
        closesAt: null,
        requiresApproval: false,
        teamSizeMin: null,
        teamSizeMax: null,
        allowAttachments: false,
        attachmentLabel: null,
        formFields: []
      },
      registrations: []
    },
    {
      id: `event-${tenantId}-5`,
      tenantId,
      host: {
        userId: "seed-frame-house",
        username: "frame.house",
        displayName: "Frame House",
        role: "student"
      },
      title: "Indie Film Circle",
      club: "Frame House",
      category: "Film",
      description: "A screening room vibe with a short discussion on storytelling, cuts, and visual language.",
      location: "Mini auditorium",
      startsAt: new Date(Date.now() - 48 * 60 * 60_000).toISOString(),
      endsAt: new Date(Date.now() - 45 * 60 * 60_000).toISOString(),
      media: buildSeedMedia("Film"),
      passKind: "free",
      passLabel: "Free + popcorn",
      capacity: 220,
      commentCount: 44,
      status: "published",
      createdAt: nowMinusMinutes(400),
      savedByUserIds: [],
      interestedUserIds: ["seed-17", "seed-18", "seed-19"],
      responseMode: "interest",
      registrationConfig: {
        mode: "interest",
        entryMode: "individual",
        closesAt: null,
        requiresApproval: false,
        teamSizeMin: null,
        teamSizeMax: null,
        allowAttachments: false,
        attachmentLabel: null,
        formFields: []
      },
      registrations: []
    }
  ];
}

function dedupeSortedCategories(categories: string[]) {
  return [...new Set(categories.map((category) => category.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function getEventEffectiveStatus(event: StoredEvent): CampusEventStatus {
  if (event.status !== "published") {
    return event.status;
  }

  const endTime = event.endsAt ? new Date(event.endsAt).getTime() : new Date(event.startsAt).getTime() + 3 * 60 * 60_000;

  if (Number.isFinite(endTime) && endTime < Date.now()) {
    return "ended";
  }

  return "published";
}

function getRegistrationSummary(event: StoredEvent): CampusEventRegistrationSummary {
  return event.registrations.reduce<CampusEventRegistrationSummary>(
    (summary, registration) => {
      summary.total += 1;
      if (registration.status !== "cancelled") {
        summary[registration.status] += 1;
      }
      return summary;
    },
    { total: 0, submitted: 0, approved: 0, waitlisted: 0, rejected: 0 }
  );
}

function getApprovedSeatUsage(event: StoredEvent, excludeRegistrationId?: string) {
  return event.registrations
    .filter((registration) => registration.status === "approved" && registration.id !== excludeRegistrationId)
    .reduce((count, registration) => count + Math.max(1, registration.teamSize), 0);
}

function getSpotsLeft(event: StoredEvent) {
  if (!event.capacity) {
    return null;
  }

  return Math.max(0, event.capacity - getApprovedSeatUsage(event));
}

function isRegistrationOpen(event: StoredEvent) {
  if (getEventEffectiveStatus(event) !== "published") {
    return false;
  }

  const closesAt = event.registrationConfig.closesAt ? new Date(event.registrationConfig.closesAt).getTime() : null;
  if (Number.isFinite(closesAt) && (closesAt ?? 0) < Date.now()) {
    return false;
  }

  if (event.responseMode === "register") {
    const spotsLeft = getSpotsLeft(event);
    if (spotsLeft !== null && spotsLeft <= 0) {
      return false;
    }
  }

  return true;
}

function toViewerRegistrationSummary(registration: StoredRegistration | undefined | null): CampusEvent["viewerRegistration"] {
  if (!registration) {
    return null;
  }

  return {
    id: registration.id,
    status: registration.status,
    submittedAt: registration.submittedAt,
    updatedAt: registration.updatedAt,
    teamName: registration.teamName ?? null,
    teamSize: registration.teamSize,
    note: registration.note ?? null,
    reviewNote: registration.reviewNote ?? null,
    attachmentCount: registration.attachments.length
  };
}

function toCampusEvent(event: StoredEvent, viewer?: Pick<DevSession, "userId">): CampusEvent {
  const viewerRegistration = viewer
    ? event.registrations.find((registration) => registration.attendee.userId === viewer.userId)
    : null;

  return {
    id: event.id,
    tenantId: event.tenantId,
    host: event.host,
    title: event.title,
    club: event.club,
    category: event.category,
    description: event.description,
    location: event.location,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    media: event.media,
    passKind: event.passKind,
    passLabel: event.passLabel,
    capacity: event.capacity,
    spotsLeft: getSpotsLeft(event),
    isRegistrationOpen: isRegistrationOpen(event),
    commentCount: event.commentCount,
    status: getEventEffectiveStatus(event),
    createdAt: event.createdAt,
    savedCount: event.savedByUserIds.length,
    interestCount: event.interestedUserIds.length,
    responseMode: event.responseMode,
    registrationConfig: clone(event.registrationConfig),
    registrationSummary: getRegistrationSummary(event),
    viewerRegistration: toViewerRegistrationSummary(viewerRegistration),
    isSaved: viewer ? event.savedByUserIds.includes(viewer.userId) : false,
    isInterested: viewer ? event.interestedUserIds.includes(viewer.userId) : false,
    isHostedByViewer: viewer ? event.host.userId === viewer.userId : false
  };
}

function getCampusEventsDc() {
  return getFirebaseDataConnect(campusConnectorConfig);
}

function normalizeStore(raw: unknown, tenantId: string): EventStore {
  const parsed = raw && typeof raw === "object" ? (raw as Partial<EventStore>) : null;
  return {
    events: Array.isArray(parsed?.events)
      ? parsed.events.map((event) => normalizeStoredEvent(event)).filter((event) => event.tenantId === tenantId)
      : []
  };
}

function serializeStore(store: EventStore) {
  return {
    events: clone(store.events)
  };
}

function parseStoreJson(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

async function readStoreRecord(tenantId: string) {
  const response = await getCampusEventsDc().executeGraphqlRead(GET_CAMPUS_EVENT_STORE_QUERY, {
    operationName: "GetCampusEventStoreByTenant",
    variables: {
      id: tenantId
    }
  });

  const data = response.data as {
    campusEventStore?: CampusEventStoreRecord | null;
  };

  return data.campusEventStore ?? null;
}

async function writeStoreRecord(tenantId: string, store: EventStore, exists: boolean) {
  const dc = getCampusEventsDc();
  const eventsJson = JSON.stringify(serializeStore(store));

  if (exists) {
    await dc.executeGraphql(UPDATE_CAMPUS_EVENT_STORE_MUTATION, {
      operationName: "UpdateCampusEventStore",
      variables: {
        id: tenantId,
        eventsJson
      }
    });
    return;
  }

  try {
    await dc.executeGraphql(CREATE_CAMPUS_EVENT_STORE_MUTATION, {
      operationName: "CreateCampusEventStore",
      variables: {
        id: tenantId,
        tenantId,
        eventsJson
      }
    });
  } catch (error) {
    await dc.executeGraphql(UPDATE_CAMPUS_EVENT_STORE_MUTATION, {
      operationName: "UpdateCampusEventStore",
      variables: {
        id: tenantId,
        eventsJson
      }
    });
  }
}

function seedTenantStoreIfEmpty(store: EventStore, tenantId: string) {
  if (store.events.some((event) => event.tenantId === tenantId)) {
    return false;
  }

  store.events.push(...buildSeedEvents(tenantId));
  return true;
}

async function loadStore(tenantId: string) {
  const record = await readStoreRecord(tenantId);
  return normalizeStore(parseStoreJson(record?.eventsJson), tenantId);
}

async function transactStore<T>(
  tenantId: string,
  mutate: (store: EventStore) => {
    result: T;
    changed?: boolean;
  }
) {
  let finalStore = clone(defaultStore);
  let finalResult: T | undefined;
  let shouldPersist = false;
  const existingRecord = await readStoreRecord(tenantId);
  const store = normalizeStore(parseStoreJson(existingRecord?.eventsJson), tenantId);
  const outcome = mutate(store);

  finalStore = store;
  finalResult = outcome.result;
  shouldPersist = outcome.changed !== false;

  if (finalResult === undefined) {
    throw new Error("We could not complete the event update.");
  }

  if (shouldPersist) {
    await writeStoreRecord(tenantId, store, Boolean(existingRecord));
  }

  return {
    store: finalStore,
    result: finalResult,
    changed: shouldPersist
  };
}

async function ensureTenantSeeded(tenantId: string) {
  const currentStore = await loadStore(tenantId);
  if (currentStore.events.length > 0) {
    return currentStore;
  }

  const { store } = await transactStore(tenantId, (store) => ({
    result: null,
    changed: seedTenantStoreIfEmpty(store, tenantId)
  }));

  return store;
}

function buildDashboard(store: EventStore, viewer: DevSession): CampusEventsDashboardResponse {
  const tenantEvents = store.events
    .filter((event) => event.tenantId === viewer.tenantId)
    .filter((event) => event.status !== "deleted")
    .filter((event) => event.status === "published" || event.status === "cancelled" || event.host.userId === viewer.userId);
  const publicEvents = tenantEvents
    .filter((event) => event.status === "published")
    .map((event) => toCampusEvent(event, viewer))
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
  const hostedEvents = tenantEvents
    .filter((event) => event.host.userId === viewer.userId && event.status !== "deleted")
    .map((event) => toCampusEvent(event, viewer))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  return {
    tenantId: viewer.tenantId,
    viewer: {
      userId: viewer.userId,
      username: viewer.email.split("@")[0] ?? "vyb-student",
      savedCount: publicEvents.filter((event) => event.isSaved).length,
      interestedCount: publicEvents.filter((event) => event.isInterested || event.viewerRegistration !== null).length,
      hostedCount: hostedEvents.length,
      hostedPendingCount: hostedEvents.reduce((count, event) => count + event.registrationSummary.submitted, 0),
      hostedRegistrationCount: hostedEvents.reduce((count, event) => count + event.registrationSummary.total, 0)
    },
    events: publicEvents,
    hostedEvents,
    categories: dedupeSortedCategories(publicEvents.filter((event) => event.status !== "cancelled").map((event) => event.category))
  };
}

function getStoredEventOrThrow(store: EventStore, viewer: DevSession, eventId: string) {
  const event = store.events.find((candidate) => candidate.id === eventId && candidate.tenantId === viewer.tenantId && candidate.status !== "deleted");

  if (!event) {
    throw new Error("This event could not be found.");
  }

  return event;
}

function getRegistrationSeatCount(entryMode: CampusEventEntryMode, teamMembers: CampusEventTeamMember[]) {
  return entryMode === "team" ? teamMembers.length + 1 : 1;
}

function normalizeTeamMembers(teamMembers: CampusEventTeamMember[] | undefined | null) {
  return (teamMembers ?? [])
    .map((member) => ({
      id: normalizeText(member.id) || makeId("team"),
      name: normalizeText(member.name),
      email: normalizeText(member.email ?? "", "") || null,
      username: normalizeText(member.username ?? "", "") || null,
      phone: normalizeText(member.phone ?? "", "") || null,
      role: normalizeText(member.role ?? "", "") || null
    }))
    .filter((member) => member.name);
}

function normalizeAnswers(answers: CampusEventRegistrationAnswer[] | undefined | null) {
  return (answers ?? [])
    .map((answer) => ({
      fieldId: normalizeText(answer.fieldId),
      label: normalizeText(answer.label),
      value: normalizeText(answer.value)
    }))
    .filter((answer) => answer.fieldId && answer.value);
}

function normalizeAttachmentKeepIds(value: string[] | undefined | null) {
  return [...new Set((value ?? []).map((item) => normalizeText(item)).filter(Boolean))];
}

function validateRegistrationInput(event: StoredEvent, payload: UpsertCampusEventRegistrationRequest, existingRegistration?: StoredRegistration | null) {
  if (event.responseMode === "interest") {
    throw new Error("This event only supports interest right now.");
  }

  if (!isRegistrationOpen(event)) {
    throw new Error("Registrations for this event are closed.");
  }

  const teamMembers = normalizeTeamMembers(payload.teamMembers);
  const answers = normalizeAnswers(payload.answers);
  const note = normalizeText(payload.note ?? "", "") || null;
  const teamName = normalizeText(payload.teamName ?? "", "") || null;
  const teamSize = getRegistrationSeatCount(event.registrationConfig.entryMode, teamMembers);
  const keepAttachmentIds = normalizeAttachmentKeepIds(payload.keepAttachmentIds);
  const keptAttachments = (existingRegistration?.attachments ?? []).filter((attachment) => keepAttachmentIds.includes(attachment.id));
  const attachments = [...keptAttachments, ...(payload.attachments ?? [])];

  if (event.registrationConfig.entryMode === "team") {
    if (!teamName) {
      throw new Error("Add a team name before applying.");
    }

    const minSize = event.registrationConfig.teamSizeMin ?? 2;
    const maxSize = event.registrationConfig.teamSizeMax ?? Math.max(minSize, 4);

    if (teamSize < minSize || teamSize > maxSize) {
      throw new Error(`Team size must stay between ${minSize} and ${maxSize} people including the leader.`);
    }
  }

  for (const field of event.registrationConfig.formFields) {
    const answer = answers.find((candidate) => candidate.fieldId === field.id);
    if (field.required && !answer?.value) {
      throw new Error(`Complete "${field.label}" before submitting.`);
    }
  }

  if (!event.registrationConfig.allowAttachments && attachments.length > 0) {
    throw new Error("This event does not accept registration attachments.");
  }

  if (event.responseMode === "register") {
    const approvedUsage = getApprovedSeatUsage(event, existingRegistration?.status === "approved" ? existingRegistration.id : undefined);
    if (event.capacity && approvedUsage + teamSize > event.capacity) {
      throw new Error("This event does not have enough spots left for this registration.");
    }
  }

  return {
    answers,
    attachments,
    note,
    teamMembers,
    teamName,
    teamSize
  };
}

function ensureHostAccess(event: StoredEvent, viewer: DevSession) {
  if (event.host.userId !== viewer.userId) {
    throw new Error("Only the host can manage this event.");
  }
}

function filterRegistrations(registrations: StoredRegistration[], query?: string | null, statuses?: CampusEventRegistrationStatus[]) {
  const normalizedQuery = normalizeText(query ?? "", "").toLowerCase();
  const statusSet = new Set<CampusEventRegistrationStatus>((statuses ?? []).filter((status) => status !== "cancelled"));

  return registrations.filter((registration) => {
    if (statusSet.size > 0 && !statusSet.has(registration.status)) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      registration.attendee.displayName,
      registration.attendee.username,
      registration.attendee.role,
      registration.teamName,
      registration.note,
      registration.reviewNote,
      ...registration.teamMembers.flatMap((member) => [member.name, member.username, member.email, member.role]),
      ...registration.answers.flatMap((answer) => [answer.label, answer.value]),
      ...registration.attachments.flatMap((attachment) => [attachment.fileName, attachment.url])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

function toRegistrationResponse(
  event: StoredEvent,
  viewer: DevSession,
  filters?: {
    query?: string | null;
    statuses?: CampusEventRegistrationStatus[];
  }
): CampusEventRegistrationListResponse {
  ensureHostAccess(event, viewer);
  return {
    event: toCampusEvent(event, viewer),
    registrations: clone(
      filterRegistrations(event.registrations, filters?.query, filters?.statuses).sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      )
    )
  };
}

function csvEscape(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function buildRegistrationsCsv(event: StoredEvent) {
  const headers = [
    "Registration ID",
    "Status",
    "Leader Name",
    "Leader Username",
    "Leader Role",
    "Submitted At",
    "Updated At",
    "Team Name",
    "Team Size",
    "Team Members",
    "Attachments",
    "Note",
    "Review Note",
    "Answers"
  ];

  const rows = event.registrations
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .map((registration) =>
      [
        registration.id,
        registration.status,
        registration.attendee.displayName,
        registration.attendee.username,
        registration.attendee.role,
        registration.submittedAt,
        registration.updatedAt,
        registration.teamName ?? "",
        registration.teamSize,
        registration.teamMembers
          .map((member) => [member.name, member.username, member.email, member.role].filter(Boolean).join(" / "))
          .join(" | "),
        registration.attachments.map((attachment) => `${attachment.fileName} (${attachment.url})`).join(" | "),
        registration.note ?? "",
        registration.reviewNote ?? "",
        registration.answers.map((answer) => `${answer.label}: ${answer.value}`).join(" | ")
      ]
        .map((value) => csvEscape(value))
        .join(",")
    );

  return [headers.map((value) => csvEscape(value)).join(","), ...rows].join("\n");
}

export async function getEventsDashboard(viewer: DevSession): Promise<CampusEventsDashboardResponse> {
  const store = await ensureTenantSeeded(viewer.tenantId);
  return buildDashboard(store, viewer);
}

export async function getEventForViewer(viewer: DevSession, eventId: string): Promise<CampusEvent | null> {
  const store = await ensureTenantSeeded(viewer.tenantId);
  const event = store.events.find((candidate) => candidate.id === eventId && candidate.tenantId === viewer.tenantId && candidate.status !== "deleted");

  if (!event) {
    return null;
  }

  if (event.status !== "published" && event.host.userId !== viewer.userId) {
    return null;
  }

  return toCampusEvent(event, viewer);
}

export async function getViewerCampusEventRegistration(viewer: DevSession, eventId: string) {
  const store = await ensureTenantSeeded(viewer.tenantId);
  const event = getStoredEventOrThrow(store, viewer, eventId);

  if (event.host.userId === viewer.userId) {
    throw new Error("Hosts do not have attendee registrations for their own event.");
  }

  return {
    event: toCampusEvent(event, viewer),
    registration: clone(event.registrations.find((registration) => registration.attendee.userId === viewer.userId) ?? null)
  };
}

export async function createCampusEvent(
  viewer: DevSession,
  identity: EventViewerIdentity,
  payload: CreateCampusEventRequest
): Promise<CreateCampusEventResponse> {
  const eventId = makeId("event");
  const createdAt = new Date().toISOString();
  const { store } = await transactStore(viewer.tenantId, (store) => {
    seedTenantStoreIfEmpty(store, viewer.tenantId);
    store.events.unshift({
      id: eventId,
      tenantId: viewer.tenantId,
      host: {
        userId: identity.userId,
        username: identity.username,
        displayName: identity.displayName,
        role: identity.role
      },
      title: normalizeText(payload.title),
      club: normalizeText(payload.club),
      category: normalizeText(payload.category),
      description: normalizeText(payload.description),
      location: normalizeText(payload.location),
      startsAt: payload.startsAt,
      endsAt: payload.endsAt?.trim() || null,
      media: payload.media ?? [],
      passKind: payload.passKind,
      passLabel: buildPassLabel(payload.passKind, payload.passLabel),
      capacity: normalizeInteger(payload.capacity),
      commentCount: 0,
      status: "published",
      createdAt,
      savedByUserIds: [],
      interestedUserIds: [],
      responseMode: payload.responseMode,
      registrationConfig: buildRegistrationConfig(payload),
      registrations: []
    });

    return {
      result: eventId
    };
  });

  return {
    dashboard: buildDashboard(store, viewer),
    eventId
  };
}

export async function updateCampusEvent(viewer: DevSession, payload: UpdateCampusEventRequest): Promise<UpdateCampusEventResponse> {
  let removable: CampusEventMediaAsset[] = [];
  const { store } = await transactStore(viewer.tenantId, (store) => {
    seedTenantStoreIfEmpty(store, viewer.tenantId);
    const event = getStoredEventOrThrow(store, viewer, payload.eventId);
    ensureHostAccess(event, viewer);

    const keepIds = new Set(payload.keepMediaIds ?? event.media.map((media) => media.id));
    removable = event.media.filter((media) => !keepIds.has(media.id));

    event.title = normalizeText(payload.title);
    event.club = normalizeText(payload.club);
    event.category = normalizeText(payload.category);
    event.description = normalizeText(payload.description);
    event.location = normalizeText(payload.location);
    event.startsAt = payload.startsAt;
    event.endsAt = payload.endsAt?.trim() || null;
    event.passKind = payload.passKind;
    event.passLabel = buildPassLabel(payload.passKind, payload.passLabel);
    event.capacity = normalizeInteger(payload.capacity);
    event.responseMode = payload.responseMode;
    event.registrationConfig = buildRegistrationConfig(payload);
    event.media = [...event.media.filter((media) => keepIds.has(media.id)), ...(payload.media ?? [])];

    return {
      result: event.id
    };
  });

  if (removable.length > 0) {
    await deleteEventMediaAssets(removable).catch(() => undefined);
  }

  return {
    dashboard: buildDashboard(store, viewer),
    eventId: payload.eventId
  };
}

export async function toggleCampusEventSave(viewer: DevSession, eventId: string): Promise<ToggleCampusEventSaveResponse> {
  const { store, result: isSaved } = await transactStore(viewer.tenantId, (store) => {
    seedTenantStoreIfEmpty(store, viewer.tenantId);
    const event = store.events.find((candidate) => candidate.id === eventId && candidate.tenantId === viewer.tenantId && candidate.status === "published");

    if (!event) {
      throw new Error("Choose a valid event to save.");
    }

    const alreadySaved = event.savedByUserIds.includes(viewer.userId);
    event.savedByUserIds = alreadySaved ? event.savedByUserIds.filter((userId) => userId !== viewer.userId) : [...event.savedByUserIds, viewer.userId];

    return {
      result: !alreadySaved
    };
  });

  return {
    dashboard: buildDashboard(store, viewer),
    eventId,
    isSaved
  };
}

export async function toggleCampusEventInterest(viewer: DevSession, eventId: string): Promise<ToggleCampusEventInterestResponse> {
  const { store, result: isInterested } = await transactStore(viewer.tenantId, (store) => {
    seedTenantStoreIfEmpty(store, viewer.tenantId);
    const event = store.events.find((candidate) => candidate.id === eventId && candidate.tenantId === viewer.tenantId && candidate.status === "published");

    if (!event) {
      throw new Error("Choose a valid event before updating your RSVP.");
    }

    if (event.responseMode !== "interest") {
      throw new Error("This event needs a registration or application form instead of simple interest.");
    }

    const alreadyInterested = event.interestedUserIds.includes(viewer.userId);
    event.interestedUserIds = alreadyInterested
      ? event.interestedUserIds.filter((userId) => userId !== viewer.userId)
      : [...event.interestedUserIds, viewer.userId];

    return {
      result: !alreadyInterested
    };
  });

  return {
    dashboard: buildDashboard(store, viewer),
    eventId,
    isInterested
  };
}

export async function upsertCampusEventRegistration(
  viewer: DevSession,
  identity: EventViewerIdentity,
  payload: UpsertCampusEventRegistrationRequest
): Promise<UpsertCampusEventRegistrationResponse> {
  let removableAttachments: CampusEventMediaAsset[] = [];
  let updatedEvent: StoredEvent | null = null;
  let nextRegistration: StoredRegistration | null = null;
  const createdRegistrationId = makeId("event-reg");

  const { store } = await transactStore(viewer.tenantId, (store) => {
    seedTenantStoreIfEmpty(store, viewer.tenantId);
    const event = getStoredEventOrThrow(store, viewer, payload.eventId);

    if (event.host.userId === viewer.userId) {
      throw new Error("Hosts cannot register for their own event.");
    }

    const existingRegistration = event.registrations.find((registration) => registration.attendee.userId === viewer.userId) ?? null;
    const normalized = validateRegistrationInput(event, payload, existingRegistration);
    const timestamp = new Date().toISOString();
    const nextStatus: CampusEventRegistrationStatus = event.responseMode === "apply" ? "submitted" : "approved";
    removableAttachments = (existingRegistration?.attachments ?? []).filter(
      (attachment) => !normalized.attachments.some((candidate) => candidate.id === attachment.id)
    );

    nextRegistration = existingRegistration
      ? {
          ...existingRegistration,
          attendee: {
            userId: identity.userId,
            username: identity.username,
            displayName: identity.displayName,
            role: identity.role
          },
          status: nextStatus,
          updatedAt: timestamp,
          teamName: normalized.teamName,
          teamSize: normalized.teamSize,
          teamMembers: normalized.teamMembers,
          answers: normalized.answers,
          attachments: normalized.attachments,
          note: normalized.note,
          reviewNote: event.responseMode === "apply" ? null : existingRegistration.reviewNote ?? null
        }
      : {
          id: createdRegistrationId,
          eventId: event.id,
          attendee: {
            userId: identity.userId,
            username: identity.username,
            displayName: identity.displayName,
            role: identity.role
          },
          status: nextStatus,
          submittedAt: timestamp,
          updatedAt: timestamp,
          teamName: normalized.teamName,
          teamSize: normalized.teamSize,
          teamMembers: normalized.teamMembers,
          answers: normalized.answers,
          attachments: normalized.attachments,
          note: normalized.note,
          reviewNote: null
        };

    event.registrations = existingRegistration
      ? event.registrations.map((registration) => (registration.id === existingRegistration.id ? nextRegistration! : registration))
      : [nextRegistration, ...event.registrations];

    if (!event.interestedUserIds.includes(viewer.userId)) {
      event.interestedUserIds.push(viewer.userId);
    }

    updatedEvent = clone(event);

    return {
      result: event.id
    };
  });

  if (removableAttachments.length > 0) {
    await deleteEventMediaAssets(removableAttachments).catch(() => undefined);
  }

  if (!updatedEvent || !nextRegistration) {
    throw new Error("We could not save your registration.");
  }

  return {
    dashboard: buildDashboard(store, viewer),
    event: toCampusEvent(updatedEvent, viewer),
    registration: toViewerRegistrationSummary(nextRegistration)!
  };
}

export async function getCampusEventRegistrations(viewer: DevSession, eventId: string): Promise<CampusEventRegistrationListResponse> {
  const store = await ensureTenantSeeded(viewer.tenantId);
  const event = getStoredEventOrThrow(store, viewer, eventId);
  return toRegistrationResponse(event, viewer);
}

export async function getCampusEventRegistrationsFiltered(
  viewer: DevSession,
  eventId: string,
  filters?: {
    query?: string | null;
    statuses?: CampusEventRegistrationStatus[];
  }
): Promise<CampusEventRegistrationListResponse> {
  const store = await ensureTenantSeeded(viewer.tenantId);
  const event = getStoredEventOrThrow(store, viewer, eventId);
  return toRegistrationResponse(event, viewer, filters);
}

export async function manageCampusEventRegistration(
  viewer: DevSession,
  eventId: string,
  registrationId: string,
  payload: ManageCampusEventRegistrationRequest
): Promise<ManageCampusEventRegistrationResponse> {
  let managedEvent: StoredEvent | null = null;
  let nextStatus: CampusEventRegistrationStatus | null = null;
  const { store } = await transactStore(viewer.tenantId, (store) => {
    seedTenantStoreIfEmpty(store, viewer.tenantId);
    const event = getStoredEventOrThrow(store, viewer, eventId);
    ensureHostAccess(event, viewer);

    const registration = event.registrations.find((candidate) => candidate.id === registrationId);
    if (!registration) {
      throw new Error("This registration could not be found.");
    }

    if (payload.status === "approved" && event.capacity) {
      const approvedUsage = getApprovedSeatUsage(event, registration.status === "approved" ? registration.id : undefined);
      if (approvedUsage + registration.teamSize > event.capacity) {
        throw new Error("There are not enough spots left to approve this registration.");
      }
    }

    registration.status = payload.status;
    registration.reviewNote = normalizeText(payload.reviewNote ?? "", "") || null;
    registration.updatedAt = new Date().toISOString();
    managedEvent = clone(event);
    nextStatus = registration.status;

    return {
      result: registration.id
    };
  });

  if (managedEvent === null || nextStatus === null) {
    throw new Error("We could not update this registration.");
  }

  const finalizedEvent: StoredEvent = managedEvent;
  const finalizedStatus: CampusEventRegistrationStatus = nextStatus;
  const sortedRegistrations = clone(
    [...finalizedEvent.registrations].sort(
      (left: StoredRegistration, right: StoredRegistration) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    )
  );

  return {
    dashboard: buildDashboard(store, viewer),
    event: toCampusEvent(finalizedEvent, viewer),
    registrations: sortedRegistrations,
    registrationId,
    status: finalizedStatus
  };
}

export async function exportCampusEventRegistrationsCsv(
  viewer: DevSession,
  eventId: string,
  filters?: {
    query?: string | null;
    statuses?: CampusEventRegistrationStatus[];
  }
) {
  const store = await ensureTenantSeeded(viewer.tenantId);
  const event = getStoredEventOrThrow(store, viewer, eventId);
  ensureHostAccess(event, viewer);
  return buildRegistrationsCsv({
    ...event,
    registrations: filterRegistrations(event.registrations, filters?.query, filters?.statuses)
  });
}

async function manageEvent(viewer: DevSession, eventId: string, action: "cancelled" | "deleted"): Promise<ManageCampusEventResponse> {
  let removableMedia: CampusEventMediaAsset[] = [];
  const { store } = await transactStore(viewer.tenantId, (store) => {
    seedTenantStoreIfEmpty(store, viewer.tenantId);
    const event = getStoredEventOrThrow(store, viewer, eventId);
    ensureHostAccess(event, viewer);

    event.status = action;
    removableMedia = action === "deleted" ? [...event.media] : [];

    return {
      result: event.id
    };
  });

  if (removableMedia.length > 0) {
    await deleteEventMediaAssets(removableMedia).catch(() => undefined);
  }

  return {
    dashboard: buildDashboard(store, viewer),
    eventId,
    action
  };
}

export async function cancelCampusEvent(viewer: DevSession, eventId: string) {
  return manageEvent(viewer, eventId, "cancelled");
}

export async function deleteCampusEvent(viewer: DevSession, eventId: string) {
  return manageEvent(viewer, eventId, "deleted");
}
