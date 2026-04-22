import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  CampusEvent,
  CampusEventMediaAsset,
  CampusEventPassKind,
  CampusEventStatus,
  CampusEventsDashboardResponse,
  CreateCampusEventRequest,
  CreateCampusEventResponse,
  ManageCampusEventResponse,
  ToggleCampusEventInterestResponse,
  ToggleCampusEventSaveResponse,
  UpdateCampusEventRequest,
  UpdateCampusEventResponse
} from "@vyb/contracts";
import type { DevSession } from "./dev-session";
import { deleteEventMediaAssets } from "./events-media-server";
import type { EventViewerIdentity } from "./events-types";

type StoredEvent = Omit<CampusEvent, "savedCount" | "interestCount" | "isSaved" | "isInterested" | "isHostedByViewer" | "status"> & {
  status: Exclude<CampusEventStatus, "ended">;
  savedByUserIds: string[];
  interestedUserIds: string[];
};

type EventStore = {
  events: StoredEvent[];
};

const storePath = path.resolve(process.cwd(), "../../data/events-store.json");
const defaultStore: EventStore = {
  events: []
};

const seedMediaByCategory: Record<string, string> = {
  Cultural: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80&auto=format&fit=crop",
  Tech: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80&auto=format&fit=crop",
  Workshop: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80&auto=format&fit=crop",
  Sports: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80&auto=format&fit=crop",
  Film: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&q=80&auto=format&fit=crop"
};

let storeCache: EventStore | null = null;
let writeQueue = Promise.resolve();

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

function buildSeedEvents(tenantId: string): StoredEvent[] {
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
      interestedUserIds: ["seed-1", "seed-2", "seed-3", "seed-4", "seed-5", "seed-6", "seed-7"]
    },
    {
      id: `event-${tenantId}-2`,
      tenantId,
      host: {
        userId: "seed-codecell",
        username: "codecell.live",
        displayName: "CodeCell",
        role: "student"
      },
      title: "Hack Sprint Zero",
      club: "CodeCell",
      category: "Tech",
      description: "A quick pre-hackathon mixer with demo tables, team matching, and a fast mentor round.",
      location: "Innovation lab",
      startsAt: hoursFromNow(30),
      endsAt: hoursFromNow(35),
      media: buildSeedMedia("Tech"),
      passKind: "rsvp",
      passLabel: "RSVP needed",
      capacity: 300,
      commentCount: 39,
      status: "published",
      createdAt: nowMinusMinutes(90),
      savedByUserIds: [],
      interestedUserIds: ["seed-8", "seed-9", "seed-10", "seed-11"]
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
      passLabel: "Seats limited",
      capacity: 180,
      commentCount: 26,
      status: "published",
      createdAt: nowMinusMinutes(140),
      savedByUserIds: [],
      interestedUserIds: ["seed-12", "seed-13", "seed-14"]
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
      interestedUserIds: ["seed-15", "seed-16"]
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
      interestedUserIds: ["seed-17", "seed-18", "seed-19"]
    }
  ];
}

function normalizeText(value: string | null | undefined, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
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

function toCampusEvent(event: StoredEvent, viewer?: Pick<DevSession, "userId">): CampusEvent {
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
    commentCount: event.commentCount,
    status: getEventEffectiveStatus(event),
    createdAt: event.createdAt,
    savedCount: event.savedByUserIds.length,
    interestCount: event.interestedUserIds.length,
    isSaved: viewer ? event.savedByUserIds.includes(viewer.userId) : false,
    isInterested: viewer ? event.interestedUserIds.includes(viewer.userId) : false,
    isHostedByViewer: viewer ? event.host.userId === viewer.userId : false
  };
}

async function loadStore() {
  if (storeCache) {
    return storeCache;
  }

  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<EventStore>;
    storeCache = {
      events: Array.isArray(parsed.events) ? parsed.events : []
    };
  } catch {
    storeCache = clone(defaultStore);
  }

  return storeCache;
}

async function saveStore(nextStore: EventStore) {
  storeCache = nextStore;
  await mkdir(path.dirname(storePath), { recursive: true });
  writeQueue = writeQueue.then(() => writeFile(storePath, `${JSON.stringify(nextStore, null, 2)}\n`, "utf8"));
  await writeQueue;
}

async function ensureTenantSeeded(tenantId: string) {
  const store = await loadStore();

  if (!store.events.some((event) => event.tenantId === tenantId)) {
    store.events.push(...buildSeedEvents(tenantId));
    await saveStore(store);
  }

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
      interestedCount: publicEvents.filter((event) => event.isInterested).length,
      hostedCount: hostedEvents.length
    },
    events: publicEvents,
    hostedEvents,
    categories: dedupeSortedCategories(publicEvents.filter((event) => event.status !== "cancelled").map((event) => event.category))
  };
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

