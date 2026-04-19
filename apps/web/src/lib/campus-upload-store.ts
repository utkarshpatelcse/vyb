"use client";

export type CampusUploadKind = "post" | "story" | "vibe";
export type CampusUploadMediaKind = "image" | "video" | null;

export type CampusQueuedUpload = {
  id: string;
  author: string;
  caption: string;
  createdAt: string;
  durationSeconds?: number | null;
  kind: CampusUploadKind;
  location: string;
  mediaKind: CampusUploadMediaKind;
  mediaUrl: string | null;
  title?: string | null;
};

const STORAGE_KEY = "vyb-campus-upload-queue";

function readQueue() {
  if (typeof window === "undefined") {
    return [] as CampusQueuedUpload[];
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [] as CampusQueuedUpload[];
  }

  try {
    const parsed = JSON.parse(raw) as CampusQueuedUpload[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as CampusQueuedUpload[];
  }
}

function writeQueue(items: CampusQueuedUpload[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function queueCampusUpload(item: CampusQueuedUpload) {
  const current = readQueue();
  current.unshift(item);
  writeQueue(current);
}

export function consumeCampusUploads(kinds: CampusUploadKind[]) {
  const requestedKinds = new Set(kinds);
  const current = readQueue();
  const matched: CampusQueuedUpload[] = [];
  const remaining: CampusQueuedUpload[] = [];

  for (const item of current) {
    if (requestedKinds.has(item.kind)) {
      matched.push(item);
      continue;
    }

    remaining.push(item);
  }

  writeQueue(remaining);
  return matched;
}
