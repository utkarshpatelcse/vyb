import { redirect } from "next/navigation";

type EventsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const eventId = getSearchParamValue(resolvedSearchParams.eventId)?.trim();

  redirect(eventId ? `/hub?tab=events&eventId=${encodeURIComponent(eventId)}` : "/hub?tab=events");
}
