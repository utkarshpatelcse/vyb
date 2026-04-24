"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearChatVault } from "../lib/chat-e2ee";
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
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setIsBusy(true);
    setError(null);

    try {
      await clearChatVault();

      if (isFirebaseClientConfigured()) {
        const auth = await getFirebaseClientAuth();
        await auth.signOut().catch(() => undefined);
      }

      await fetch("/api/auth/session", {
        method: "DELETE"
      });

      router.replace(redirectTo);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Secure chat vault could not be wiped. Close other VYB tabs and try again.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={handleSignOut} disabled={isBusy}>
        {isBusy ? "Signing out..." : "Sign out"}
      </button>
      {error && (
        <p role="alert">
          {error}
        </p>
      )}
    </>
  );
}
