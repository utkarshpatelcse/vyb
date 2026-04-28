import { redirect } from "next/navigation";

type JoinScribblePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function JoinScribblePage({ searchParams }: JoinScribblePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawCode = Array.isArray(resolvedSearchParams.code) ? resolvedSearchParams.code[0] : resolvedSearchParams.code;
  const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/gu, "") : "";

  redirect(code ? `/hub/gameshub/scribble?code=${encodeURIComponent(code)}` : "/hub/gameshub/scribble");
}
