import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getViewerMe, getViewerProfile } from "../../src/lib/backend";
import { CampusHomeShell } from "../../src/components/campus-home-shell";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";

type StoryItem = {
  id: string;
  handle: string;
  imageUrl: string;
};

type PostItem = {
  id: string;
  author: string;
  caption: string;
  imageUrl: string;
  likes: string;
  location: string;
};

export default async function AuthenticatedHomePage() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const [profile, me] = await Promise.all([getViewerProfile(viewer).catch(() => null), getViewerMe(viewer).catch(() => null)]);

  if (!profile?.profileCompleted) {
    redirect("/onboarding");
  }

  const stories: StoryItem[] = [
    { id: "1", handle: "akash_v", imageUrl: "https://i.pravatar.cc/120?img=12" },
    { id: "2", handle: "priya.dev", imageUrl: "https://i.pravatar.cc/120?img=32" },
    { id: "3", handle: "rahul.vns", imageUrl: "https://i.pravatar.cc/120?img=14" },
    { id: "4", handle: "sneha.ui", imageUrl: "https://i.pravatar.cc/120?img=25" },
    { id: "5", handle: "kiet.culture", imageUrl: "https://i.pravatar.cc/120?img=18" },
    { id: "6", handle: "ece.core", imageUrl: "https://i.pravatar.cc/120?img=44" }
  ];

  const posts: PostItem[] = [
    {
      id: "1",
      author: "utkarsh_vyb",
      caption: "Building the VYB experience for one trusted campus at a time.",
      imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
      likes: "1,284",
      location: "Innovation Lab"
    },
    {
      id: "2",
      author: "campus.frame",
      caption: "Tonight's open-mic energy was unreal. More moments from KIET soon.",
      imageUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=80",
      likes: "842",
      location: "Central Auditorium"
    },
    {
      id: "3",
      author: "design.circle",
      caption: "When product, community, and identity finally feel like one app.",
      imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
      likes: "967",
      location: "Studio Bay"
    }
  ];

  const viewerName = profile.profile?.fullName ?? viewer.displayName;

  return (
    <CampusHomeShell
      viewerName={viewerName}
      collegeName={profile.collegeName}
      viewerEmail={viewer.email}
      course={profile.profile?.course}
      stream={profile.profile?.stream}
      role={me?.membershipSummary.role ?? viewer.role}
      stories={stories}
      initialPosts={posts}
    />
  );
}
