"use client";

import type { CampusUploadKind } from "./campus-upload-store";
import { prepareSocialUploadFile, uploadSocialMediaAsset } from "./social-media-client";
import {
  composeStoryMusicVideo,
  type StoryMusicStickerPosition,
  type StoryMusicTrack
} from "./story-music";

export type BackgroundPublishTaskStatus =
  | "queued"
  | "preparing"
  | "uploading"
  | "publishing"
  | "success"
  | "error";

export type BackgroundPublishTask = {
  id: string;
  kind: CampusUploadKind;
  title: string;
  detail: string;
  progress: number;
  status: BackgroundPublishTaskStatus;
  createdAt: string;
  completedAt: string | null;
  successMessage: string | null;
  errorMessage: string | null;
};

type StoryUploadAsset = {
  file: File;
  mediaType: "image" | "video";
  mimeType: string | null;
};

type StoryMusicBackgroundPayload = {
  visualFile: File;
  visualKind: "image" | "video";
  track: StoryMusicTrack;
  clipDurationSeconds: number;
  trimStartSeconds: number;
  stickerPosition: StoryMusicStickerPosition;
};

export type BackgroundPublishRequest =
  | {
      kind: "vibe";
      caption: string;
      collegeName: string;
      videoFile: File;
    }
  | {
      kind: "story";
      caption: string;
      storyAssets: StoryUploadAsset[];
      storyMusic: StoryMusicBackgroundPayload | null;
    }
  | {
      kind: "post";
      caption: string;
      collegeName: string;
      mediaFiles: File[];
    };

const AUTO_DISMISS_SUCCESS_MS = 7000;
const AUTO_DISMISS_ERROR_MS = 12000;

const tasks: BackgroundPublishTask[] = [];
const listeners = new Set<(items: BackgroundPublishTask[]) => void>();
const payloadByTaskId = new Map<string, BackgroundPublishRequest>();
const queuedTaskIds: string[] = [];
let activeTaskId: string | null = null;

