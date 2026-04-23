import type {
  ActivityItem,
  ChatConversationPreview,
  ChatConversationResponse,
  ClientShellResponse,
  FeedCard,
  MarketDashboardResponse,
  MarketListing,
  MarketRequest,
  MeResponse,
  ProfileResponse,
  PublicProfileResponse,
  ResourceItem,
  StoryCard,
  UserSearchItem
} from "@vyb/contracts";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";

import { colors } from "@vyb/design-tokens";
import { NativeCard, SectionHeader } from "@vyb/ui-native";
import {
  getCampusFeed,
  getCampusResources,
  getCampusStories,
  getCampusVibes,
  getChatConversation,
  getChatInbox,
  getClientShellData,
  getMarketDashboard,
  getMobileRuntimeConfig,
  getSuggestedCampusUsers,
  getViewerActivity,
  getViewerMe,
  getViewerProfile,
  getViewerPublicProfile,
  searchCampusUsers
} from "./src/lib/backend";
import { createMobileViewerSession } from "./src/lib/dev-session";

type TabKey = "home" | "discover" | "messages" | "profile";
type ConversationDetail = ChatConversationResponse["conversation"];

function asArray<T>(value: readonly T[] | null | undefined): T[] {
  return Array.isArray(value) ? [...value] : [];
}

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  const diffInWeeks = Math.floor(diffInDays / 7);

  return diffInWeeks < 52
    ? `${diffInWeeks}w ago`
    : date.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}

function formatMetric(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: value > 999 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "Flexible";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDateLabel(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric"
  });
}

function splitFeedCopy(item: FeedCard) {
  const body = item.body?.trim() ?? "";
  const title = item.title?.trim() ?? "";

  if (title && title.toLowerCase() !== body.toLowerCase()) {
    return {
      title,
      body
    };
  }

  return {
    title: title || null,
    body
  };
}

function getFeedMedia(item: FeedCard) {
  if (Array.isArray(item.media) && item.media.length > 0) {
    return item.media[0];
  }

  if (item.mediaUrl) {
    return {
      url: item.mediaUrl,
      kind: item.kind === "video" ? ("video" as const) : ("image" as const)
    };
  }

  return null;
}

function getMarketMedia(item: MarketListing | MarketRequest) {
  return Array.isArray(item.media) && item.media.length > 0 ? item.media[0] : null;
}

function canOpenExternally(url: string | null | undefined) {
  return typeof url === "string" && /^https?:/iu.test(url.trim());
}

function openExternalUrl(url: string | null | undefined) {
  if (!canOpenExternally(url)) {
    return;
  }

  Linking.openURL(url!).catch(() => null);
}

