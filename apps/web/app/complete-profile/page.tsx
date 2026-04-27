import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSuperAdminEmail } from "../../src/lib/admin-access";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";

export default async function CompleteProfileRedirectPage() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (viewer && isSuperAdminEmail(viewer.email)) {
    redirect("/admin");
  }

  redirect("/onboarding");
}
