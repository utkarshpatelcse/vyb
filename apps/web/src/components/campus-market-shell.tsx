"use client";

import type {
  ContactMarketPostResponse,
  CreateMarketPostResponse,
  ManageMarketListingResponse,
  ManageMarketRequestResponse,
  MarketDashboardResponse,
  MarketListing,
  MarketMediaAsset,
  MarketRequest,
  MarketTab,
  UpdateMarketListingResponse,
  UpdateMarketRequestResponse,
  ToggleMarketSaveResponse
} from "@vyb/contracts";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ChangeEvent, type KeyboardEvent, type PointerEvent, type ReactNode, type TouchEvent } from "react";
import {
  MARKET_DEFAULT_CAMPUS_SPOT,
  hasExplicitMarketCampusSpot,
  hasExplicitMarketLocation
} from "../lib/market-defaults";
import { CampusAvatarContent, useResolvedAvatarUrl } from "./campus-avatar";
import { buildPrimaryCampusNav, CampusDesktopNavigation, CampusMobileNavigation } from "./campus-navigation";
import { SignOutButton } from "./sign-out-button";
import { VybLogoLockup } from "./vyb-logo";

type CampusMarketShellProps = {
  viewerName: string;
  viewerUsername: string;
  collegeName: string;
  viewerEmail: string;
  course?: string | null;
  stream?: string | null;
  role: string;
  initialDashboard: MarketDashboardResponse;
};

type ResizeSide = "left" | "right";
type MarketSort = "latest" | "value-low" | "value-high" | "az";
type MarketTarget = { type: "listing" | "request"; id: string } | null;
type MarketEditingTarget = { type: "listing" | "request"; id: string } | null;
type MarketComposerMode = "create" | "edit";
type MarketComposerState = {
  tab: MarketTab;
  title: string;
  category: string;
  description: string;
  condition: string;
  priceAmount: string;
  budgetAmount: string;
  budgetLabel: string;
  tag: string;
};

type MarketMediaPreview = {
  id: string;
  kind: "image" | "video";
  previewUrl: string;
  file: File | null;
  fileName: string;
  sizeBytes: number;
  source: "existing" | "upload";
  shouldRevoke: boolean;
};

const DEFAULT_LEFT_WIDTH = 260;
const DEFAULT_RIGHT_WIDTH = 320;
const MIN_LEFT_WIDTH = 220;
const MAX_LEFT_WIDTH = 360;
const MIN_RIGHT_WIDTH = 280;
const MAX_RIGHT_WIDTH = 420;
const LEFT_WIDTH_STORAGE_KEY = "vyb-campus-left-width";
const RIGHT_WIDTH_STORAGE_KEY = "vyb-campus-right-width";

const MARKET_CATEGORY_OPTIONS = ["Tech", "Study", "Fashion", "Room", "Books", "Other"];
const CONDITION_OPTIONS = ["Like new", "Lightly used", "Fresh set", "Good condition", "Barely used"];
const MAX_MARKET_MEDIA_ITEMS = 6;
const MAX_MARKET_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_MARKET_VIDEO_BYTES = 40 * 1024 * 1024;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatCurrency(amount: number | null | undefined) {
  if (!amount || amount <= 0) {
    return "Flexible";
  }

  return `Rs ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)}`;
}

function formatRelativeTime(createdAt: string) {
  const timestamp = new Date(createdAt).getTime();

  if (!Number.isFinite(timestamp)) {
    return "recently";
  }

  const diffMinutes = Math.max(1, Math.round((Date.now() - timestamp) / 60_000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short"
  }).format(new Date(createdAt));
}

function buildComposerState(tab: MarketTab): MarketComposerState {
  return {
    tab,
    title: "",
    category: "Tech",
    description: "",
    condition: "Good condition",
    priceAmount: "",
    budgetAmount: "",
    budgetLabel: "",
    tag: ""
  };
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
}

function sanitizeDigitsOnlyInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

function getMarketMediaKindFromMimeType(mimeType: string) {
  if (mimeType.startsWith("video/")) {
    return "video" as const;
  }

  if (mimeType.startsWith("image/")) {
    return "image" as const;
  }

  return null;
}

function getPrimaryMarketMedia(media: MarketMediaAsset[]) {
  return media[0] ?? null;
}

function clampMediaIndex(length: number, index: number) {
  if (length <= 0) {
    return 0;
  }

  return clamp(index, 0, length - 1);
}

function buildExistingMediaPreview(asset: MarketMediaAsset): MarketMediaPreview {
  return {
    id: asset.id,
    kind: asset.kind,
    previewUrl: asset.url,
    file: null,
    fileName: asset.fileName,
    sizeBytes: asset.sizeBytes,
    source: "existing",
    shouldRevoke: false
  };
}

function renderMediaPreview(media: MarketMediaAsset, title: string, className: string, options?: { controls?: boolean }) {
  if (media.kind === "video") {
    return <video src={media.url} className={className} muted playsInline preload="metadata" controls={options?.controls ?? false} />;
  }

  return <img src={media.url} alt={title} className={className} />;
}

function buildContactMessage(target: MarketTarget, listing: MarketListing | null, request: MarketRequest | null) {
  if (target?.type === "listing" && listing) {
    return `Hey @${listing.seller.username}, is "${listing.title}" still available?`;
  }

  if (target?.type === "request" && request) {
    return `Hi @${request.requester.username}, I can help with "${request.title}".`;
  }

  return "";
}

function getListingMeetupLine(listing: MarketListing) {
  if (hasExplicitMarketCampusSpot(listing.campusSpot)) {
    return listing.campusSpot;
  }

  return MARKET_DEFAULT_CAMPUS_SPOT;
}

