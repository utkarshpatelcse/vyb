"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getFirebaseClientAuth, isFirebaseClientConfigured } from "../lib/firebase-client";

export function SignOutButton({
  className,
  redirectTo = "/login"
}: {
  className?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);

  async function handleSignOut() {
    setIsBusy(true);

    try {
      if (isFirebaseClientConfigured()) {
        const auth = await getFirebaseClientAuth();
        await auth.signOut().catch(() => undefined);
      }

      await fetch("/api/auth/session", {
        method: "DELETE"
      });

      router.replace(redirectTo);
      router.refresh();
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <button type="button" className={className} onClick={handleSignOut} disabled={isBusy}>
      {isBusy ? "Signing out..." : "Sign out"}
    </button>
  );
}