function createTaskId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `publish-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function clampProgress(value: number) {
  return Math.min(1, Math.max(0, value));
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function buildTaskTitle(input: BackgroundPublishRequest) {
  const trimmedCaption = input.caption.trim();
  if (trimmedCaption) {
    return trimmedCaption.slice(0, 64);
  }

  if (input.kind === "vibe") {
    return "Campus vibe";
  }

  if (input.kind === "story") {
    return "Campus story";
  }

  return input.mediaFiles.length > 0 ? "Campus moment" : "Text post";
}

function buildTaskQueuedDetail(input: BackgroundPublishRequest) {
  if (input.kind === "story" && input.storyMusic) {
    return "Queued. Music story render will continue in background.";
  }

  if (input.kind === "vibe" || input.kind === "story") {
    return "Queued. Optimization and upload will continue in background.";
  }

  return "Queued. Upload will continue in background.";
}

function buildTaskSuccessMessage(kind: CampusUploadKind) {
  if (kind === "vibe") {
    return "Vibe posted successfully.";
  }

  if (kind === "story") {
    return "Story posted successfully.";
  }

  return "Post published successfully.";
}

function notifyListeners() {
  const snapshot = getBackgroundPublishTasks();
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function updateTask(taskId: string, patch: Partial<BackgroundPublishTask>) {
  const target = tasks.find((item) => item.id === taskId);
  if (!target) {
    return;
  }

  Object.assign(target, patch);
  notifyListeners();
}

function scheduleTaskDismiss(taskId: string, timeoutMs: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.setTimeout(() => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || isBackgroundPublishTaskActive(task.status)) {
      return;
    }

    dismissBackgroundPublishTask(taskId);
  }, timeoutMs);
}

function markTaskSuccess(taskId: string, message: string) {
  updateTask(taskId, {
    status: "success",
    detail: message,
    progress: 1,
    completedAt: new Date().toISOString(),
    successMessage: message,
    errorMessage: null
  });
  scheduleTaskDismiss(taskId, AUTO_DISMISS_SUCCESS_MS);
}

function markTaskFailure(taskId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "We could not publish this item right now.";
  updateTask(taskId, {
    status: "error",
    detail: message,
    completedAt: new Date().toISOString(),
    successMessage: null,
    errorMessage: message
  });
  scheduleTaskDismiss(taskId, AUTO_DISMISS_ERROR_MS);
}

async function postJson(path: string, payload: unknown, fallbackMessage: string) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const parsed = (await response.json().catch(() => null)) as
    | {
        error?: {
          message?: string;
        };
      }
    | null;

  if (!response.ok) {
    throw new Error(parsed?.error?.message ?? fallbackMessage);
  }

  return parsed;
}

async function runVibePublish(taskId: string, input: Extract<BackgroundPublishRequest, { kind: "vibe" }>) {
  updateTask(taskId, {
    status: "preparing",
    detail: "Optimizing vibe video in background...",
    progress: 0.14
  });

  const preparedVideo = await prepareSocialUploadFile(input.videoFile);

  updateTask(taskId, {
    status: "uploading",
    detail: "Uploading vibe video...",
    progress: 0.34
  });

  const uploadedMedia = await uploadSocialMediaAsset(preparedVideo.file, "vibe");
  const trimmedCaption = input.caption.trim();

  updateTask(taskId, {
    status: "publishing",
    detail: "Publishing vibe to the campus lane...",
    progress: 0.82
  });

  await postJson(
    "/api/vibes",
    {
      title: trimmedCaption ? trimmedCaption.slice(0, 72) : null,
      body: trimmedCaption || "Fresh campus vibe.",
      mediaUrl: uploadedMedia?.url ?? null,
      mediaStoragePath: uploadedMedia?.storagePath ?? null,
      mediaMimeType: uploadedMedia?.mimeType ?? null,
      mediaSizeBytes: uploadedMedia?.sizeBytes ?? null,
      location: input.collegeName
    },
    "Could not publish Vibe."
  );
}

async function runStoryPublish(taskId: string, input: Extract<BackgroundPublishRequest, { kind: "story" }>) {
  let normalizedStoryAssets = input.storyAssets;

  if (input.storyMusic) {
    updateTask(taskId, {
      status: "preparing",
      detail: "Rendering music story clip...",
      progress: 0.14
    });

    const composed = await composeStoryMusicVideo({
      ...input.storyMusic,
      onStatus: (status) => {
        updateTask(taskId, {
          status: "preparing",
          detail: status,
          progress: 0.18
        });
      }
    });

    normalizedStoryAssets = [
      {
        file: composed.file,
        mediaType: "video",
        mimeType: composed.file.type || "video/mp4"
      }
    ];
  }

  if (normalizedStoryAssets.some((asset) => asset.mediaType === "video")) {
    updateTask(taskId, {
      status: "preparing",
      detail:
        normalizedStoryAssets.length === 1
          ? "Optimizing story video in background..."
          : "Optimizing story videos in background...",
      progress: input.storyMusic ? 0.28 : 0.14
    });

    normalizedStoryAssets = await Promise.all(
      normalizedStoryAssets.map(async (asset, index) => {
        if (asset.mediaType !== "video") {
          return asset;
        }

        updateTask(taskId, {
          status: "preparing",
          detail:
            normalizedStoryAssets.length === 1
              ? "Optimizing story video in background..."
              : `Optimizing story video ${index + 1}/${normalizedStoryAssets.length}...`,
          progress: input.storyMusic ? 0.28 : 0.14
        });

        const prepared = await prepareSocialUploadFile(asset.file);
        return {
          ...asset,
          file: prepared.file,
          mimeType: prepared.file.type || asset.mimeType
        };
      })
    );
  }

  const totalUploads = normalizedStoryAssets.length;
  let completedUploads = 0;

  updateTask(taskId, {
    status: "uploading",
    detail: `Uploading 0/${totalUploads} ${pluralize(totalUploads, "story item")}...`,
    progress: 0.34
  });

  const uploadedMediaAssets = await Promise.all(
    normalizedStoryAssets.map(async (asset) => {
      const uploaded = await uploadSocialMediaAsset(asset.file, "story");
      completedUploads += 1;
      const uploadProgress = totalUploads === 0 ? 1 : completedUploads / totalUploads;

      updateTask(taskId, {
        status: "uploading",
        detail: `Uploading ${completedUploads}/${totalUploads} ${pluralize(totalUploads, "story item")}...`,
        progress: 0.34 + uploadProgress * 0.36
      });

      return {
        mediaType: asset.mediaType,
        mediaUrl: uploaded?.url ?? "",
        mediaStoragePath: uploaded?.storagePath ?? null,
        mediaMimeType: uploaded?.mimeType ?? asset.mimeType ?? null,
        mediaSizeBytes: uploaded?.sizeBytes ?? null
      };
    })
  );

  const trimmedCaption = input.caption.trim();

  for (let index = 0; index < uploadedMediaAssets.length; index += 1) {
    const publishProgress =
      uploadedMediaAssets.length === 0 ? 1 : (index + 1) / uploadedMediaAssets.length;
    const asset = uploadedMediaAssets[index];

    updateTask(taskId, {
      status: "publishing",
      detail: `Publishing story ${index + 1}/${uploadedMediaAssets.length}...`,
      progress: 0.76 + publishProgress * 0.2
    });

    await postJson(
      "/api/stories",
      {
        mediaType: asset.mediaType,
        mediaUrl: asset.mediaUrl,
        mediaStoragePath: asset.mediaStoragePath ?? null,
        mediaMimeType: asset.mediaMimeType ?? null,
        mediaSizeBytes: asset.mediaSizeBytes ?? null,
        caption: trimmedCaption || null
      },
      "Could not publish Story."
    );
  }
}

async function runPostPublish(taskId: string, input: Extract<BackgroundPublishRequest, { kind: "post" }>) {
  const totalUploads = input.mediaFiles.length;
  let uploadedMediaAssets: Array<{
    url: string;
    kind: "image";
    storagePath: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
  }> = [];

  if (totalUploads > 0) {
    let completedUploads = 0;

    updateTask(taskId, {
      status: "uploading",
      detail: `Uploading 0/${totalUploads} ${pluralize(totalUploads, "photo")}...`,
      progress: 0.2
    });

    uploadedMediaAssets = await Promise.all(
      input.mediaFiles.map(async (file) => {
        const uploaded = await uploadSocialMediaAsset(file, "post");
        completedUploads += 1;
        const uploadProgress = completedUploads / totalUploads;

        updateTask(taskId, {
          status: "uploading",
          detail: `Uploading ${completedUploads}/${totalUploads} ${pluralize(totalUploads, "photo")}...`,
          progress: 0.2 + uploadProgress * 0.48
        });

        return {
          url: uploaded?.url ?? "",
          kind: "image" as const,
          storagePath: uploaded?.storagePath ?? null,
          mimeType: uploaded?.mimeType ?? null,
          sizeBytes: uploaded?.sizeBytes ?? null
        };
      })
    );
  }

  const trimmedCaption = input.caption.trim();

  updateTask(taskId, {
    status: "publishing",
    detail: uploadedMediaAssets.length > 0 ? "Publishing post with media..." : "Publishing text post...",
    progress: 0.84
  });

  await postJson(
    "/api/posts",
    {
      title: trimmedCaption ? trimmedCaption.slice(0, 72) : "",
      body: trimmedCaption || "",
      kind: uploadedMediaAssets.length > 0 ? "image" : "text",
      mediaAssets: uploadedMediaAssets.length > 0 ? uploadedMediaAssets : undefined,
      location: input.collegeName
    },
    "Could not publish post."
  );
}

async function runBackgroundPublish(taskId: string, input: BackgroundPublishRequest) {
  updateTask(taskId, {
    status: "preparing",
    detail: "Starting background upload...",
    progress: 0.06
  });

  if (input.kind === "vibe") {
    await runVibePublish(taskId, input);
    markTaskSuccess(taskId, buildTaskSuccessMessage("vibe"));
    return;
  }

  if (input.kind === "story") {
    await runStoryPublish(taskId, input);
    markTaskSuccess(taskId, buildTaskSuccessMessage("story"));
    return;
  }

  await runPostPublish(taskId, input);
  markTaskSuccess(taskId, buildTaskSuccessMessage("post"));
}

function pumpBackgroundPublishQueue() {
  if (activeTaskId) {
    return;
  }

  const nextTaskId = queuedTaskIds.shift() ?? null;
  if (!nextTaskId) {
    return;
  }

  const payload = payloadByTaskId.get(nextTaskId);
  if (!payload) {
    pumpBackgroundPublishQueue();
    return;
  }

  activeTaskId = nextTaskId;

  void runBackgroundPublish(nextTaskId, payload)
    .catch((error) => {
      markTaskFailure(nextTaskId, error);
    })
    .finally(() => {
      payloadByTaskId.delete(nextTaskId);
      activeTaskId = null;
      notifyListeners();
      pumpBackgroundPublishQueue();
    });
}

export function getBackgroundPublishTasks() {
  return tasks.map((task) => ({ ...task }));
}

export function subscribeBackgroundPublishTasks(listener: (items: BackgroundPublishTask[]) => void) {
  listeners.add(listener);
  listener(getBackgroundPublishTasks());
  return () => {
    listeners.delete(listener);
  };
}

export function isBackgroundPublishTaskActive(status: BackgroundPublishTaskStatus) {
  return status === "queued" || status === "preparing" || status === "uploading" || status === "publishing";
}

export function enqueueBackgroundPublish(input: BackgroundPublishRequest) {
  const taskId = createTaskId();
  const task: BackgroundPublishTask = {
    id: taskId,
    kind: input.kind,
    title: buildTaskTitle(input),
    detail: buildTaskQueuedDetail(input),
    progress: 0.02,
    status: "queued",
    createdAt: new Date().toISOString(),
    completedAt: null,
    successMessage: null,
    errorMessage: null
  };

  tasks.unshift(task);
  payloadByTaskId.set(taskId, input);
  queuedTaskIds.push(taskId);
  notifyListeners();
  pumpBackgroundPublishQueue();
  return taskId;
}

export function dismissBackgroundPublishTask(taskId: string) {
  const taskIndex = tasks.findIndex((task) => task.id === taskId);
  if (taskIndex === -1) {
    return;
  }

  const task = tasks[taskIndex];
  if (isBackgroundPublishTaskActive(task.status)) {
    return;
  }

  tasks.splice(taskIndex, 1);
  payloadByTaskId.delete(taskId);
  notifyListeners();
}
