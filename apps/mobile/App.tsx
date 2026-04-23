import type {
  ActivityItem,
  ChatConversationPreview,
  ClientShellResponse,
  FeedCard,
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
  getChatInbox,
  getClientShellData,
  getMobileRuntimeConfig,
  getSuggestedCampusUsers,
  getViewerActivity,
  getViewerMe,
  getViewerProfile,
  getViewerPublicProfile,
  searchCampusUsers
} from "./src/lib/backend";
import { createMobileViewerSession } from "./src/lib/dev-session";

type TabKey = "home" | "search" | "messages" | "profile";

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

  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric"
  });
}

function formatMetric(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: value > 999 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
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

function MetaPill({ value }: { value: string }) {
  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaPillText}>{value}</Text>
    </View>
  );
}

function StoryCardView({ item }: { item: StoryCard }) {
  return (
    <NativeCard>
      <View style={styles.storyHeader}>
        <Text style={styles.storyName}>{item.displayName}</Text>
        <MetaPill value={item.viewerHasSeen ? "Seen" : "Fresh"} />
      </View>
      <Text style={styles.storyMeta}>
        @{item.username} • {item.mediaType} • {timeAgo(item.createdAt)}
      </Text>
      <Text style={styles.storyCaption}>{item.caption || "Story is live with media playback ready."}</Text>
    </NativeCard>
  );
}