function TabButton({
  label,
  active,
  onPress,
  badgeCount
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  badgeCount?: number;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active ? styles.tabButtonActive : null]}>
      <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{label}</Text>
      {badgeCount && badgeCount > 0 ? (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{badgeCount > 99 ? "99+" : badgeCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function MetaPill({ value, accent = "cyan" }: { value: string; accent?: "cyan" | "lime" | "coral" }) {
  return (
    <View
      style={[
        styles.metaPill,
        accent === "lime" ? styles.metaPillLime : null,
        accent === "coral" ? styles.metaPillCoral : null
      ]}
    >
      <Text style={styles.metaPillText}>{value}</Text>
    </View>
  );
}

function SectionHeaderRow({
  title,
  count,
  subtitle
}: {
  title: string;
  count?: number;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeaderWrap}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {typeof count === "number" ? <Text style={styles.sectionCount}>{count}</Text> : null}
    </View>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <NativeCard>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </NativeCard>
  );
}

function MediaPreview({
  url,
  kind,
  height = 210,
  compact = false
}: {
  url: string | null | undefined;
  kind: "image" | "video" | null | undefined;
  height?: number;
  compact?: boolean;
}) {
  if (!url || !kind) {
    return null;
  }

  if (kind === "image") {
    const image = (
      <Image
        source={{ uri: url }}
        style={[styles.mediaPreviewImage, { height }, compact ? styles.mediaPreviewCompact : null]}
        resizeMode="cover"
      />
    );

    return canOpenExternally(url) ? (
      <Pressable onPress={() => openExternalUrl(url)}>{image}</Pressable>
    ) : (
      image
    );
  }

  return (
    <Pressable
      onPress={() => openExternalUrl(url)}
      disabled={!canOpenExternally(url)}
      style={[styles.videoPreview, { minHeight: height }, compact ? styles.videoPreviewCompact : null]}
    >
      <Text style={styles.videoPreviewEyebrow}>VIDEO</Text>
      <Text style={styles.videoPreviewTitle}>Native playback surface next</Text>
      <Text style={styles.videoPreviewCopy}>
        Video media is wired into the feed. Tap to open the asset while we finish in-app player integration.
      </Text>
      {canOpenExternally(url) ? <MetaPill value="Open media" accent="lime" /> : null}
    </Pressable>
  );
}

function StoryRailCard({ item }: { item: StoryCard }) {
  return (
    <View style={styles.storyRailCard}>
      <MediaPreview url={item.mediaUrl} kind={item.mediaType} height={170} compact />
      <View style={styles.storyRailBody}>
        <Text style={styles.storyRailName}>{item.displayName}</Text>
        <Text style={styles.storyRailMeta}>
          @{item.username} • {timeAgo(item.createdAt)}
        </Text>
        <Text numberOfLines={2} style={styles.storyRailCaption}>
          {item.caption || "Story published and ready to view."}
        </Text>
      </View>
    </View>
  );
}

function VibeCardView({ item }: { item: FeedCard }) {
  const media = getFeedMedia(item);
  const copy = splitFeedCopy(item);

  return (
    <View style={styles.vibeCard}>
      <MediaPreview url={media?.url} kind={media?.kind} height={260} />
      <View style={styles.vibeOverlay}>
        <MetaPill value="Vibe" accent="lime" />
        <Text numberOfLines={2} style={styles.vibeTitle}>
          {copy.title ?? item.author.displayName}
        </Text>
        <Text numberOfLines={2} style={styles.vibeBody}>
          {copy.body || "Immersive vibe playback ready."}
        </Text>
        <Text style={styles.vibeMeta}>
          @{item.author.username} • {formatMetric(item.reactions)} reacts • {formatMetric(item.comments)} comments
        </Text>
      </View>
    </View>
  );
}

function FeedCardView({ item }: { item: FeedCard }) {
  const media = getFeedMedia(item);
  const copy = splitFeedCopy(item);
  const mediaCount = Array.isArray(item.media) ? item.media.length : item.mediaUrl ? 1 : 0;

  return (
    <NativeCard>
      <View style={styles.feedHeader}>
        <View style={styles.feedHeaderText}>
          <Text style={styles.feedAuthor}>{item.author.displayName}</Text>
          <Text style={styles.feedHandle}>
            @{item.author.username} • {timeAgo(item.createdAt)}
          </Text>
        </View>
        <MetaPill value={item.placement === "vibe" ? "Vibe" : "Post"} />
      </View>

      {media ? <MediaPreview url={media.url} kind={media.kind} height={220} /> : null}
      {copy.title ? <Text style={styles.feedTitle}>{copy.title}</Text> : null}
      <Text style={styles.feedBody}>{copy.body}</Text>
      {item.location ? <Text style={styles.feedLocation}>{item.location}</Text> : null}

      <View style={styles.feedMetaRow}>
        <Text style={styles.feedMetric}>{formatMetric(item.reactions)} reactions</Text>
        <Text style={styles.feedMetric}>{formatMetric(item.comments)} comments</Text>
        {mediaCount ? <Text style={styles.feedMetric}>{mediaCount} media</Text> : null}
      </View>
    </NativeCard>
  );
}

function UserResultCard({ item }: { item: UserSearchItem }) {
  return (
    <NativeCard>
      <View style={styles.userRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{item.displayName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.userBody}>
          <Text style={styles.userName}>{item.displayName}</Text>
          <Text style={styles.userHandle}>
            @{item.username} • {item.course}
          </Text>
          <Text style={styles.userStats}>
            {formatMetric(item.stats.followers)} followers • {formatMetric(item.stats.posts)} posts
          </Text>
        </View>
        <MetaPill value={item.isFollowing ? "Following" : "Discover"} />
      </View>
    </NativeCard>
  );
}

function ConversationCard({
  item,
  onOpen
}: {
  item: ChatConversationPreview;
  onOpen: (conversationId: string) => void;
}) {
  const lastMessageLabel = item.lastMessage
    ? item.lastMessage.messageKind === "text"
      ? "Encrypted text message"
      : item.lastMessage.messageKind.replaceAll("_", " ")
    : "No messages yet";

  return (
    <Pressable onPress={() => onOpen(item.id)}>
      <NativeCard>
        <View style={styles.userRow}>
          <View style={styles.avatarCircleAlt}>
            <Text style={styles.avatarText}>{item.peer.displayName.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.userBody}>
            <Text style={styles.userName}>{item.peer.displayName}</Text>
            <Text style={styles.userHandle}>
              @{item.peer.username}
              {item.peer.course ? ` • ${item.peer.course}` : ""}
            </Text>
            <Text style={styles.conversationSnippet}>{lastMessageLabel}</Text>
          </View>
          <View style={styles.conversationMeta}>
            <Text style={styles.conversationTime}>{timeAgo(item.lastActivityAt)}</Text>
            {item.unreadCount > 0 ? (
              <View style={styles.conversationBadge}>
                <Text style={styles.conversationBadgeText}>{item.unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </NativeCard>
    </Pressable>
  );
}

function MessageBubble({
  item,
  isOwn
}: {
  item: ConversationDetail["messages"][number];
  isOwn: boolean;
}) {
  const label =
    item.messageKind === "text"
      ? "Encrypted text message"
      : item.messageKind === "image"
        ? "Encrypted image message"
        : item.messageKind.replaceAll("_", " ");

  return (
    <View style={[styles.messageBubbleWrap, isOwn ? styles.messageBubbleOwnWrap : null]}>
      <View style={[styles.messageBubble, isOwn ? styles.messageBubbleOwn : null]}>
        <Text style={styles.messageBubbleLabel}>{label}</Text>
        {item.attachment?.url ? (
          <Pressable onPress={() => openExternalUrl(item.attachment?.url)}>
            <Text style={styles.messageAttachmentLink}>Open attachment</Text>
          </Pressable>
        ) : null}
        <Text style={styles.messageBubbleMeta}>
          {timeAgo(item.createdAt)}
          {item.reactions.length ? ` • ${item.reactions.length} reactions` : ""}
        </Text>
      </View>
    </View>
  );
}

function MarketListingCard({ item }: { item: MarketListing }) {
  const media = getMarketMedia(item);

  return (
    <View style={styles.marketCard}>
      {media ? <MediaPreview url={media.url} kind={media.kind} height={150} compact /> : null}
      <View style={styles.marketBody}>
        <Text numberOfLines={1} style={styles.marketTitle}>
          {item.title}
        </Text>
        <Text style={styles.marketPrice}>{formatCurrency(item.priceAmount)}</Text>
        <Text numberOfLines={2} style={styles.marketCopy}>
          {item.description}
        </Text>
        <Text style={styles.marketMeta}>
          {item.category} • {item.campusSpot}
        </Text>
      </View>
    </View>
  );
}

function MarketRequestCard({ item }: { item: MarketRequest }) {
  const media = getMarketMedia(item);

  return (
    <NativeCard>
      {media ? <MediaPreview url={media.url} kind={media.kind} height={180} compact /> : null}
      <Text style={styles.marketType}>{item.tab === "buying" ? "BUY REQUEST" : "LEND REQUEST"}</Text>
      <Text style={styles.marketTitle}>{item.title}</Text>
      <Text style={styles.marketPrice}>{item.budgetLabel || formatCurrency(item.budgetAmount)}</Text>
      <Text style={styles.marketCopy}>{item.detail}</Text>
      <Text style={styles.marketMeta}>
        {item.category} • {item.campusSpot} • {formatMetric(item.responseCount)} responses
      </Text>
    </NativeCard>
  );
}

function ResourceCard({ item }: { item: ResourceItem }) {
  return (
    <NativeCard>
      <Text style={styles.resourceType}>{item.type.toUpperCase()}</Text>
      <Text style={styles.resourceTitle}>{item.title}</Text>
      <Text style={styles.resourceDescription}>{item.description}</Text>
      <Text style={styles.resourceMeta}>{formatMetric(item.downloads)} downloads</Text>
    </NativeCard>
  );
}

function ActivityCard({ item }: { item: ActivityItem }) {
  return (
    <NativeCard>
      <Text style={styles.resourceType}>{item.activityType.replaceAll("_", " ").toUpperCase()}</Text>
      <Text style={styles.resourceDescription}>
        {item.entityType ? `${item.entityType} update` : "Campus signal"} • {timeAgo(item.createdAt)}
      </Text>
    </NativeCard>
  );
}

export default function App() {
  const [viewer] = useState(() => createMobileViewerSession());
  const runtimeConfig = getMobileRuntimeConfig();
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [shell, setShell] = useState<ClientShellResponse | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [stories, setStories] = useState<StoryCard[]>([]);
  const [feed, setFeed] = useState<FeedCard[]>([]);
  const [vibes, setVibes] = useState<FeedCard[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserSearchItem[]>([]);
  const [messages, setMessages] = useState<ChatConversationPreview[]>([]);
  const [marketDashboard, setMarketDashboard] = useState<MarketDashboardResponse | null>(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverLoaded, setDiscoverLoaded] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfileResponse | null>(null);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profilePanelsLoaded, setProfilePanelsLoaded] = useState(false);
  const [profilePanelsLoading, setProfilePanelsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const [searchResults, setSearchResults] = useState<UserSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRequestRef = useRef(0);

  async function loadCoreData(mode: "initial" | "refresh" = "initial") {
    if (mode === "refresh") {
      setIsRefreshing(true);
    } else {
      setIsBootLoading(true);
    }

    setBootstrapError(null);

    try {
      const [nextShell, nextProfile, nextMe, nextStories, nextFeed, nextVibes, nextSuggestedUsers, nextInbox] =
        await Promise.all([
          getClientShellData().catch(() => null),
          getViewerProfile(viewer).catch(() => null),
          getViewerMe(viewer).catch(() => null),
          getCampusStories(viewer).catch(() => ({ items: [] })),
          getCampusFeed(viewer, { limit: 16 }).catch(() => ({ items: [] })),
          getCampusVibes(viewer, 10).catch(() => ({ items: [] })),
          getSuggestedCampusUsers(viewer, 6).catch(() => ({ items: [] })),
          getChatInbox(viewer).catch(() => ({ items: [] }))
        ]);

      setShell(nextShell);
      setProfile(nextProfile);
      setMe(nextMe);
      setStories(asArray<StoryCard>(nextStories.items));
      setFeed(asArray<FeedCard>(nextFeed.items));
      setVibes(asArray<FeedCard>(nextVibes.items));
      setSuggestedUsers(asArray<UserSearchItem>(nextSuggestedUsers.items));
      setMessages(asArray<ChatConversationPreview>(nextInbox.items));
    } catch (error) {
      setBootstrapError(error instanceof Error ? error.message : "We could not load mobile data right now.");
    } finally {
      setIsBootLoading(false);
      setIsRefreshing(false);
    }
  }

  async function loadDiscoverData(force = false) {
    if (discoverLoading || (discoverLoaded && !force)) {
      return;
    }

    setDiscoverLoading(true);
    setDiscoverError(null);

    try {
      const nextMarketDashboard = await getMarketDashboard(viewer);
      setMarketDashboard(nextMarketDashboard);
      setDiscoverLoaded(true);
    } catch (error) {
      setDiscoverError(error instanceof Error ? error.message : "We could not load the campus marketplace.");
    } finally {
      setDiscoverLoading(false);
    }
  }

  async function loadProfilePanels() {
    const username = profile?.profile?.username;

    if (!username) {
      return;
    }

    setProfilePanelsLoading(true);
    setProfileError(null);

    try {
      const [nextPublicProfile, nextResources, nextActivity] = await Promise.all([
        getViewerPublicProfile(viewer, username).catch(() => null),
        getCampusResources(viewer, { limit: 4 }).catch(() => ({ items: [] })),
        getViewerActivity(viewer, 6).catch(() => ({ items: [] }))
      ]);

      setPublicProfile(nextPublicProfile);
      setResources(asArray<ResourceItem>(nextResources.items));
      setActivity(asArray<ActivityItem>(nextActivity.items));
      setProfilePanelsLoaded(true);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "We could not load your profile panels.");
    } finally {
      setProfilePanelsLoading(false);
    }
  }

  async function openConversation(conversationId: string) {
    setConversationLoading(true);
    setConversationError(null);

    try {
      const response = await getChatConversation(viewer, conversationId);
      setSelectedConversation(response.conversation);
    } catch (error) {
      setConversationError(error instanceof Error ? error.message : "We could not open this conversation right now.");
    } finally {
      setConversationLoading(false);
    }
  }

  useEffect(() => {
    loadCoreData();
  }, []);

  useEffect(() => {
    if (activeTab === "discover" && !deferredSearchQuery) {
      loadDiscoverData();
    }
  }, [activeTab, deferredSearchQuery]);

  useEffect(() => {
    if (activeTab === "profile" && profile?.profile?.username && !profilePanelsLoaded && !profilePanelsLoading) {
      loadProfilePanels();
    }
  }, [activeTab, profile?.profile?.username, profilePanelsLoaded, profilePanelsLoading]);

  useEffect(() => {
    const query = deferredSearchQuery;

    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    const currentRequest = ++searchRequestRef.current;
    setSearchLoading(true);
    setSearchError(null);

    searchCampusUsers(viewer, query, 12)
      .then((response) => {
        if (currentRequest !== searchRequestRef.current) {
          return;
        }

        startTransition(() => {
          setSearchResults(asArray<UserSearchItem>(response.items));
        });
      })
      .catch((error) => {
        if (currentRequest !== searchRequestRef.current) {
          return;
        }

        setSearchError(error instanceof Error ? error.message : "Search failed right now.");
      })
      .finally(() => {
        if (currentRequest === searchRequestRef.current) {
          setSearchLoading(false);
        }
      });
  }, [deferredSearchQuery, viewer]);

  const unreadChatCount = messages.reduce((sum, item) => sum + item.unreadCount, 0);
  const currentViewerUserId = me?.user.id ?? viewer.userId;
  const displayName = publicProfile?.profile.displayName ?? profile?.profile?.fullName ?? viewer.displayName;
  const username = publicProfile?.profile.username ?? profile?.profile?.username ?? viewer.email.split("@")[0];
  const collegeName =
    profile?.collegeName && profile.collegeName !== "Your campus"
      ? profile.collegeName
      : shell?.launchCampus.name ?? "Vyb Campus";
  const course = profile?.profile?.course ?? publicProfile?.profile.course ?? "B.Tech";
  const stream = profile?.profile?.stream ?? publicProfile?.profile.stream ?? "Computer Science";
  const stats = publicProfile?.stats ?? {
    posts: feed.length,
    followers: suggestedUsers.length * 9,
    following: Math.max(4, suggestedUsers.length + 1)
  };

  function renderHomeTab() {
    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadCoreData("refresh")} />}
      >
        <NativeCard>
          <Text style={styles.eyebrow}>VYB MOBILE</Text>
          <Text style={styles.heroTitle}>Native campus shell is alive.</Text>
          <Text style={styles.heroCopy}>
            Posts, vibes, stories, search, profile, and inbox are all reading the shared backend now. We can keep layering native interactions on top of this foundation.
          </Text>
          <View style={styles.heroMetaRow}>
            <MetaPill value={collegeName} />
            <MetaPill value={me?.membershipSummary.role ?? viewer.role} accent="lime" />
            <MetaPill value={`${formatMetric(feed.length)} posts`} accent="coral" />
          </View>
        </NativeCard>

        {shell ? (
          <NativeCard>
            <SectionHeader eyebrow={shell.hero.eyebrow} title={shell.hero.title} copy={shell.hero.summary} />
          </NativeCard>
        ) : null}

        <SectionHeaderRow title="Stories" count={stories.length} subtitle="Live story rail wired into mobile" />
        {stories.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRail}>
            {stories.map((item) => (
              <StoryRailCard key={item.id} item={item} />
            ))}
          </ScrollView>
        ) : (
          <EmptyState title="No stories yet" copy="As soon as stories land in the tenant feed, they will surface here." />
        )}

        <SectionHeaderRow title="Vibes" count={vibes.length} subtitle="Immersive short-form surface" />
        {vibes.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRail}>
            {vibes.map((item) => (
              <VibeCardView key={item.id} item={item} />
            ))}
          </ScrollView>
        ) : (
          <EmptyState title="No vibes yet" copy="Vibes are wired and will appear here once the API returns them." />
        )}

        <SectionHeaderRow title="Feed" count={feed.length} subtitle="Campus posts with real backend data" />
        {feed.length ? (
          feed.map((item) => <FeedCardView key={item.id} item={item} />)
        ) : (
          <EmptyState title="Feed is quiet" copy="The API wiring is ready; once posts exist, they will render in this list." />
        )}

        <SectionHeaderRow title="Suggested People" count={suggestedUsers.length} subtitle="Discovery recommendations" />
        {suggestedUsers.length ? (
          suggestedUsers.map((item) => <UserResultCard key={item.userId} item={item} />)
        ) : (
          <EmptyState title="No suggestions right now" copy="User discovery is wired and will populate when the backend returns campus matches." />
        )}
      </ScrollView>
    );
  }

  function renderDiscoverTab() {
    const listingItems = marketDashboard ? asArray<MarketListing>(marketDashboard.listings).slice(0, 5) : [];
    const requestItems = marketDashboard ? asArray<MarketRequest>(marketDashboard.requests).slice(0, 4) : [];

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={discoverLoading} onRefresh={() => loadDiscoverData(true)} />}
      >
        <NativeCard>
          <Text style={styles.sectionTitle}>Discover campus people</Text>
          <Text style={styles.sectionDescription}>
            Search is backed by the same user discovery API as the web app. Leave it blank and this tab becomes your market and campus spotlight surface.
          </Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearchQuery}
            placeholder="Search students, clubs, creators"
            placeholderTextColor="#7f91a7"
            style={styles.searchInput}
            value={searchQuery}
          />
        </NativeCard>

        {searchLoading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={colors.lime} />
          </View>
        ) : null}

        {deferredSearchQuery ? (
          <>
            <SectionHeaderRow title="Search Results" count={searchResults.length} subtitle={`Query: ${deferredSearchQuery}`} />
            {searchError ? <EmptyState title="Search hit a snag" copy={searchError} /> : null}
            {!searchLoading && !searchResults.length && !searchError ? (
              <EmptyState
                title="No matches yet"
                copy={`We searched for "${deferredSearchQuery}" but did not get campus results back.`}
              />
            ) : null}
            {searchResults.map((item) => (
              <UserResultCard key={item.userId} item={item} />
            ))}
          </>
        ) : (
          <>
            <NativeCard>
              <Text style={styles.sectionTitle}>Campus Pulse</Text>
              <Text style={styles.sectionDescription}>
                Quick mobile snapshot of the social and marketplace surfaces we have already wired into this app.
              </Text>
              <View style={styles.pulseGrid}>
                <View style={styles.pulseCard}>
                  <Text style={styles.pulseValue}>{formatMetric(stories.length)}</Text>
                  <Text style={styles.pulseLabel}>Stories</Text>
                </View>
                <View style={styles.pulseCard}>
                  <Text style={styles.pulseValue}>{formatMetric(vibes.length)}</Text>
                  <Text style={styles.pulseLabel}>Vibes</Text>
                </View>
                <View style={styles.pulseCard}>
                  <Text style={styles.pulseValue}>{formatMetric(unreadChatCount)}</Text>
                  <Text style={styles.pulseLabel}>Unread</Text>
                </View>
              </View>
            </NativeCard>

            <SectionHeaderRow title="Marketplace" count={listingItems.length} subtitle="Sale listings coming from `/v1/market`" />
            {discoverError ? <EmptyState title="Market load failed" copy={discoverError} /> : null}
            {discoverLoading ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator color={colors.cyan} />
              </View>
            ) : null}
            {listingItems.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRail}>
                {listingItems.map((item) => (
                  <MarketListingCard key={item.id} item={item} />
                ))}
              </ScrollView>
            ) : !discoverLoading && !discoverError ? (
              <EmptyState title="No live listings yet" copy="This space will fill with sale posts and media as soon as listings exist in the market dashboard." />
            ) : null}

            <SectionHeaderRow title="Requests" count={requestItems.length} subtitle="Buying and lending demand" />
            {requestItems.length ? (
              requestItems.map((item) => <MarketRequestCard key={item.id} item={item} />)
            ) : !discoverLoading ? (
              <EmptyState title="No requests yet" copy="Buying and lending requests will appear here once students publish them." />
            ) : null}

            <NativeCard>
              <Text style={styles.sectionTitle}>Events</Text>
              <Text style={styles.sectionDescription}>
                The current dev backend exposes social, chat, resources, and market directly. Campus events in this repo still live behind the web-side fallback layer, so we will wire the native events surface as soon as that API is exposed.
              </Text>
            </NativeCard>
          </>
        )}
      </ScrollView>
    );
  }

  function renderMessagesTab() {
    if (selectedConversation) {
      return (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={conversationLoading}
              onRefresh={() => openConversation(selectedConversation.id)}
            />
          }
        >
          <NativeCard>
            <Pressable onPress={() => setSelectedConversation(null)} style={styles.backRow}>
              <Text style={styles.backLink}>Back to inbox</Text>
            </Pressable>
            <Text style={styles.profileName}>{selectedConversation.peer.displayName}</Text>
            <Text style={styles.profileHandle}>
              @{selectedConversation.peer.username}
              {selectedConversation.peer.course ? ` • ${selectedConversation.peer.course}` : ""}
            </Text>
            <Text style={styles.sectionDescription}>
              Conversation detail is wired. Message sending and decryption are the next native layer after this inbox foundation.
            </Text>
          </NativeCard>

          {conversationError ? <EmptyState title="Conversation failed" copy={conversationError} /> : null}

          {asArray(selectedConversation.messages).length ? (
            asArray(selectedConversation.messages).map((item) => (
              <MessageBubble key={item.id} isOwn={item.senderUserId === currentViewerUserId} item={item} />
            ))
          ) : (
            <EmptyState title="No messages yet" copy="This thread is ready and waiting for the first secure message." />
          )}
        </ScrollView>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadCoreData("refresh")} />}
      >
        <NativeCard>
          <Text style={styles.sectionTitle}>Inbox</Text>
          <Text style={styles.sectionDescription}>
            Conversation previews and unread counts are live. Tap any thread to open its mobile detail view.
          </Text>
        </NativeCard>

        {conversationError ? <EmptyState title="Conversation failed" copy={conversationError} /> : null}

        {conversationLoading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={colors.lime} />
          </View>
        ) : null}

        {messages.length ? (
          messages.map((item) => <ConversationCard key={item.id} item={item} onOpen={openConversation} />)
        ) : (
          <EmptyState title="Inbox is empty" copy="Chat API is connected. New conversations will show here as soon as they exist." />
        )}
      </ScrollView>
    );
  }

  function renderProfileTab() {
    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || profilePanelsLoading}
            onRefresh={async () => {
              await loadCoreData("refresh");
              await loadProfilePanels();
            }}
          />
        }
      >
        <NativeCard>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileHandle}>
            @{username} • {viewer.email}
          </Text>
          <Text style={styles.profileMeta}>
            {course} • {stream} • {me?.membershipSummary.role ?? viewer.role}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{formatMetric(stats.posts)}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{formatMetric(stats.followers)}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{formatMetric(stats.following)}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
        </NativeCard>

        <NativeCard>
          <Text style={styles.sectionTitle}>Runtime</Text>
          <Text style={styles.runtimeLine}>Base URL: {runtimeConfig.baseUrl}</Text>
          <Text style={styles.runtimeLine}>Viewer ID: {currentViewerUserId}</Text>
          <Text style={styles.runtimeLine}>Tenant ID: {viewer.tenantId}</Text>
        </NativeCard>

        {profileError ? <EmptyState title="Profile panels failed" copy={profileError} /> : null}

        <SectionHeaderRow
          title="Your Posts"
          count={publicProfile?.posts.length ?? 0}
          subtitle="Pulled from the public profile API"
        />
        {publicProfile?.posts.length ? (
          publicProfile.posts.map((item) => <FeedCardView key={item.id} item={item} />)
        ) : (
          <EmptyState title="No profile posts yet" copy="As your public profile posts resolve, they will show up here in the native shell." />
        )}

        <SectionHeaderRow title="Resources" count={resources.length} subtitle="Recent academic uploads" />
        {resources.length ? (
          resources.map((item) => <ResourceCard key={item.id} item={item} />)
        ) : (
          <EmptyState title="No recent resources" copy="This panel is wired to `/v1/resources` and will populate when files exist." />
        )}

        <SectionHeaderRow title="Activity" count={activity.length} subtitle="Latest campus signals tied to your account" />
        {activity.length ? (
          activity.map((item) => <ActivityCard key={item.id} item={item} />)
        ) : (
          <EmptyState title="No recent activity" copy="Recent signals from the campus timeline will appear here once available." />
        )}
      </ScrollView>
    );
  }

  if (isBootLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.lime} size="large" />
          <Text style={styles.loadingTitle}>Booting native campus shell</Text>
          <Text style={styles.loadingCopy}>
            Pulling stories, vibes, feed, profile, and chat surfaces from the shared Vyb backend.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (bootstrapError && !feed.length && !messages.length) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Mobile shell could not connect.</Text>
          <Text style={styles.errorCopy}>{bootstrapError}</Text>
          <Text style={styles.errorHint}>
            Set `EXPO_PUBLIC_VYB_API_BASE_URL` to the machine running the backend if you are testing on a physical device.
          </Text>
          <Pressable onPress={() => loadCoreData()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <View style={styles.topBarIdentity}>
          <View style={styles.topBarAvatar}>
            <Text style={styles.topBarAvatarText}>{displayName.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.topBarTitle}>{displayName}</Text>
            <Text style={styles.topBarSubtitle}>
              {collegeName} • {activeTab}
            </Text>
          </View>
        </View>
        <View style={styles.topBarMeta}>
          <MetaPill value={`${formatMetric(feed.length)} feed`} />
          {unreadChatCount > 0 ? <MetaPill value={`${unreadChatCount} unread`} accent="lime" /> : null}
        </View>
      </View>

      <View style={styles.content}>
        {activeTab === "home" ? renderHomeTab() : null}
        {activeTab === "discover" ? renderDiscoverTab() : null}
        {activeTab === "messages" ? renderMessagesTab() : null}
        {activeTab === "profile" ? renderProfileTab() : null}
      </View>

      <View style={styles.tabBar}>
        <TabButton active={activeTab === "home"} badgeCount={stories.length} label="Home" onPress={() => setActiveTab("home")} />
        <TabButton
          active={activeTab === "discover"}
          badgeCount={marketDashboard?.listings.length}
          label="Discover"
          onPress={() => setActiveTab("discover")}
        />
        <TabButton
          active={activeTab === "messages"}
          badgeCount={unreadChatCount}
          label="Inbox"
          onPress={() => setActiveTab("messages")}
        />
        <TabButton active={activeTab === "profile"} label="Profile" onPress={() => setActiveTab("profile")} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12
  },
  loadingTitle: {
    color: "#f8fbff",
    fontSize: 22,
    fontWeight: "800"
  },
  loadingCopy: {
    color: "#b8c8d8",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center"
  },
  errorTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center"
  },
  errorCopy: {
    color: "#ffcfc5",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center"
  },
  errorHint: {
    color: "#b9c8d8",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  },
  retryButton: {
    backgroundColor: colors.lime,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  retryButtonText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  topBar: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  topBarIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1
  },
  topBarAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#18253a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center"
  },
  topBarAvatarText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800"
  },
  topBarTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800"
  },
  topBarSubtitle: {
    color: "#93a8bf",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
    textTransform: "capitalize"
  },
  topBarMeta: {
    alignItems: "flex-end",
    gap: 6
  },
  content: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 128,
    gap: 14
  },
  eyebrow: {
    color: colors.lime,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 8
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36
  },
  heroCopy: {
    color: "#d6e2ee",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16
  },
  metaPill: {
    borderRadius: 999,
    backgroundColor: "rgba(125, 226, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(125, 226, 255, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  metaPillLime: {
    backgroundColor: "rgba(186, 255, 67, 0.14)",
    borderColor: "rgba(186, 255, 67, 0.24)"
  },
  metaPillCoral: {
    backgroundColor: "rgba(255, 135, 95, 0.14)",
    borderColor: "rgba(255, 135, 95, 0.2)"
  },
  metaPillText: {
    color: "#d7f5ff",
    fontSize: 12,
    fontWeight: "700"
  },
  sectionHeaderWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800"
  },
  sectionDescription: {
    color: "#c7d4e1",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8
  },
  sectionSubtitle: {
    color: "#8ea5bd",
    fontSize: 13,
    marginTop: 4
  },
  sectionCount: {
    color: colors.cyan,
    fontSize: 13,
    fontWeight: "700"
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800"
  },
  emptyCopy: {
    color: "#c7d6e5",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8
  },
  horizontalRail: {
    gap: 14,
    paddingRight: 18
  },
  storyRailCard: {
    width: 220,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#132033",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  storyRailBody: {
    padding: 14
  },
  storyRailName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800"
  },
  storyRailMeta: {
    color: "#88a0b8",
    fontSize: 12,
    marginTop: 4
  },
  storyRailCaption: {
    color: "#d7e1ec",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8
  },
  vibeCard: {
    width: 290,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#132033",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  vibeOverlay: {
    padding: 16,
    gap: 8
  },
  vibeTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800"
  },
  vibeBody: {
    color: "#d4dfeb",
    fontSize: 14,
    lineHeight: 21
  },
  vibeMeta: {
    color: "#8fa7be",
    fontSize: 12,
    fontWeight: "700"
  },
  mediaPreviewImage: {
    width: "100%",
    backgroundColor: "#0e1725"
  },
  mediaPreviewCompact: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0
  },
  videoPreview: {
    width: "100%",
    backgroundColor: "#0f1726",
    justifyContent: "center",
    padding: 18,
    gap: 10
  },
  videoPreviewCompact: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0
  },
  videoPreviewEyebrow: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2
  },
  videoPreviewTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800"
  },
  videoPreviewCopy: {
    color: "#d0deea",
    fontSize: 14,
    lineHeight: 20
  },
  feedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  feedHeaderText: {
    flex: 1
  },
  feedAuthor: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800"
  },
  feedHandle: {
    color: "#90a6bc",
    fontSize: 13,
    marginTop: 4
  },
  feedTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 12
  },
  feedBody: {
    color: "#d0deea",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10
  },
  feedLocation: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 10,
    textTransform: "uppercase"
  },
  feedMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 14
  },
  feedMetric: {
    color: "#88a2bb",
    fontSize: 13,
    fontWeight: "700"
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(186, 255, 67, 0.16)"
  },
  avatarCircleAlt: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(125, 226, 255, 0.16)"
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800"
  },
  userBody: {
    flex: 1
  },
  userName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  },
  userHandle: {
    color: "#9bb0c5",
    fontSize: 13,
    marginTop: 4
  },
  userStats: {
    color: "#d3deea",
    fontSize: 13,
    marginTop: 6
  },
  conversationMeta: {
    alignItems: "flex-end",
    gap: 8
  },
  conversationTime: {
    color: "#90a5bb",
    fontSize: 12,
    fontWeight: "700"
  },
  conversationSnippet: {
    color: "#d4dfeb",
    fontSize: 13,
    marginTop: 6
  },
  conversationBadge: {
    minWidth: 26,
    borderRadius: 999,
    backgroundColor: colors.lime,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center"
  },
  conversationBadgeText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800"
  },
  messageBubbleWrap: {
    alignItems: "flex-start"
  },
  messageBubbleOwnWrap: {
    alignItems: "flex-end"
  },
  messageBubble: {
    maxWidth: "88%",
    borderRadius: 22,
    backgroundColor: "#132033",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8
  },
  messageBubbleOwn: {
    backgroundColor: "#17263d",
    borderColor: "rgba(125,226,255,0.18)"
  },
  messageBubbleLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700"
  },
  messageAttachmentLink: {
    color: colors.cyan,
    fontSize: 13,
    fontWeight: "700"
  },
  messageBubbleMeta: {
    color: "#91a7bd",
    fontSize: 12
  },
  searchInput: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0d1727",
    color: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginTop: 14
  },
  loaderWrap: {
    paddingVertical: 16
  },
  pulseGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16
  },
  pulseCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "#0d1726",
    paddingHorizontal: 14,
    paddingVertical: 18
  },
  pulseValue: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800"
  },
  pulseLabel: {
    color: "#8ea5bc",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6
  },
  marketCard: {
    width: 240,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#132033",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  marketBody: {
    padding: 14
  },
  marketType: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1
  },
  marketTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 8
  },
  marketPrice: {
    color: colors.lime,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 8
  },
  marketCopy: {
    color: "#d4dfea",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8
  },
  marketMeta: {
    color: "#90a5bb",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 10
  },
  profileName: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800"
  },
  profileHandle: {
    color: "#93a8be",
    fontSize: 14,
    marginTop: 8
  },
  profileMeta: {
    color: "#d2deea",
    fontSize: 15,
    marginTop: 10
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16
  },
  statBlock: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#0d1726",
    paddingHorizontal: 14,
    paddingVertical: 16
  },
  statValue: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800"
  },
  statLabel: {
    color: "#8ea5bc",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6
  },
  runtimeLine: {
    color: "#d4dfeb",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8
  },
  resourceType: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1
  },
  resourceTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 8
  },
  resourceDescription: {
    color: "#d3dfea",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8
  },
  resourceMeta: {
    color: "#90a5bb",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 10
  },
  backRow: {
    marginBottom: 12
  },
  backLink: {
    color: colors.cyan,
    fontSize: 14,
    fontWeight: "700"
  },
  tabBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#0a1422"
  },
  tabButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#101b2c",
    alignItems: "center",
    justifyContent: "center",
    gap: 4
  },
  tabButtonActive: {
    backgroundColor: "#17263d",
    borderWidth: 1,
    borderColor: "rgba(186, 255, 67, 0.22)"
  },
  tabLabel: {
    color: "#8fa5bb",
    fontSize: 13,
    fontWeight: "700"
  },
  tabLabelActive: {
    color: "#ffffff"
  },
  tabBadge: {
    minWidth: 20,
    borderRadius: 999,
    backgroundColor: colors.lime,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  tabBadgeText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "800"
  }
});