function IconBase({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`vyb-campus-icon ${className}`.trim()}>
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

function FilterIcon() {
  return (
    <IconBase>
      <path d="M4 6h16M7.5 12h9M10.5 18h3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function SortIcon() {
  return (
    <IconBase>
      <path d="M8 5v14m0 0-2.6-2.8M8 19l2.6-2.8M16 19V5m0 0-2.6 2.8M16 5l2.6 2.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
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

function MarketIcon() {
  return (
    <IconBase>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 6h18M16 10a4 4 0 0 1-8 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

function SparkIcon() {
  return (
    <IconBase>
      <path d="M12 3.5 14 9l5.5 2-5.5 2-2 5.5-2-5.5-5.5-2L10 9l2-5.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function ChevronRightIcon() {
  return (
    <IconBase>
      <path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function ChevronLeftIcon() {
  return (
    <IconBase>
      <path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function PlusIcon() {
  return (
    <IconBase>
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </IconBase>
  );
}

function ClockIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.8v4.6l3 1.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function MessageIcon() {
  return (
    <IconBase>
      <path d="M5.8 17.8a7.7 7.7 0 1 1 3 1.1L4 20l1.8-4.2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function ImageIcon() {
  return (
    <IconBase>
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zm0 9 4.5-4.5 3 3 4.5-5.5 4 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9" r="1.6" fill="currentColor" />
    </IconBase>
  );
}

function VideoIcon() {
  return (
    <IconBase>
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4H14a2.5 2.5 0 0 1 2.5 2.5v1.2l3.5-2.1v12.8l-3.5-2.1v1.2A2.5 2.5 0 0 1 14 20H7.5A2.5 2.5 0 0 1 5 17.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function PackageIcon() {
  return (
    <IconBase>
      <path d="m12 3 7 3.8v10.4L12 21 5 17.2V6.8Zm0 0L5 6.8 12 11l7-4.2M12 11v10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function CloseIcon() {
  return (
    <IconBase>
      <path d="m7 7 10 10M17 7 7 17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

export function CampusMarketShell({
  viewerName,
  viewerUsername,
  collegeName,
  viewerEmail,
  course,
  stream,
  role,
  initialDashboard
}: CampusMarketShellProps) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [activeResize, setActiveResize] = useState<ResizeSide | null>(null);
  const [activeTab, setActiveTab] = useState<MarketTab>("sale");
  const [searchValue, setSearchValue] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortMode, setSortMode] = useState<MarketSort>("latest");
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<MarketComposerMode>("create");
  const [editingTarget, setEditingTarget] = useState<MarketEditingTarget>(null);
  const [composerState, setComposerState] = useState<MarketComposerState>(() => buildComposerState("sale"));
  const [composerMedia, setComposerMedia] = useState<MarketMediaPreview[]>([]);
  const [composerMessage, setComposerMessage] = useState<string | null>(null);
  const [isComposerSubmitting, setIsComposerSubmitting] = useState(false);
  const [detailTarget, setDetailTarget] = useState<MarketTarget>(null);
  const [detailMediaIndex, setDetailMediaIndex] = useState(0);
  const [isMediaViewerOpen, setIsMediaViewerOpen] = useState(false);
  const [mediaViewerOrigin, setMediaViewerOrigin] = useState<"card" | "detail" | null>(null);
  const [mediaViewerDragOffset, setMediaViewerDragOffset] = useState(0);
  const [isMediaViewerDragging, setIsMediaViewerDragging] = useState(false);
  const [cardMediaIndices, setCardMediaIndices] = useState<Record<string, number>>({});
  const [contactTarget, setContactTarget] = useState<MarketTarget>(null);
  const [contactMessage, setContactMessage] = useState("");
  const [contactError, setContactError] = useState<string | null>(null);
  const [isContactSubmitting, setIsContactSubmitting] = useState(false);
  const resizeState = useRef<{ side: ResizeSide; startX: number; startWidth: number } | null>(null);
  const mediaViewerSwipeStartX = useRef<number | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const composerMediaRef = useRef<MarketMediaPreview[]>([]);

  useEffect(() => {
    setDashboard(initialDashboard);
  }, [initialDashboard]);

  useEffect(() => {
    composerMediaRef.current = composerMedia;
  }, [composerMedia]);

  useEffect(() => {
    return () => {
      for (const item of composerMediaRef.current) {
        if (item.shouldRevoke) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
    };
  }, []);

  useEffect(() => {
    setCardMediaIndices((current) => {
      const next: Record<string, number> = {};

      for (const listing of dashboard.listings) {
        const currentIndex = current[listing.id] ?? 0;
        next[listing.id] = clampMediaIndex(listing.media.length, currentIndex);
      }

      return next;
    });
  }, [dashboard.listings]);

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
        const nextWidth = clamp(currentResize.startWidth + (event.clientX - currentResize.startX), MIN_LEFT_WIDTH, MAX_LEFT_WIDTH);
        setLeftWidth(nextWidth);
        return;
      }

      const nextWidth = clamp(currentResize.startWidth - (event.clientX - currentResize.startX), MIN_RIGHT_WIDTH, MAX_RIGHT_WIDTH);
      setRightWidth(nextWidth);
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

    const timeoutId = window.setTimeout(() => {
      setFlashMessage(null);
    }, 2800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [flashMessage]);

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

  function clearComposerMedia() {
    setComposerMedia((current) => {
      for (const item of current) {
        if (item.shouldRevoke) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }

      return [];
    });
  }

  function removeComposerMedia(previewId: string) {
    setComposerMedia((current) => {
      const target = current.find((item) => item.id === previewId);

      if (target?.shouldRevoke) {
        URL.revokeObjectURL(target.previewUrl);
      }

      return current.filter((item) => item.id !== previewId);
    });
  }

  function openComposerFilePicker() {
    mediaInputRef.current?.click();
  }

  function handleComposerFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const incomingFiles = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (incomingFiles.length === 0) {
      return;
    }

    setComposerMessage(null);

    setComposerMedia((current) => {
      const remainingSlots = MAX_MARKET_MEDIA_ITEMS - current.length;

      if (remainingSlots <= 0) {
        setComposerMessage(`You can upload up to ${MAX_MARKET_MEDIA_ITEMS} files in one market post.`);
        return current;
      }

      const accepted: MarketMediaPreview[] = [];

      for (const file of incomingFiles.slice(0, remainingSlots)) {
        const kind = getMarketMediaKindFromMimeType(file.type);

        if (!kind) {
          setComposerMessage("Only image and video files are supported.");
          continue;
        }

        const maxBytes = kind === "video" ? MAX_MARKET_VIDEO_BYTES : MAX_MARKET_IMAGE_BYTES;

        if (file.size > maxBytes) {
          setComposerMessage(
            kind === "video"
              ? `Keep each video under ${formatFileSize(MAX_MARKET_VIDEO_BYTES)}.`
              : `Keep each image under ${formatFileSize(MAX_MARKET_IMAGE_BYTES)}.`
          );
          continue;
        }

        accepted.push({
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          kind,
          previewUrl: URL.createObjectURL(file),
          file,
          fileName: file.name,
          sizeBytes: file.size,
          source: "upload",
          shouldRevoke: true
        });
      }

      return [...current, ...accepted];
    });
  }

  function openComposer(nextTab: MarketTab = activeTab) {
    clearComposerMedia();
    setComposerMode("create");
    setEditingTarget(null);
    setComposerState(buildComposerState(nextTab));
    setComposerMessage(null);
    setIsComposerOpen(true);
  }

  function openListingEditor(listing: MarketListing) {
    clearComposerMedia();
    setComposerMode("edit");
    setEditingTarget({ type: "listing", id: listing.id });
    setComposerState({
      tab: "sale",
      title: listing.title,
      category: listing.category,
      description: listing.description,
      condition: listing.condition,
      priceAmount: String(listing.priceAmount),
      budgetAmount: "",
      budgetLabel: "",
      tag: ""
    });
    setComposerMedia(listing.media.map(buildExistingMediaPreview));
    setComposerMessage(null);
    setIsComposerOpen(true);
  }

  function openRequestEditor(request: MarketRequest) {
    clearComposerMedia();
    setComposerMode("edit");
    setEditingTarget({ type: "request", id: request.id });
    setComposerState({
      tab: request.tab,
      title: request.title,
      category: request.category,
      description: request.detail,
      condition: "Good condition",
      priceAmount: "",
      budgetAmount: request.budgetAmount ? String(request.budgetAmount) : "",
      budgetLabel: request.budgetLabel,
      tag: request.tag
    });
    setComposerMedia(request.media.map(buildExistingMediaPreview));
    setComposerMessage(null);
    setIsComposerOpen(true);
  }

  function openDetailSheet(target: { type: "listing" | "request"; id: string }, mediaIndex = 0) {
    setDetailTarget(target);
    setDetailMediaIndex(mediaIndex);
    setIsMediaViewerOpen(false);
    setMediaViewerOrigin(null);
    setMediaViewerDragOffset(0);
    setIsMediaViewerDragging(false);
  }

  function closeDetailSheet() {
    setDetailTarget(null);
    setDetailMediaIndex(0);
    setIsMediaViewerOpen(false);
    setMediaViewerOrigin(null);
    setMediaViewerDragOffset(0);
    setIsMediaViewerDragging(false);
    mediaViewerSwipeStartX.current = null;
  }

  function closeComposer() {
    clearComposerMedia();
    setIsComposerOpen(false);
    setComposerMode("create");
    setEditingTarget(null);
    setComposerMessage(null);
    setComposerState(buildComposerState(activeTab === "sale" ? "sale" : activeTab));
  }

  function openContactSheet(target: { type: "listing" | "request"; id: string }) {
    const listing = target.type === "listing" ? dashboard.listings.find((item) => item.id === target.id) ?? null : null;
    const request = target.type === "request" ? dashboard.requests.find((item) => item.id === target.id) ?? null : null;

    setContactTarget(target);
    setContactError(null);
    setContactMessage(buildContactMessage(target, listing, request));
  }

  function setCardMediaIndex(listingId: string, mediaLength: number, index: number) {
    setCardMediaIndices((current) => ({
      ...current,
      [listingId]: clampMediaIndex(mediaLength, index)
    }));
  }

  function handleListingCardKeyDown(event: KeyboardEvent<HTMLElement>, listingId: string, mediaIndex: number) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openDetailSheet({ type: "listing", id: listingId }, mediaIndex);
  }

  const navItems = buildPrimaryCampusNav("market");

  const saleCategories = ["All", ...new Set(dashboard.listings.map((item) => item.category))];
  const requestCategories = [
    "All",
    ...new Set(dashboard.requests.filter((request) => request.tab === activeTab).map((request) => request.category))
  ];
  const categoryOptions = activeTab === "sale" ? saleCategories : requestCategories;

  useEffect(() => {
    if (!categoryOptions.includes(activeCategory)) {
      setActiveCategory("All");
    }
  }, [activeCategory, categoryOptions]);

  const normalizedQuery = searchValue.trim().toLowerCase();

  const filteredItems = dashboard.listings.filter((item) => {
    const matchesCategory = activeCategory === "All" || item.category === activeCategory;
    const haystack =
      `${item.title} ${item.description} ${item.location} ${item.seller.username} ${item.condition} ${item.category} ${item.campusSpot}`.toLowerCase();
    const matchesSearch = !normalizedQuery || haystack.includes(normalizedQuery);

    return matchesCategory && matchesSearch;
  });

  const filteredRequests = dashboard.requests.filter((request) => request.tab === activeTab).filter((request) => {
    const matchesCategory = activeCategory === "All" || request.category === activeCategory;
    const haystack =
      `${request.title} ${request.detail} ${request.budgetLabel} ${request.requester.username} ${request.category} ${request.campusSpot}`.toLowerCase();
    const matchesSearch = !normalizedQuery || haystack.includes(normalizedQuery);

    return matchesCategory && matchesSearch;
  });

  const sortedItems = [...filteredItems].sort((left, right) => {
    if (sortMode === "value-low") {
      return left.priceAmount - right.priceAmount;
    }

    if (sortMode === "value-high") {
      return right.priceAmount - left.priceAmount;
    }

    if (sortMode === "az") {
      return left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  const sortedRequests = [...filteredRequests].sort((left, right) => {
    if (sortMode === "value-low") {
      return (left.budgetAmount ?? Number.POSITIVE_INFINITY) - (right.budgetAmount ?? Number.POSITIVE_INFINITY);
    }

    if (sortMode === "value-high") {
      return (right.budgetAmount ?? Number.NEGATIVE_INFINITY) - (left.budgetAmount ?? Number.NEGATIVE_INFINITY);
    }

    if (sortMode === "az") {
      return left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  const visibleCount = activeTab === "sale" ? sortedItems.length : sortedRequests.length;
  const identityLine = [course, stream].filter(Boolean).join(" / ") || collegeName;
  const viewerAvatarUrl = useResolvedAvatarUrl({
    username: viewerUsername,
    email: viewerEmail
  });
  const tabCounts = {
    sale: dashboard.listings.length,
    buying: dashboard.requests.filter((request) => request.tab === "buying").length,
    lend: dashboard.requests.filter((request) => request.tab === "lend").length
  };
  const activeEntries = [
    ...dashboard.viewerActiveListings.map((item) => ({
      type: "listing" as const,
      id: item.id,
      title: item.title,
      meta: `${item.category} / ${formatCurrency(item.priceAmount)}`,
      createdAt: item.createdAt
    })),
    ...dashboard.viewerActiveRequests.map((request) => ({
      type: "request" as const,
      id: request.id,
      title: request.title,
      meta: `${request.tab === "buying" ? "Request" : "Lend"} / ${request.category}`,
      createdAt: request.createdAt
    }))
  ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  const selectedListing = detailTarget?.type === "listing" ? dashboard.listings.find((item) => item.id === detailTarget.id) ?? null : null;
  const selectedRequest = detailTarget?.type === "request" ? dashboard.requests.find((item) => item.id === detailTarget.id) ?? null : null;
  const detailMedia = selectedListing?.media ?? selectedRequest?.media ?? [];
  const activeDetailMedia = detailMedia[clampMediaIndex(detailMedia.length, detailMediaIndex)] ?? null;
  const detailTitle = selectedListing?.title ?? selectedRequest?.title ?? "Market media";
  const contactListing = contactTarget?.type === "listing" ? dashboard.listings.find((item) => item.id === contactTarget.id) ?? null : null;
  const contactRequest = contactTarget?.type === "request" ? dashboard.requests.find((item) => item.id === contactTarget.id) ?? null : null;
  const isEditingListing = composerMode === "edit" && editingTarget?.type === "listing";
  const isEditingRequest = composerMode === "edit" && editingTarget?.type === "request";

  useEffect(() => {
    setDetailMediaIndex((current) => clampMediaIndex(detailMedia.length, current));

    if (detailMedia.length === 0) {
      setIsMediaViewerOpen(false);
    }
  }, [detailMedia.length]);

  function getWrappedDetailMedia(index: number) {
    if (detailMedia.length === 0) {
      return null;
    }

    const normalizedIndex = ((index % detailMedia.length) + detailMedia.length) % detailMedia.length;
    return detailMedia[normalizedIndex] ?? null;
  }

  function setActiveDetailMediaIndex(index: number) {
    setDetailMediaIndex(clampMediaIndex(detailMedia.length, index));
    setMediaViewerDragOffset(0);
    setIsMediaViewerDragging(false);
  }

  function shiftDetailMedia(step: number) {
    if (detailMedia.length <= 1) {
      return;
    }

    setDetailMediaIndex((current) => {
      const currentIndex = clampMediaIndex(detailMedia.length, current);
      return (currentIndex + step + detailMedia.length) % detailMedia.length;
    });
    setMediaViewerDragOffset(0);
    setIsMediaViewerDragging(false);
  }

  function openMediaViewer(index = detailMediaIndex) {
    if (detailMedia.length === 0) {
      return;
    }

    setDetailMediaIndex(clampMediaIndex(detailMedia.length, index));
    setIsMediaViewerOpen(true);
    setMediaViewerOrigin("detail");
    setMediaViewerDragOffset(0);
    setIsMediaViewerDragging(false);
  }

  function openListingMediaViewer(listingId: string, index: number) {
    setDetailTarget({ type: "listing", id: listingId });
    setDetailMediaIndex(index);
    setIsMediaViewerOpen(true);
    setMediaViewerOrigin("card");
    setMediaViewerDragOffset(0);
    setIsMediaViewerDragging(false);
  }

  function closeMediaViewer() {
    if (mediaViewerOrigin === "card") {
      setDetailTarget(null);
      setDetailMediaIndex(0);
    }

    setIsMediaViewerOpen(false);
    setMediaViewerOrigin(null);
    setMediaViewerDragOffset(0);
    setIsMediaViewerDragging(false);
    mediaViewerSwipeStartX.current = null;
  }

  function handleMediaViewerTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (detailMedia.length <= 1) {
      return;
    }

    mediaViewerSwipeStartX.current = event.changedTouches[0]?.clientX ?? null;
    setIsMediaViewerDragging(true);
    setMediaViewerDragOffset(0);
  }

  function handleMediaViewerTouchMove(event: TouchEvent<HTMLDivElement>) {
    const startX = mediaViewerSwipeStartX.current;

    if (startX === null || detailMedia.length <= 1) {
      return;
    }

    const nextX = event.changedTouches[0]?.clientX ?? startX;
    setMediaViewerDragOffset(nextX - startX);
  }

  function handleMediaViewerTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const startX = mediaViewerSwipeStartX.current;
    mediaViewerSwipeStartX.current = null;
    setIsMediaViewerDragging(false);

    if (startX === null || detailMedia.length <= 1) {
      setMediaViewerDragOffset(0);
      return;
    }

    const endX = event.changedTouches[0]?.clientX ?? startX;
    const deltaX = endX - startX;

    if (Math.abs(deltaX) < 42) {
      setMediaViewerDragOffset(0);
      return;
    }

    shiftDetailMedia(deltaX < 0 ? 1 : -1);
  }

  useEffect(() => {
    if (!isMediaViewerOpen) {
      return;
    }

    function handleMediaViewerKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMediaViewer();
        return;
      }

      if (detailMedia.length <= 1) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        shiftDetailMedia(1);
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        shiftDetailMedia(-1);
      }
    }

    window.addEventListener("keydown", handleMediaViewerKeyDown);

    return () => {
      window.removeEventListener("keydown", handleMediaViewerKeyDown);
    };
  }, [isMediaViewerOpen, detailMedia.length]);

  async function handleComposerSubmit() {
    const title = composerState.title.trim();
    const category = composerState.category.trim();
    const description = composerState.description.trim();
    const priceAmount = composerState.priceAmount.trim() ? Number(composerState.priceAmount) : null;
    const budgetAmount = composerState.budgetAmount.trim() ? Number(composerState.budgetAmount) : null;

    if (!title) {
      setComposerMessage("Add a title so people know what this post is about.");
      return;
    }

    if (!category) {
      setComposerMessage("Choose a category for the market post.");
      return;
    }

    if (!description) {
      setComposerMessage("Add a short description with the most useful details.");
      return;
    }

    if (composerState.tab === "sale") {
      if (!Number.isFinite(priceAmount) || priceAmount === null || priceAmount <= 0) {
        setComposerMessage("Add a valid price for the listing.");
        return;
      }
    }

    if (budgetAmount !== null && (!Number.isFinite(budgetAmount) || budgetAmount < 0)) {
      setComposerMessage("Budget must be a positive number.");
      return;
    }

    setComposerMessage(null);
    setIsComposerSubmitting(true);

    try {
      if (composerMode === "edit") {
        if (!editingTarget) {
          setComposerMessage("We could not find that market post to edit.");
          return;
        }

        const formData = new FormData();
        formData.set("tab", composerState.tab);
        formData.set("title", title);
        formData.set("category", category);
        formData.set("description", description);

        if (editingTarget.type === "listing" && composerState.condition.trim()) {
          formData.set("condition", composerState.condition.trim());
        }

        if (editingTarget.type === "listing" && priceAmount !== null) {
          formData.set("priceAmount", String(priceAmount));
        }

        if (editingTarget.type === "request" && budgetAmount !== null) {
          formData.set("budgetAmount", String(budgetAmount));
        }

        if (editingTarget.type === "request" && composerState.budgetLabel.trim()) {
          formData.set("budgetLabel", composerState.budgetLabel.trim());
        }

        if (editingTarget.type === "request" && composerState.tag.trim()) {
          formData.set("tag", composerState.tag.trim());
        }

        for (const mediaItem of composerMedia) {
          if (mediaItem.source === "existing") {
            formData.append("keepMediaIds", mediaItem.id);
            continue;
          }

          if (mediaItem.file) {
            formData.append("media", mediaItem.file, mediaItem.fileName);
          }
        }

        const response = await fetch(
          editingTarget.type === "listing"
            ? `/api/market/listings/${encodeURIComponent(editingTarget.id)}`
            : `/api/market/requests/${encodeURIComponent(editingTarget.id)}`,
          {
          method: "PATCH",
          body: formData
          }
        );

        const payload = (await response.json().catch(() => null)) as
          | UpdateMarketListingResponse
          | UpdateMarketRequestResponse
          | {
              error?: {
                message?: string;
              };
            }
          | null;

        if (!response.ok || !payload || !("dashboard" in payload)) {
          setComposerMessage(
            payload && "error" in payload
              ? payload.error?.message ?? "We could not update this market post."
              : "We could not update this market post."
          );
          return;
        }

        setDashboard(payload.dashboard);
        closeDetailSheet();
        closeComposer();
        setFlashMessage(editingTarget.type === "listing" ? "Your listing has been updated." : "Your request has been updated.");
        return;
      }

      const formData = new FormData();
      formData.set("tab", composerState.tab);
      formData.set("title", title);
      formData.set("category", category);
      formData.set("description", description);

      if (composerState.condition.trim()) {
        formData.set("condition", composerState.condition.trim());
      }

      if (priceAmount !== null) {
        formData.set("priceAmount", String(priceAmount));
      }

      if (budgetAmount !== null) {
        formData.set("budgetAmount", String(budgetAmount));
      }

      if (composerState.budgetLabel.trim()) {
        formData.set("budgetLabel", composerState.budgetLabel.trim());
      }

      if (composerState.tag.trim()) {
        formData.set("tag", composerState.tag.trim());
      }

      for (const mediaItem of composerMedia) {
        if (mediaItem.file) {
          formData.append("media", mediaItem.file, mediaItem.fileName);
        }
      }

      const response = await fetch("/api/market", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json().catch(() => null)) as
        | CreateMarketPostResponse
        | {
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !payload || !("dashboard" in payload)) {
        setComposerMessage(payload && "error" in payload ? payload.error?.message ?? "We could not publish this market post." : "We could not publish this market post.");
        return;
      }

      setDashboard(payload.dashboard);
      setSearchValue("");
      setActiveCategory("All");
      setSortMode("latest");
      setActiveTab(composerState.tab);
      closeComposer();
      setFlashMessage(
        composerState.tab === "sale"
          ? "Your listing is now live in the campus market."
          : composerState.tab === "buying"
            ? "Your request is now live for the campus."
            : "Your lend request is now live for the campus."
      );
    } catch {
      setComposerMessage(composerMode === "edit" ? "We could not update this market post." : "We could not publish this market post.");
    } finally {
      setIsComposerSubmitting(false);
    }
  }

  async function handleSaveToggle(listing: MarketListing) {
    setBusyAction(`save:${listing.id}`);

    try {
      const response = await fetch("/api/market/save", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          listingId: listing.id
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | ToggleMarketSaveResponse
        | {
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !payload || !("dashboard" in payload)) {
        setFlashMessage(payload && "error" in payload ? payload.error?.message ?? "We could not update your saved items." : "We could not update your saved items.");
        return;
      }

      setDashboard(payload.dashboard);
      setFlashMessage(payload.isSaved ? `${listing.title} was added to your saved items.` : `${listing.title} was removed from your saved items.`);
    } catch {
      setFlashMessage("We could not update your saved items.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleMarkListingSold(listing: MarketListing) {
    setBusyAction(`sold:${listing.id}`);

    try {
      const response = await fetch(`/api/market/listings/${encodeURIComponent(listing.id)}/sold`, {
        method: "POST"
      });

      const payload = (await response.json().catch(() => null)) as
        | ManageMarketListingResponse
        | {
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !payload || !("dashboard" in payload)) {
        setFlashMessage(payload && "error" in payload ? payload.error?.message ?? "We could not mark this listing as sold." : "We could not mark this listing as sold.");
        return;
      }

      setDashboard(payload.dashboard);
      closeDetailSheet();
      setFlashMessage(`${listing.title} was marked as sold.`);
    } catch {
      setFlashMessage("We could not mark this listing as sold.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteListing(listing: MarketListing) {
    const confirmed = window.confirm(`Delete "${listing.title}" from the market?`);

    if (!confirmed) {
      return;
    }

    setBusyAction(`delete:${listing.id}`);

    try {
      const response = await fetch(`/api/market/listings/${encodeURIComponent(listing.id)}`, {
        method: "DELETE"
      });

      const payload = (await response.json().catch(() => null)) as
        | ManageMarketListingResponse
        | {
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !payload || !("dashboard" in payload)) {
        setFlashMessage(payload && "error" in payload ? payload.error?.message ?? "We could not delete this listing." : "We could not delete this listing.");
        return;
      }

      setDashboard(payload.dashboard);
      closeDetailSheet();
      setFlashMessage(`${listing.title} was deleted from the market.`);
    } catch {
      setFlashMessage("We could not delete this listing.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteRequest(request: MarketRequest) {
    const confirmed = window.confirm(`Delete "${request.title}" from the market board?`);

    if (!confirmed) {
      return;
    }

    setBusyAction(`delete-request:${request.id}`);

    try {
      const response = await fetch(`/api/market/requests/${encodeURIComponent(request.id)}`, {
        method: "DELETE"
      });

      const payload = (await response.json().catch(() => null)) as
        | ManageMarketRequestResponse
        | {
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !payload || !("dashboard" in payload)) {
        setFlashMessage(payload && "error" in payload ? payload.error?.message ?? "We could not delete this request." : "We could not delete this request.");
        return;
      }

      setDashboard(payload.dashboard);
      closeDetailSheet();
      setFlashMessage(`${request.title} was removed from the market board.`);
    } catch {
      setFlashMessage("We could not delete this request.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleContactSubmit() {
    if (!contactTarget) {
      return;
    }

    const trimmedMessage = contactMessage.trim();

    if (!trimmedMessage) {
      setContactError("Write a short message before sending it.");
      return;
    }

    setContactError(null);
    setIsContactSubmitting(true);

    try {
      const response = await fetch("/api/market/contact", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          targetId: contactTarget.id,
          targetType: contactTarget.type,
          message: trimmedMessage
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | ContactMarketPostResponse
        | {
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !payload || !("dashboard" in payload)) {
        setContactError(payload && "error" in payload ? payload.error?.message ?? "We could not send that market message." : "We could not send that market message.");
        return;
      }

      setDashboard(payload.dashboard);
      setContactTarget(null);
      setContactMessage("");
      setFlashMessage(contactTarget.type === "listing" ? "Your message has been sent to the seller." : "Your offer has been sent to the requester.");
    } catch {
      setContactError("We could not send that market message.");
    } finally {
      setIsContactSubmitting(false);
    }
  }

  const layoutStyle = {
    "--vyb-campus-left-width": `${leftWidth}px`,
    "--vyb-campus-right-width": `${rightWidth}px`
  } as CSSProperties;

  return (
    <main className="vyb-campus-home" style={layoutStyle}>
      <CampusDesktopNavigation navItems={navItems} viewerName={viewerName} viewerUsername={viewerUsername} />

      <button
        type="button"
        className={`vyb-campus-resizer vyb-campus-resizer-left${activeResize === "left" ? " is-active" : ""}`}
        aria-label="Resize left sidebar"
        onPointerDown={(event) => startResizeDrag("left", event)}
      />

      <section className="vyb-campus-main vyb-market-main">
        <div className="vyb-market-shell">
          <section className="vyb-market-toolbar">
            <div className="vyb-market-toolbar-line">
              <div className="vyb-market-tabs" role="tablist" aria-label="Marketplace sections">
                <button type="button" className={`vyb-market-tab${activeTab === "sale" ? " is-active" : ""}`} onClick={() => setActiveTab("sale")}>
                  <span>Items</span>
                  <strong>{tabCounts.sale}</strong>
                </button>
                <button type="button" className={`vyb-market-tab${activeTab === "buying" ? " is-active" : ""}`} onClick={() => setActiveTab("buying")}>
                  <span>Requests</span>
                  <strong>{tabCounts.buying}</strong>
                </button>
                <button type="button" className={`vyb-market-tab${activeTab === "lend" ? " is-active" : ""}`} onClick={() => setActiveTab("lend")}>
                  <span>Lend</span>
                  <strong>{tabCounts.lend}</strong>
                </button>
              </div>

              <label className="vyb-market-filter-select vyb-market-filter-select-filter">
                <FilterIcon />
                <span>Filter</span>
                <select value={activeCategory} onChange={(event) => setActiveCategory(event.target.value)} aria-label="Filter market results by category">
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="vyb-market-filter-select vyb-market-filter-select-sort">
                <SortIcon />
                <span>Sort</span>
                <select value={sortMode} onChange={(event) => setSortMode(event.target.value as MarketSort)} aria-label="Sort market results">
                  <option value="latest">Latest</option>
                  <option value="value-low">{activeTab === "sale" ? "Price: low to high" : "Budget: low to high"}</option>
                  <option value="value-high">{activeTab === "sale" ? "Price: high to low" : "Budget: high to low"}</option>
                  <option value="az">A to Z</option>
                </select>
              </label>

              <label className="vyb-market-search-box vyb-market-search-box-inline">
                <SearchIcon />
                <input
                  type="search"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder={activeTab === "sale" ? "Search items, sellers, or categories" : "Search requests, budgets, or categories"}
                  aria-label="Search the campus marketplace"
                />
              </label>

              <span className="vyb-market-toolbar-count">
                {visibleCount} result{visibleCount === 1 ? "" : "s"}
              </span>
            </div>
          </section>

          {flashMessage ? <div className="vyb-campus-flash-message">{flashMessage}</div> : null}

          {activeTab === "sale" ? (
            sortedItems.length > 0 ? (
              <div className="vyb-market-grid">
                {sortedItems.map((item) => {
                  const isOwnListing = item.seller.userId === dashboard.viewer.userId;
                  const activeCardMediaIndex = clampMediaIndex(item.media.length, cardMediaIndices[item.id] ?? 0);
                  const primaryMedia = item.media[activeCardMediaIndex] ?? getPrimaryMarketMedia(item.media);

                  return (
                    <article
                      key={item.id}
                      className="vyb-market-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => openDetailSheet({ type: "listing", id: item.id }, activeCardMediaIndex)}
                      onKeyDown={(event) => handleListingCardKeyDown(event, item.id, activeCardMediaIndex)}
                    >
                      <div className="vyb-market-card-media">
                        <button
                          type="button"
                          className="vyb-market-card-media-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openListingMediaViewer(item.id, activeCardMediaIndex);
                          }}
                          aria-label={`Open ${item.title} media in full screen`}
                        >
                          {primaryMedia ? (
                            renderMediaPreview(primaryMedia, item.title, "vyb-market-img")
                          ) : (
                            <div className="vyb-market-media-empty">
                              <ImageIcon />
                              <span>No media</span>
                            </div>
                          )}
                        </button>
                        <div className="vyb-market-card-badges">
                          <div className="vyb-market-card-badge-stack">
                            <span className="vyb-market-condition-badge">{item.condition}</span>
                            {primaryMedia?.kind === "video" ? <span className="vyb-market-condition-badge">Video</span> : null}
                          </div>
                          <button
                            type="button"
                            className={`vyb-market-save-button${item.isSaved ? " is-saved" : ""}`}
                            aria-label={`${item.isSaved ? "Remove" : "Save"} ${item.title}`}
                            aria-pressed={item.isSaved}
                            disabled={isOwnListing || busyAction === `save:${item.id}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSaveToggle(item);
                            }}
                          >
                            <HeartIcon />
                          </button>
                        </div>
                        {item.media.length > 1 ? (
                          <div className="vyb-market-card-dots" role="tablist" aria-label={`${item.title} media`}>
                            {item.media.map((mediaItem, mediaIndex) => (
                              <button
                                key={mediaItem.id}
                                type="button"
                                className={`vyb-market-card-dot${mediaIndex === activeCardMediaIndex ? " is-active" : ""}`}
                                aria-label={`Show media ${mediaIndex + 1} of ${item.media.length}`}
                                aria-pressed={mediaIndex === activeCardMediaIndex}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setCardMediaIndex(item.id, item.media.length, mediaIndex);
                                }}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="vyb-market-info">
                        <div className="vyb-market-topline">
                          <span className="vyb-market-category">{item.category}</span>
                          <span className="vyb-market-posted">
                            <ClockIcon />
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>

                        <span className="vyb-market-price">{formatCurrency(item.priceAmount)}</span>
                        <p className="vyb-market-title">{item.title}</p>
                        <p className="vyb-market-seller">@{item.seller.username}</p>

                        <div className="vyb-market-meta-list">
                          {hasExplicitMarketLocation(item.location) ? (
                            <span className="vyb-market-loc">
                              <LocationIcon />
                              {item.location}
                            </span>
                          ) : null}
                          <span className="vyb-market-loc">
                            <SparkIcon />
                            {getListingMeetupLine(item)}
                          </span>
                        </div>

                        <div className="vyb-market-card-actions">
                          <button
                            type="button"
                            className={`vyb-market-card-primary${!isOwnListing ? " is-contact" : ""}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              isOwnListing ? openListingEditor(item) : openContactSheet({ type: "listing", id: item.id });
                            }}
                          >
                            {isOwnListing ? <PackageIcon /> : <MessageIcon />}
                            <span>{isOwnListing ? "Edit listing" : "Message seller"}</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="vyb-market-empty-state">
                <strong>No listings match that search yet.</strong>
                <p>Try another category or clear the search to see more items from the campus marketplace.</p>
              </div>
            )
          ) : sortedRequests.length > 0 ? (
            <div className="vyb-market-request-list">
              {sortedRequests.map((request) => {
                const isOwnRequest = request.requester.userId === dashboard.viewer.userId;

                return (
                  <article key={request.id} className="vyb-market-request-item">
                    <div className="vyb-market-request-copy">
                      <div className="vyb-market-request-topline">
                        <span className={`vyb-market-req-tag is-${request.tone}`}>{request.tag}</span>
                        <span className="vyb-market-posted">
                          <ClockIcon />
                          {formatRelativeTime(request.createdAt)}
                        </span>
                      </div>

                      <h3>{request.title}</h3>
                      <p>{request.detail}</p>

                      <div className="vyb-market-request-meta">
                        <span>
                          <PackageIcon />
                          {request.budgetLabel}
                        </span>
                        <span>
                          <ProfileIcon />
                          @{request.requester.username}
                        </span>
                        {request.media.length > 0 ? (
                          <span>
                            {request.media[0]?.kind === "video" ? <VideoIcon /> : <ImageIcon />}
                            {request.media.length} file{request.media.length === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="vyb-market-request-action"
                      onClick={() => (isOwnRequest ? openRequestEditor(request) : openContactSheet({ type: "request", id: request.id }))}
                    >
                      <span>{isOwnRequest ? "Edit request" : "Offer help"}</span>
                      <ChevronRightIcon />
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="vyb-market-empty-state">
              <strong>No requests match that filter right now.</strong>
              <p>Switch categories or post the first request so others on campus can respond.</p>
            </div>
          )}
        </div>

        <button
          type="button"
          className="vyb-market-fab"
          aria-label="Create a market post"
          onClick={() => openComposer(activeTab === "sale" ? "sale" : activeTab)}
        >
          <PlusIcon />
        </button>
      </section>

      <button
        type="button"
        className={`vyb-campus-resizer vyb-campus-resizer-right${activeResize === "right" ? " is-active" : ""}`}
        aria-label="Resize right sidebar"
        onPointerDown={(event) => startResizeDrag("right", event)}
      />

      <aside className="vyb-campus-right-panel vyb-campus-rail">
        <div className="vyb-campus-side-card vyb-market-side-card">
          <span className="vyb-campus-side-label">Your market vibe</span>
          <div className="vyb-market-side-user">
            <img src={viewerAvatarUrl ?? `https://i.pravatar.cc/120?u=${encodeURIComponent(viewerEmail)}`} alt={viewerName} />
            <div>
              <strong>{viewerName}</strong>
              <span>{identityLine}</span>
            </div>
          </div>

          <div className="vyb-market-side-stats">
            <div>
              <span>Role</span>
              <strong>{role}</strong>
            </div>
            <div>
              <span>Saved</span>
              <strong>{dashboard.viewer.savedCount}</strong>
            </div>
          </div>
        </div>

        <div className="vyb-campus-side-card vyb-market-side-card">
          <span className="vyb-campus-side-label">Market guidelines</span>
          <ul className="vyb-market-guideline-list">
            <li>Meet in visible campus spots before handing over payment.</li>
            <li>Verify item condition on the spot and confirm accessories.</li>
            <li>Use requests when you need something specific quickly.</li>
          </ul>
        </div>

        <div className="vyb-campus-side-card vyb-market-side-card">
          <span className="vyb-campus-side-label">Your active items</span>
          <div className="vyb-market-side-list">
            {activeEntries.length > 0 ? (
              activeEntries.slice(0, 5).map((entry) => (
                <button key={entry.id} type="button" className="vyb-market-side-list-button" onClick={() => openDetailSheet({ type: entry.type, id: entry.id })}>
                  <strong>{entry.title}</strong>
                  <span>{entry.meta}</span>
                </button>
              ))
            ) : (
              <>
                <div className="vyb-market-side-list-item">
                  <strong>Start your first listing</strong>
                  <span>Turn spare notes, gear, or room essentials into quick campus deals.</span>
                </div>
                <div className="vyb-market-side-list-item">
                  <strong>Post a request</strong>
                  <span>Need a calculator, tripod, or lab coat? Ask the community directly.</span>
                </div>
              </>
            )}
          </div>
          <button type="button" className="vyb-market-side-cta" onClick={() => openComposer(activeTab === "sale" ? "sale" : activeTab)}>
            Create post
          </button>
        </div>

        <SignOutButton className="vyb-campus-signout vyb-campus-signout-wide" />
      </aside>

      <CampusMobileNavigation navItems={navItems} />

      {isComposerOpen ? (
        <div className="vyb-campus-compose-backdrop" role="presentation" onClick={closeComposer}>
          <div
            className="vyb-campus-compose-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={composerMode === "edit" ? "Edit market post" : "Create a market post"}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="vyb-campus-compose-handle" aria-hidden="true" />

            <div className="vyb-campus-compose-head">
              <div className="vyb-campus-compose-head-copy">
                <span className="vyb-campus-compose-kicker">Campus market</span>
                <strong>{composerMode === "edit" ? (isEditingRequest ? "Edit request" : "Edit listing") : "Create post"}</strong>
                <span>
                  {composerMode === "edit"
                    ? isEditingRequest
                      ? "Update your request details without posting it again."
                      : "Update your listing details without reposting it."
                    : "List an item, post a request, or ask to borrow something trusted on campus."}
                </span>
              </div>
              <button type="button" className="vyb-campus-compose-close" aria-label="Close composer" onClick={closeComposer}>
                <CloseIcon />
              </button>
            </div>

            {composerMode === "create" ? (
              <div className="vyb-market-compose-tabs" role="tablist" aria-label="Market post type">
                {[
                  { value: "sale" as const, label: "List item" },
                  { value: "buying" as const, label: "Request item" },
                  { value: "lend" as const, label: "Borrow / lend" }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`vyb-market-compose-tab${composerState.tab === option.value ? " is-active" : ""}`}
                    onClick={() => setComposerState(buildComposerState(option.value))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="vyb-campus-compose-grid">
              <div className="vyb-campus-compose-main">
                <div className="vyb-campus-compose-user">
                  <div className="vyb-campus-compose-avatar" aria-hidden="true">
                    <CampusAvatarContent
                      username={viewerUsername}
                      email={viewerEmail}
                      displayName={viewerName}
                      fallback={(viewerName.trim() || viewerUsername).slice(0, 2).toUpperCase()}
                      decorative
                    />
                  </div>
                  <div className="vyb-campus-compose-user-copy">
                    <strong>{viewerName}</strong>
                    <span>@{viewerUsername}</span>
                  </div>
                  <span className="vyb-campus-compose-user-pill">
                    {composerState.tab === "sale" ? "Listing" : composerState.tab === "buying" ? "Request" : "Borrow"}
                  </span>
                </div>

                <div className="vyb-market-compose-field-row">
                  <label className="vyb-campus-compose-field vyb-market-compose-field">
                    <span>Title</span>
                    <input
                      type="text"
                      value={composerState.title}
                      onChange={(event) => setComposerState((current) => ({ ...current, title: event.target.value }))}
                      placeholder={composerState.tab === "sale" ? "What are you listing?" : "What do you need?"}
                      disabled={isComposerSubmitting}
                    />
                  </label>

                  <label className="vyb-campus-compose-field vyb-market-compose-field">
                    <span>Category</span>
                    <select
                      value={composerState.category}
                      onChange={(event) => setComposerState((current) => ({ ...current, category: event.target.value }))}
                      disabled={isComposerSubmitting}
                    >
                      {MARKET_CATEGORY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="vyb-campus-compose-field">
                  <span>{composerState.tab === "sale" ? "Description" : "What should people know?"}</span>
                  <textarea
                    value={composerState.description}
                    onChange={(event) => setComposerState((current) => ({ ...current, description: event.target.value }))}
                    placeholder={
                      composerState.tab === "sale"
                        ? "Condition, accessories, and anything useful buyers should know"
                        : "Share what you need, how soon you need it, and any helpful context"
                    }
                    rows={5}
                    disabled={isComposerSubmitting}
                  />
                </label>

                {composerState.tab === "sale" ? (
                  <>
                    <div className="vyb-market-compose-field-row">
                      <label className="vyb-campus-compose-field vyb-market-compose-field">
                        <span>Price</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={composerState.priceAmount}
                          onChange={(event) =>
                            setComposerState((current) => ({ ...current, priceAmount: sanitizeDigitsOnlyInput(event.target.value) }))
                          }
                          placeholder="1200"
                          disabled={isComposerSubmitting}
                        />
                      </label>

                      <label className="vyb-campus-compose-field vyb-market-compose-field">
                        <span>Condition</span>
                        <select
                          value={composerState.condition}
                          onChange={(event) => setComposerState((current) => ({ ...current, condition: event.target.value }))}
                          disabled={isComposerSubmitting}
                        >
                          {CONDITION_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                  </>
                ) : (
                  <>
                    <div className="vyb-market-compose-field-row">
                      <label className="vyb-campus-compose-field">
                        <span>{composerState.tab === "buying" ? "Budget" : "Rental / deposit budget"}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={composerState.budgetAmount}
                          onChange={(event) =>
                            setComposerState((current) => ({ ...current, budgetAmount: sanitizeDigitsOnlyInput(event.target.value) }))
                          }
                          placeholder={composerState.tab === "buying" ? "1500" : "300"}
                          disabled={isComposerSubmitting}
                        />
                      </label>

                      <label className="vyb-campus-compose-field">
                        <span>Tag (optional)</span>
                        <input
                          type="text"
                          value={composerState.tag}
                          onChange={(event) => setComposerState((current) => ({ ...current, tag: event.target.value }))}
                          placeholder={composerState.tab === "buying" ? "Need urgently" : "Borrow for 2 days"}
                          disabled={isComposerSubmitting}
                        />
                      </label>
                    </div>

                    <div className="vyb-market-compose-field-row">
                      <label className="vyb-campus-compose-field">
                        <span>Budget note (optional)</span>
                        <input
                          type="text"
                          value={composerState.budgetLabel}
                          onChange={(event) => setComposerState((current) => ({ ...current, budgetLabel: event.target.value }))}
                          placeholder={composerState.tab === "buying" ? "Budget under Rs 2,000" : "Can pay a short rental fee"}
                          disabled={isComposerSubmitting}
                        />
                      </label>
                    </div>
                  </>
                )}

                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  hidden
                  onChange={handleComposerFilesChange}
                  disabled={isComposerSubmitting}
                />

                <div className="vyb-market-upload-block">
                  <div className="vyb-market-upload-header">
                    <div>
                      <span className="vyb-campus-compose-kicker">{composerMode === "edit" ? "Manage media" : "Media upload"}</span>
                      <strong>{composerMode === "edit" ? `Add or remove ${isEditingRequest ? "request" : "listing"} media` : "Upload images or videos directly"}</strong>
                    </div>
                    <button type="button" className="vyb-market-upload-trigger" onClick={openComposerFilePicker} disabled={isComposerSubmitting}>
                      <PlusIcon />
                      <span>{composerMode === "edit" ? "Add more" : "Add files"}</span>
                    </button>
                  </div>

                  <p className="vyb-market-upload-copy">
                    Upload up to {MAX_MARKET_MEDIA_ITEMS} files in total. Images stay under {formatFileSize(MAX_MARKET_IMAGE_BYTES)} each and videos stay under{" "}
                    {formatFileSize(MAX_MARKET_VIDEO_BYTES)} each.
                  </p>

                  {composerMedia.length > 0 ? (
                    <div className="vyb-market-upload-grid">
                      {composerMedia.map((mediaItem) => (
                        <div key={mediaItem.id} className="vyb-market-upload-item">
                          <div className="vyb-market-upload-thumb">
                            {mediaItem.kind === "video" ? (
                              <video src={mediaItem.previewUrl} className="vyb-market-upload-preview-media" muted playsInline preload="metadata" />
                            ) : (
                              <img src={mediaItem.previewUrl} alt={mediaItem.fileName} className="vyb-market-upload-preview-media" />
                            )}
                          </div>
                          <div className="vyb-market-upload-meta">
                            <span className="vyb-market-upload-name">{mediaItem.fileName}</span>
                            <span className="vyb-market-upload-subtle">
                              {mediaItem.kind === "video" ? <VideoIcon /> : <ImageIcon />}
                              <span>{formatFileSize(mediaItem.sizeBytes)}</span>
                              <span>{mediaItem.source === "existing" ? "Attached" : "New"}</span>
                            </span>
                          </div>
                          <button
                            type="button"
                            className="vyb-market-upload-remove"
                            onClick={() => removeComposerMedia(mediaItem.id)}
                            aria-label={`Remove ${mediaItem.fileName}`}
                            disabled={isComposerSubmitting}
                          >
                            <CloseIcon />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button type="button" className="vyb-market-upload-empty" onClick={openComposerFilePicker} disabled={isComposerSubmitting}>
                      <span className="vyb-market-upload-empty-icon">
                        <ImageIcon />
                      </span>
                      <strong>{composerMode === "edit" ? "Add updated images or videos" : "Choose images or videos"}</strong>
                      <span>
                        {composerMode === "edit"
                          ? "Keep what you want, remove the rest, and add new media before saving."
                          : "They will upload directly when you publish this market post."}
                      </span>
                    </button>
                  )}
                </div>

                {composerMessage ? <p className="vyb-market-compose-message">{composerMessage}</p> : null}
              </div>

              <aside className="vyb-campus-compose-side">
                <div className="vyb-campus-compose-side-copy">
                  <strong>{composerMode === "edit" || composerState.tab === "sale" ? "Preview" : "Post tips"}</strong>
                  <span>
                    {composerState.tab === "sale"
                      ? "A clear title, fair price, and honest condition help listings move fast."
                      : "Specific requests get faster responses from the right people."}
                  </span>
                </div>

                <div className="vyb-market-compose-preview">
                  <span>
                    {composerMode === "edit"
                      ? isEditingRequest
                        ? "Editing request"
                        : "Editing listing"
                      : composerState.tab === "sale"
                        ? "Live listing"
                        : composerState.tab === "buying"
                          ? "Buying request"
                          : "Borrow request"}
                  </span>
                  <strong>{composerState.title.trim() || "Your post title will appear here"}</strong>
                  <p>{composerState.description.trim() || "Add a few useful details so campus people know exactly what you mean."}</p>
                  <div className="vyb-market-compose-preview-meta">
                    <span>
                      {composerMedia.length > 0
                        ? `${composerMedia.length} attachment${composerMedia.length === 1 ? "" : "s"}`
                        : composerMode === "edit"
                          ? "No media attached"
                          : "No media selected"}
                    </span>
                    <span>{composerState.tab === "sale" ? formatCurrency(Number(composerState.priceAmount || 0)) : composerState.budgetLabel.trim() || "Budget flexible"}</span>
                  </div>
                  {composerMedia.length > 0 ? (
                    <div className="vyb-market-compose-preview-gallery">
                      {composerMedia.slice(0, 4).map((mediaItem) => (
                        <div key={mediaItem.id} className="vyb-market-compose-preview-thumb">
                          {mediaItem.kind === "video" ? (
                            <video src={mediaItem.previewUrl} className="vyb-market-compose-preview-thumb-media" muted playsInline preload="metadata" />
                          ) : (
                            <img src={mediaItem.previewUrl} alt={mediaItem.fileName} className="vyb-market-compose-preview-thumb-media" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <ul className="vyb-market-compose-side-list">
                  <li>Meet in visible campus spots and verify items before paying.</li>
                  <li>Keep titles clear and budgets fair so replies stay useful.</li>
                  <li>Use the request flow whenever you need something specific quickly.</li>
                </ul>
              </aside>
            </div>

            <div className="vyb-campus-compose-actions">
              <button type="button" className="vyb-campus-compose-secondary" onClick={closeComposer} disabled={isComposerSubmitting}>
                Cancel
              </button>
              <button type="button" className="vyb-campus-compose-primary" onClick={handleComposerSubmit} disabled={isComposerSubmitting}>
                {isComposerSubmitting ? (composerMode === "edit" ? "Saving..." : "Publishing...") : composerMode === "edit" ? "Save changes" : "Publish post"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedListing || selectedRequest ? (
        <div className="vyb-campus-compose-backdrop" role="presentation" onClick={closeDetailSheet}>
          <div className="vyb-campus-compose-sheet vyb-market-detail-sheet" role="dialog" aria-modal="true" aria-label="Market post details" onClick={(event) => event.stopPropagation()}>
            <div className="vyb-campus-compose-head">
              <div className="vyb-campus-compose-head-copy">
                <span className="vyb-campus-compose-kicker">{selectedListing ? "Listing details" : "Request details"}</span>
                <strong>{selectedListing?.title ?? selectedRequest?.title}</strong>
                <span>{selectedListing ? `Posted by @${selectedListing.seller.username}` : `Posted by @${selectedRequest?.requester.username}`}</span>
              </div>
              <button type="button" className="vyb-campus-compose-close" aria-label="Close details" onClick={closeDetailSheet}>
                <CloseIcon />
              </button>
            </div>

            {selectedListing ? (
              <div className="vyb-market-detail-layout">
                <div className="vyb-market-detail-media">
                  {activeDetailMedia ? (
                    <>
                      <button
                        type="button"
                        className={`vyb-market-detail-feature vyb-market-detail-feature-button${activeDetailMedia.kind === "video" ? " is-video" : ""}`}
                        onClick={() => openMediaViewer()}
                        aria-label={`Open ${selectedListing.title} media in full view`}
                      >
                        {renderMediaPreview(activeDetailMedia, selectedListing.title, "vyb-market-detail-image")}
                        <span className="vyb-market-detail-open-hint">{activeDetailMedia.kind === "video" ? "Open full viewer" : "Tap for full size"}</span>
                        {detailMedia.length > 1 ? (
                          <span className="vyb-market-detail-index">
                            {clampMediaIndex(detailMedia.length, detailMediaIndex) + 1} / {detailMedia.length}
                          </span>
                        ) : null}
                      </button>
                      {detailMedia.length > 1 ? (
                        <div className="vyb-market-detail-thumbs" role="tablist" aria-label={`${selectedListing.title} media`}>
                          {detailMedia.map((mediaItem, mediaIndex) => (
                            <button
                              key={mediaItem.id}
                              type="button"
                              className={`vyb-market-detail-thumb${mediaIndex === clampMediaIndex(detailMedia.length, detailMediaIndex) ? " is-active" : ""}`}
                              aria-label={`Show media ${mediaIndex + 1} of ${detailMedia.length}`}
                              onClick={() => setActiveDetailMediaIndex(mediaIndex)}
                            >
                              {renderMediaPreview(mediaItem, selectedListing.title, "vyb-market-detail-thumb-media")}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="vyb-market-media-empty vyb-market-media-empty-detail">
                      <ImageIcon />
                      <span>No media uploaded</span>
                    </div>
                  )}
                </div>

                <div className="vyb-market-detail-copy">
                  <div className="vyb-market-detail-tags">
                    <span className="vyb-market-condition-badge">{selectedListing.condition}</span>
                    <span className="vyb-market-category-chip">{selectedListing.category}</span>
                  </div>
                  <p className="vyb-market-detail-price">{formatCurrency(selectedListing.priceAmount)}</p>
                  <p className="vyb-market-detail-description">{selectedListing.description}</p>

                  <div className="vyb-market-detail-meta">
                    {hasExplicitMarketLocation(selectedListing.location) ? (
                      <span>
                        <LocationIcon />
                        {selectedListing.location}
                      </span>
                    ) : null}
                    <span>
                      <SparkIcon />
                      {getListingMeetupLine(selectedListing)}
                    </span>
                    <span>
                      <ClockIcon />
                      {formatRelativeTime(selectedListing.createdAt)}
                    </span>
                  </div>

                  <div className="vyb-market-detail-stats">
                    <div>
                      <span>Saved</span>
                      <strong>{selectedListing.savedCount}</strong>
                    </div>
                    <div>
                      <span>Interested</span>
                      <strong>{selectedListing.inquiryCount}</strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedRequest ? (
              <div className="vyb-market-detail-layout vyb-market-detail-layout-single">
                <div className="vyb-market-detail-copy">
                  {activeDetailMedia ? (
                    <>
                      <button
                        type="button"
                        className={`vyb-market-detail-feature vyb-market-detail-feature-button${activeDetailMedia.kind === "video" ? " is-video" : ""}`}
                        onClick={() => openMediaViewer()}
                        aria-label={`Open ${selectedRequest.title} media in full view`}
                      >
                        {renderMediaPreview(activeDetailMedia, selectedRequest.title, "vyb-market-detail-image")}
                        <span className="vyb-market-detail-open-hint">{activeDetailMedia.kind === "video" ? "Open full viewer" : "Tap for full size"}</span>
                        {detailMedia.length > 1 ? (
                          <span className="vyb-market-detail-index">
                            {clampMediaIndex(detailMedia.length, detailMediaIndex) + 1} / {detailMedia.length}
                          </span>
                        ) : null}
                      </button>
                      {detailMedia.length > 1 ? (
                        <div className="vyb-market-detail-thumbs" role="tablist" aria-label={`${selectedRequest.title} media`}>
                          {detailMedia.map((mediaItem, mediaIndex) => (
                            <button
                              key={mediaItem.id}
                              type="button"
                              className={`vyb-market-detail-thumb${mediaIndex === clampMediaIndex(detailMedia.length, detailMediaIndex) ? " is-active" : ""}`}
                              aria-label={`Show media ${mediaIndex + 1} of ${detailMedia.length}`}
                              onClick={() => setActiveDetailMediaIndex(mediaIndex)}
                            >
                              {renderMediaPreview(mediaItem, selectedRequest.title, "vyb-market-detail-thumb-media")}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  <div className="vyb-market-detail-tags">
                    <span className={`vyb-market-req-tag is-${selectedRequest.tone}`}>{selectedRequest.tag}</span>
                    <span className="vyb-market-category-chip">{selectedRequest.category}</span>
                  </div>
                  <p className="vyb-market-detail-price">{selectedRequest.budgetLabel}</p>
                  <p className="vyb-market-detail-description">{selectedRequest.detail}</p>

                  <div className="vyb-market-detail-meta">
                    <span>
                      <PackageIcon />
                      {selectedRequest.tab === "buying" ? "Buying request" : "Borrow / lend"}
                    </span>
                    <span>
                      <SparkIcon />
                      {selectedRequest.category}
                    </span>
                    <span>
                      <ClockIcon />
                      {formatRelativeTime(selectedRequest.createdAt)}
                    </span>
                  </div>

                  <div className="vyb-market-detail-stats">
                    <div>
                      <span>Responses</span>
                      <strong>{selectedRequest.responseCount}</strong>
                    </div>
                    <div>
                      <span>Posted by</span>
                      <strong>@{selectedRequest.requester.username}</strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="vyb-campus-compose-actions vyb-market-detail-actions">
              <button type="button" className="vyb-campus-compose-secondary" onClick={closeDetailSheet}>
                Close
              </button>
              {selectedListing ? (
                selectedListing.seller.userId === dashboard.viewer.userId ? (
                  <>
                    <button
                      type="button"
                      className="vyb-campus-compose-secondary vyb-market-manage-danger"
                      disabled={busyAction === `delete:${selectedListing.id}`}
                      onClick={() => handleDeleteListing(selectedListing)}
                    >
                      {busyAction === `delete:${selectedListing.id}` ? "Deleting..." : "Delete"}
                    </button>
                    <button
                      type="button"
                      className="vyb-campus-compose-secondary"
                      disabled={busyAction === `sold:${selectedListing.id}`}
                      onClick={() => handleMarkListingSold(selectedListing)}
                    >
                      {busyAction === `sold:${selectedListing.id}` ? "Marking..." : "Mark as sold"}
                    </button>
                    <button
                      type="button"
                      className="vyb-campus-compose-primary"
                      onClick={() => {
                        closeDetailSheet();
                        openListingEditor(selectedListing);
                      }}
                    >
                      Edit listing
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="vyb-campus-compose-primary"
                    onClick={() => {
                      closeDetailSheet();
                      openContactSheet({ type: "listing", id: selectedListing.id });
                    }}
                  >
                    Message seller
                  </button>
                )
              ) : selectedRequest ? (
                selectedRequest.requester.userId === dashboard.viewer.userId ? (
                  <>
                    <button
                      type="button"
                      className="vyb-campus-compose-secondary vyb-market-manage-danger"
                      disabled={busyAction === `delete-request:${selectedRequest.id}`}
                      onClick={() => handleDeleteRequest(selectedRequest)}
                    >
                      {busyAction === `delete-request:${selectedRequest.id}` ? "Deleting..." : "Delete"}
                    </button>
                    <button
                      type="button"
                      className="vyb-campus-compose-primary"
                      onClick={() => {
                        closeDetailSheet();
                        openRequestEditor(selectedRequest);
                      }}
                    >
                      Edit request
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="vyb-campus-compose-primary"
                    onClick={() => {
                      closeDetailSheet();
                      openContactSheet({ type: "request", id: selectedRequest.id });
                    }}
                  >
                    Offer help
                  </button>
                )
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isMediaViewerOpen && activeDetailMedia ? (
        <div className="vyb-market-media-viewer-backdrop" role="presentation" onClick={closeMediaViewer}>
          <div className="vyb-market-media-viewer" role="dialog" aria-modal="true" aria-label="Market media viewer" onClick={(event) => event.stopPropagation()}>
            <div className="vyb-market-media-viewer-head">
              <div className="vyb-market-media-viewer-copy">
                <strong>{detailTitle}</strong>
                <span>
                  {clampMediaIndex(detailMedia.length, detailMediaIndex) + 1} / {detailMedia.length}
                </span>
              </div>
              <button type="button" className="vyb-market-media-viewer-close" onClick={closeMediaViewer} aria-label="Close media viewer">
                <CloseIcon />
              </button>
            </div>

            <div
              className="vyb-market-media-viewer-stage"
              onTouchStart={handleMediaViewerTouchStart}
              onTouchMove={handleMediaViewerTouchMove}
              onTouchEnd={handleMediaViewerTouchEnd}
            >
              {detailMedia.length > 1 ? (
                <button
                  type="button"
                  className="vyb-market-media-viewer-nav is-prev"
                  onClick={() => shiftDetailMedia(-1)}
                  aria-label="Show previous media"
                >
                  <ChevronLeftIcon />
                </button>
              ) : null}

              <div className={`vyb-market-media-viewer-frame${activeDetailMedia.kind === "video" ? " is-video" : ""}`}>
                {detailMedia.length > 1 ? (
                  <div
                    className={`vyb-market-media-viewer-track${isMediaViewerDragging ? " is-dragging" : ""}`}
                    style={{ transform: `translateX(calc(-100% + ${mediaViewerDragOffset}px))` }}
                  >
                    {[detailMediaIndex - 1, detailMediaIndex, detailMediaIndex + 1].map((mediaIndex, trackIndex) => {
                      const mediaItem = getWrappedDetailMedia(mediaIndex);

                      if (!mediaItem) {
                        return null;
                      }

                      const isActiveSlide = trackIndex === 1;

                      return (
                        <div
                          key={`${mediaItem.id}-${trackIndex}`}
                          className={`vyb-market-media-viewer-slide${mediaItem.kind === "video" ? " is-video" : ""}`}
                        >
                          {renderMediaPreview(mediaItem, detailTitle, "vyb-market-media-viewer-media", {
                            controls: isActiveSlide && mediaItem.kind === "video"
                          })}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  renderMediaPreview(activeDetailMedia, detailTitle, "vyb-market-media-viewer-media", {
                    controls: activeDetailMedia.kind === "video"
                  })
                )}
              </div>

              {detailMedia.length > 1 ? (
                <button
                  type="button"
                  className="vyb-market-media-viewer-nav is-next"
                  onClick={() => shiftDetailMedia(1)}
                  aria-label="Show next media"
                >
                  <ChevronRightIcon />
                </button>
              ) : null}
            </div>

            {detailMedia.length > 1 ? (
              <div className="vyb-market-media-viewer-strip" role="tablist" aria-label={`${detailTitle} media gallery`}>
                {detailMedia.map((mediaItem, mediaIndex) => (
                  <button
                    key={mediaItem.id}
                    type="button"
                    className={`vyb-market-media-viewer-thumb-button${mediaIndex === clampMediaIndex(detailMedia.length, detailMediaIndex) ? " is-active" : ""}`}
                    onClick={() => setActiveDetailMediaIndex(mediaIndex)}
                    aria-label={`Open media ${mediaIndex + 1} of ${detailMedia.length}`}
                  >
                    <span className="vyb-market-media-viewer-thumb" aria-hidden="true" />
                    {mediaItem.kind === "video" ? <span className="vyb-market-media-viewer-thumb-dot" aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {contactListing || contactRequest ? (
        <div className="vyb-campus-compose-backdrop" role="presentation" onClick={() => setContactTarget(null)}>
          <div className="vyb-campus-compose-sheet vyb-market-contact-sheet" role="dialog" aria-modal="true" aria-label="Contact market seller or requester" onClick={(event) => event.stopPropagation()}>
            <div className="vyb-campus-compose-head">
              <div className="vyb-campus-compose-head-copy">
                <span className="vyb-campus-compose-kicker">{contactListing ? "Contact seller" : "Offer help"}</span>
                <strong>{contactListing?.title ?? contactRequest?.title}</strong>
                <span>{contactListing ? `Message @${contactListing.seller.username}` : `Reply to @${contactRequest?.requester.username}`}</span>
              </div>
              <button type="button" className="vyb-campus-compose-close" aria-label="Close contact form" onClick={() => setContactTarget(null)}>
                <CloseIcon />
              </button>
            </div>

            <div className="vyb-market-compose-preview">
              <span>{contactListing ? formatCurrency(contactListing.priceAmount) : contactRequest?.budgetLabel}</span>
              <strong>
                {contactListing
                  ? getListingMeetupLine(contactListing)
                  : contactRequest?.category ?? "Campus request"}
              </strong>
              <p>{contactListing?.description ?? contactRequest?.detail}</p>
            </div>

            <label className="vyb-campus-compose-field">
              <span>Message</span>
              <textarea
                value={contactMessage}
                onChange={(event) => setContactMessage(event.target.value)}
                placeholder={contactListing ? "Ask if the item is still available, confirm accessories, or propose a meetup." : "Tell them how you can help and when you can meet."}
                rows={5}
                disabled={isContactSubmitting}
              />
            </label>

            {contactError ? <p className="vyb-market-compose-message">{contactError}</p> : null}

            <div className="vyb-campus-compose-actions">
              <button type="button" className="vyb-campus-compose-secondary" onClick={() => setContactTarget(null)} disabled={isContactSubmitting}>
                Cancel
              </button>
              <button type="button" className="vyb-campus-compose-primary" onClick={handleContactSubmit} disabled={isContactSubmitting}>
                {isContactSubmitting ? "Sending..." : contactListing ? "Send message" : "Send offer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
