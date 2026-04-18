import type { CommunityLink, FeedPreviewCard, ResourcePreviewCard } from "@vyb/contracts";

export const primaryNavigation = [
  { label: "Workspace", href: "#workspace" },
  { label: "Square", href: "#square" },
  { label: "Resources", href: "#resources" },
  { label: "Communities", href: "#communities" },
  { label: "PWA", href: "#install" }
] as const;

export const campusHighlights = [
  "Verified identity keeps every college cluster trusted.",
  "Responsive app shell feels clean on desktop and native-like on mobile.",
  "PWA install support makes Phase 1 more useful before native apps arrive."
] as const;

export const featuredCommunities: CommunityLink[] = [
  { id: "c-1", name: "CS Batch 2028", type: "batch", memberCount: 184 },
  { id: "c-2", name: "Boys Hostel A", type: "hostel", memberCount: 96 },
  { id: "c-3", name: "Campus Square", type: "general", memberCount: 1480 }
];

export const featuredFeed: FeedPreviewCard[] = [
  {
    id: "p-1",
    title: "Prototype Night",
    body: "Club demo night is live. Bring your build, record a clip, and drop your wins before 9 PM.",
    community: "Campus Square",
    reactions: 124,
    comments: 18
  },
  {
    id: "p-2",
    title: "Placement Prep Sprint",
    body: "Shared DSA revision sheet plus mock interview slots for tomorrow evening.",
    community: "CS Batch 2028",
    reactions: 88,
    comments: 26
  }
];

export const featuredResources: ResourcePreviewCard[] = [
  { id: "r-1", title: "DBMS Quick Revision Notes", course: "DBMS", type: "notes", downloads: 412 },
  { id: "r-2", title: "Operating Systems PYQ Pack", course: "Operating Systems", type: "pyq", downloads: 305 },
  { id: "r-3", title: "Hackathon Pitch Deck Guide", course: "Open Resource", type: "guide", downloads: 196 }
];
