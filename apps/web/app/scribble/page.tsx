import { redirect } from "next/navigation";

type ScribblePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ScribblePage({ searchParams }: ScribblePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const roomCode = getSearchParamValue(resolvedSearchParams.code)
    ?.trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/gu, "");

  redirect(roomCode ? `/hub/gameshub/scribble?code=${encodeURIComponent(roomCode)}` : "/hub/gameshub/scribble");
}
