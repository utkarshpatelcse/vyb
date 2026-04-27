import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SuperAdminPortal } from "../../src/components/super-admin-portal";
import { isSuperAdminEmail } from "../../src/lib/admin-access";
import { readDevSessionFromCookieStore } from "../../src/lib/dev-session";
import { getSuperAdminSnapshot } from "../../src/lib/super-admin-store";
import "./admin.css";

export default async function SuperAdminPage() {
  const viewer = readDevSessionFromCookieStore(await cookies());

  if (!viewer) {
    redirect("/login");
  }

  if (!isSuperAdminEmail(viewer.email)) {
    redirect("/home");
  }

  const snapshot = await getSuperAdminSnapshot();

  return <SuperAdminPortal initialSnapshot={snapshot} />;
}
