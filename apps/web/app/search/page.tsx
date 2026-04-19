import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CampusSearchShell } from "../../src/components/campus-search-shell";
import { searchCampusUsers, getViewerProfile } from "../../src/lib/backend";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
  }>;
}) {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  const [{ q = "" }, profile] = await Promise.all([searchParams, getViewerProfile(viewer).catch(() => null)]);

  if (!profile?.profileCompleted || !profile.profile?.username) {
    redirect("/onboarding");
  }

  const trimmedQuery = q.trim();
  const results = trimmedQuery
    ? await searchCampusUsers(viewer, trimmedQuery).catch(() => ({
        query: trimmedQuery,
        items: []
      }))
    : {
        query: "",
        items: []
      };

  return (
    <CampusSearchShell
      initialQuery={trimmedQuery}
      results={results.items}
      viewerUsername={profile.profile.username}
      hasSearched={Boolean(trimmedQuery)}
    />
  );
}