export async function createCampusEvent(
  viewer: DevSession,
  identity: EventViewerIdentity,
  payload: CreateCampusEventRequest
): Promise<CreateCampusEventResponse> {
  const store = await ensureTenantSeeded(viewer.tenantId);
  const eventId = makeId("event");

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
    capacity: typeof payload.capacity === "number" && Number.isFinite(payload.capacity) ? payload.capacity : null,
    commentCount: 0,
    status: "published",
    createdAt: new Date().toISOString(),
    savedByUserIds: [],
    interestedUserIds: []
  });

  await saveStore(store);

  return {
    dashboard: buildDashboard(store, viewer),
    eventId
  };
}

export async function updateCampusEvent(
  viewer: DevSession,
  payload: UpdateCampusEventRequest
): Promise<UpdateCampusEventResponse> {
  const store = await ensureTenantSeeded(viewer.tenantId);
  const event = store.events.find((candidate) => candidate.id === payload.eventId && candidate.tenantId === viewer.tenantId && candidate.status !== "deleted");

  if (!event) {
    throw new Error("This event could not be found.");
  }

  if (event.host.userId !== viewer.userId) {
    throw new Error("Only the event host can edit this event.");
  }

  const keepIds = new Set(payload.keepMediaIds ?? event.media.map((media) => media.id));
  const removable = event.media.filter((media) => !keepIds.has(media.id));

  event.title = normalizeText(payload.title);
  event.club = normalizeText(payload.club);
  event.category = normalizeText(payload.category);
  event.description = normalizeText(payload.description);
  event.location = normalizeText(payload.location);
  event.startsAt = payload.startsAt;
  event.endsAt = payload.endsAt?.trim() || null;
  event.passKind = payload.passKind;
  event.passLabel = buildPassLabel(payload.passKind, payload.passLabel);
  event.capacity = typeof payload.capacity === "number" && Number.isFinite(payload.capacity) ? payload.capacity : null;
  event.media = [...event.media.filter((media) => keepIds.has(media.id)), ...(payload.media ?? [])];

  await saveStore(store);

  if (removable.length > 0) {
    await deleteEventMediaAssets(removable).catch(() => undefined);
  }

  return {
    dashboard: buildDashboard(store, viewer),
    eventId: event.id
  };
}

export async function toggleCampusEventSave(viewer: DevSession, eventId: string): Promise<ToggleCampusEventSaveResponse> {
  const store = await ensureTenantSeeded(viewer.tenantId);
  const event = store.events.find((candidate) => candidate.id === eventId && candidate.tenantId === viewer.tenantId && candidate.status === "published");

  if (!event) {
    throw new Error("Choose a valid event to save.");
  }

  const alreadySaved = event.savedByUserIds.includes(viewer.userId);
  event.savedByUserIds = alreadySaved ? event.savedByUserIds.filter((userId) => userId !== viewer.userId) : [...event.savedByUserIds, viewer.userId];
  await saveStore(store);

  return {
    dashboard: buildDashboard(store, viewer),
    eventId,
    isSaved: !alreadySaved
  };
}

export async function toggleCampusEventInterest(viewer: DevSession, eventId: string): Promise<ToggleCampusEventInterestResponse> {
  const store = await ensureTenantSeeded(viewer.tenantId);
  const event = store.events.find((candidate) => candidate.id === eventId && candidate.tenantId === viewer.tenantId && candidate.status === "published");

  if (!event) {
    throw new Error("Choose a valid event before updating your RSVP.");
  }

  const alreadyInterested = event.interestedUserIds.includes(viewer.userId);
  event.interestedUserIds = alreadyInterested
    ? event.interestedUserIds.filter((userId) => userId !== viewer.userId)
    : [...event.interestedUserIds, viewer.userId];
  await saveStore(store);

  return {
    dashboard: buildDashboard(store, viewer),
    eventId,
    isInterested: !alreadyInterested
  };
}

async function manageEvent(viewer: DevSession, eventId: string, action: "cancelled" | "deleted"): Promise<ManageCampusEventResponse> {
  const store = await ensureTenantSeeded(viewer.tenantId);
  const event = store.events.find((candidate) => candidate.id === eventId && candidate.tenantId === viewer.tenantId && candidate.status !== "deleted");

  if (!event) {
    throw new Error("This event could not be found.");
  }

  if (event.host.userId !== viewer.userId) {
    throw new Error("Only the host can manage this event.");
  }

  event.status = action;
  await saveStore(store);

  if (action === "deleted" && event.media.length > 0) {
    await deleteEventMediaAssets(event.media).catch(() => undefined);
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