function FeedCardView({ item }: { item: FeedCard }) {
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
      {item.title ? <Text style={styles.feedTitle}>{item.title}</Text> : null}
      <Text style={styles.feedBody}>{item.body}</Text>
      <View style={styles.feedMetaRow}>
        <Text style={styles.feedMetric}>{formatMetric(item.reactions)} reactions</Text>
        <Text style={styles.feedMetric}>{formatMetric(item.comments)} comments</Text>
        {item.media.length ? <Text style={styles.feedMetric}>{item.media.length} media</Text> : null}
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

function ConversationCard({ item }: { item: ChatConversationPreview }) {
  const lastMessageLabel = item.lastMessage
    ? item.lastMessage.messageKind === "text"
      ? "Encrypted text message"
      : item.lastMessage.messageKind.replaceAll("_", " ")
    : "No messages yet";

  return (
    <NativeCard>
      <View style={styles.userRow}>
        <View style={styles.avatarCircleAlt}>
          <Text style={styles.avatarText}>{item.peer.displayName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.userBody}>
          <Text style={styles.userName}>{item.peer.displayName}</Text>
          <Text style={styles.userHandle}>@{item.peer.username}</Text>
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
        {item.entityType ? `${item.entityType} update` : "Campus activity signal"} • {timeAgo(item.createdAt)}
      </Text>
    </NativeCard>
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
  const [suggestedUsers, setSuggestedUsers] = useState<UserSearchItem[]>([]);
  const [messages, setMessages] = useState<ChatConversationPreview[]>([]);
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
      const [nextShell, nextProfile, nextMe, nextStories, nextFeed, nextSuggestedUsers, nextInbox] = await Promise.all([
        getClientShellData().catch(() => null),
        getViewerProfile(viewer).catch(() => null),
        getViewerMe(viewer).catch(() => null),
        getCampusStories(viewer).catch(() => ({ items: [] })),
        getCampusFeed(viewer, { limit: 14 }).catch(() => ({ items: [] })),
        getSuggestedCampusUsers(viewer, 6).catch(() => ({ items: [] })),
        getChatInbox(viewer).catch(() => ({ items: [] }))
      ]);

      setShell(nextShell);
      setProfile(nextProfile);
      setMe(nextMe);
      setStories(nextStories.items);
      setFeed(nextFeed.items);
      setSuggestedUsers(nextSuggestedUsers.items);
      setMessages(nextInbox.items);
    } catch (error) {
      setBootstrapError(error instanceof Error ? error.message : "We could not load mobile data right now.");
    } finally {
      setIsBootLoading(false);
      setIsRefreshing(false);
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
      setResources(nextResources.items);
      setActivity(nextActivity.items);
      setProfilePanelsLoaded(true);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "We could not load your profile panels.");
    } finally {
      setProfilePanelsLoading(false);
    }
  }

  useEffect(() => {
    loadCoreData();
  }, []);

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

    searchCampusUsers(viewer, query, 10)
      .then((response) => {
        if (currentRequest !== searchRequestRef.current) {
          return;
        }

        startTransition(() => {
          setSearchResults(response.items);
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
  const displayName = profile?.profile?.fullName ?? viewer.displayName;
  const username = profile?.profile?.username ?? viewer.email.split("@")[0];
  const collegeName = profile?.collegeName ?? shell?.launchCampus.name ?? "Vyb Campus";
  const stats = publicProfile?.stats ?? {
    posts: feed.length,
    followers: suggestedUsers.length * 9,
    following: Math.max(3, suggestedUsers.length + 1)
  };

  function renderHomeTab() {
    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadCoreData("refresh")} />}
      >
        <NativeCard>
          <Text style={styles.eyebrow}>VYB MOBILE</Text>
          <Text style={styles.heroTitle}>Native home feed is now wired.</Text>
          <Text style={styles.heroCopy}>
            {displayName} is loaded through the shared contracts layer, and this shell is already talking to the live backend.
          </Text>
          <View style={styles.heroMetaRow}>
            <MetaPill value={collegeName} />
            <MetaPill value={me?.membershipSummary.role ?? viewer.role} />
          </View>
        </NativeCard>

        {shell ? (
          <NativeCard>
            <SectionHeader eyebrow={shell.hero.eyebrow} title={shell.hero.title} copy={shell.hero.summary} />
          </NativeCard>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Stories</Text>
          <Text style={styles.sectionCount}>{stories.length}</Text>
        </View>
        {stories.length ? (
          stories.map((item) => <StoryCardView key={item.id} item={item} />)
        ) : (
          <EmptyState title="No stories yet" copy="As soon as stories land in the tenant feed, they will surface here." />
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Feed</Text>
          <Text style={styles.sectionCount}>{feed.length}</Text>
        </View>
        {feed.length ? (
          feed.map((item) => <FeedCardView key={item.id} item={item} />)
        ) : (
          <EmptyState title="Feed is quiet" copy="The API wiring is ready; once posts exist, they will render in this list." />
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Suggested people</Text>
          <Text style={styles.sectionCount}>{suggestedUsers.length}</Text>
        </View>
        {suggestedUsers.length ? (
          suggestedUsers.map((item) => <UserResultCard key={item.userId} item={item} />)
        ) : (
          <EmptyState title="No suggestions right now" copy="User discovery is wired and will populate when the backend returns campus matches." />
        )}
      </ScrollView>
    );
  }

  function renderSearchTab() {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <NativeCard>
          <Text style={styles.sectionTitle}>Search campus users</Text>
          <Text style={styles.sectionDescription}>
            Search is backed by the same user discovery API as the web app. Start typing a name or username.
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

        {searchError ? <EmptyState title="Search hit a snag" copy={searchError} /> : null}

        {!searchLoading && deferredSearchQuery && !searchResults.length && !searchError ? (
          <EmptyState
            title="No matches yet"
            copy={`We searched for "${deferredSearchQuery}" but did not get campus results back.`}
          />
        ) : null}

        {searchResults.map((item) => (
          <UserResultCard key={item.userId} item={item} />
        ))}

        {!deferredSearchQuery ? (
          <EmptyState title="Search is ready" copy="Type a query and this screen will fetch results from `/v1/users/search`." />
        ) : null}
      </ScrollView>
    );
  }

  function renderMessagesTab() {
    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadCoreData("refresh")} />}
      >
        <NativeCard>
          <Text style={styles.sectionTitle}>Messages</Text>
          <Text style={styles.sectionDescription}>
            Inbox wiring is live. Conversation previews and unread counts are coming from the shared chat API.
          </Text>
        </NativeCard>

        {messages.length ? (
          messages.map((item) => <ConversationCard key={item.id} item={item} />)
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
            {profile?.profile?.course ?? "Course pending"} • {profile?.profile?.stream ?? "Stream pending"} •{" "}
            {me?.membershipSummary.role ?? viewer.role}
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
          <Text style={styles.runtimeLine}>Viewer ID: {viewer.userId}</Text>
          <Text style={styles.runtimeLine}>Tenant ID: {viewer.tenantId}</Text>
        </NativeCard>

        {profileError ? <EmptyState title="Profile panels failed" copy={profileError} /> : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Resources</Text>
          <Text style={styles.sectionCount}>{resources.length}</Text>
        </View>
        {resources.length ? (
          resources.map((item) => <ResourceCard key={item.id} item={item} />)
        ) : (
          <EmptyState title="No recent resources" copy="This panel is wired to `/v1/resources` and will populate when files exist." />
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Activity</Text>
          <Text style={styles.sectionCount}>{activity.length}</Text>
        </View>
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
          <Text style={styles.loadingTitle}>Wiring mobile data</Text>
          <Text style={styles.loadingCopy}>Bootstrapping the native shell against your backend contracts.</Text>
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
            Set `EXPO_PUBLIC_VYB_API_BASE_URL` if you are running on a physical device or a different host machine.
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
        <View>
          <Text style={styles.topBarTitle}>{displayName}</Text>
          <Text style={styles.topBarSubtitle}>
            {collegeName} • {activeTab}
          </Text>
        </View>
        {unreadChatCount > 0 ? <MetaPill value={`${unreadChatCount} unread`} /> : null}
      </View>

      <View style={styles.content}>
        {activeTab === "home" ? renderHomeTab() : null}
        {activeTab === "search" ? renderSearchTab() : null}
        {activeTab === "messages" ? renderMessagesTab() : null}
        {activeTab === "profile" ? renderProfileTab() : null}
      </View>

      <View style={styles.tabBar}>
        <TabButton active={activeTab === "home"} badgeCount={stories.length} label="Home" onPress={() => setActiveTab("home")} />
        <TabButton active={activeTab === "search"} label="Search" onPress={() => setActiveTab("search")} />
        <TabButton
          active={activeTab === "messages"}
          badgeCount={unreadChatCount}
          label="Messages"
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
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  topBarTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800"
  },
  topBarSubtitle: {
    color: "#93a8bf",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
    textTransform: "capitalize"
  },
  content: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
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
  metaPillText: {
    color: "#d7f5ff",
    fontSize: 12,
    fontWeight: "700"
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6
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
  sectionCount: {
    color: colors.cyan,
    fontSize: 13,
    fontWeight: "700"
  },
  storyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  storyName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  },
  storyMeta: {
    color: "#87a0b8",
    fontSize: 13,
    marginTop: 8
  },
  storyCaption: {
    color: "#d8e3ef",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10
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
    minHeight: 54,
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
