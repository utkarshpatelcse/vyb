"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User
} from "firebase/auth";
import {
  createGoogleProvider,
  getFirebaseClientAuth,
  isFirebaseClientConfigured
} from "../lib/firebase-client";

type Mode = "sign-in" | "sign-up";

function mapFirebaseError(code: string) {
  switch (code) {
    case "auth/email-already-in-use":
      return "Ye email pehle se registered hai. Sign in karo ya password reset karo.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email ya password galat hai.";
    case "auth/invalid-email":
      return "Valid college email dalo.";
    case "auth/weak-password":
      return "Password kam se kam 6 characters ka rakho.";
    case "auth/popup-closed-by-user":
      return "Google sign-in popup close ho gaya tha.";
    case "auth/popup-blocked":
      return "Browser ne popup block kar diya. Popup allow karke dobara try karo.";
    case "auth/unauthorized-domain":
      return "Ye domain Firebase Auth ke liye authorize nahi hai.";
    case "auth/operation-not-allowed":
      return "Firebase Console me Email/Password ya Google sign-in provider enable karo.";
    default:
      return "Login flow abhi complete nahi ho paaya. Ek baar phir try karo.";
  }
}

async function activateServerSession(user: User) {
  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      idToken,
      displayName: user.displayName ?? user.email?.split("@")[0] ?? "Vyb Explorer"
    })
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Server session create nahi ho paayi.");
  }
}

export function DevSessionCard({
  viewer
}: {
  viewer: {
    displayName: string;
    email: string;
  } | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [displayName, setDisplayName] = useState(viewer?.displayName ?? "Vyb Explorer");
  const [email, setEmail] = useState(viewer?.email ?? "");
  const [password, setPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleEmailAuth() {
    setMessage(null);
    setIsBusy(true);

    try {
      const auth = await getFirebaseClientAuth();

      if (mode === "sign-up") {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, {
          displayName: displayName.trim() || "Vyb Explorer"
        });
        await sendEmailVerification(credential.user);
        await signOut(auth);
        setPassword("");
        setMode("sign-in");
        setMessage("Verification mail send ho gayi. Inbox open karo, verify karo, phir sign in karo.");
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      await credential.user.reload();

      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user).catch(() => undefined);
        setMessage("Email abhi verify nahi hai. Verification mail dubara bhej di gayi hai.");
        await signOut(auth);
        return;
      }

      await activateServerSession(credential.user);
      setPassword("");
      setMessage("Vyb session activate ho gaya.");
      router.refresh();
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error && typeof error.code === "string"
          ? error.code
          : "unknown";
      const fallback = error instanceof Error ? error.message : "unknown";
      setMessage(mapFirebaseError(code) || fallback);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleGoogleAuth() {
    setMessage(null);
    setIsBusy(true);

    try {
      const auth = await getFirebaseClientAuth();
      const credential = await signInWithPopup(auth, createGoogleProvider());

      if (!credential.user.email) {
        throw new Error("Google account se email nahi mili.");
      }

      await activateServerSession(credential.user);
      setMessage("Google account se Vyb session activate ho gaya.");
      router.refresh();
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error && typeof error.code === "string"
          ? error.code
          : "unknown";
      const fallback = error instanceof Error ? error.message : "unknown";
      setMessage(mapFirebaseError(code) || fallback);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSignOut() {
    setMessage(null);
    setIsBusy(true);

    try {
      if (isFirebaseClientConfigured()) {
        const auth = await getFirebaseClientAuth();
        await signOut(auth).catch(() => undefined);
      }

      await fetch("/api/auth/session", {
        method: "DELETE"
      });

      setPassword("");
      setMessage("Session clear ho gayi.");
      router.refresh();
    } finally {
      setIsBusy(false);
    }
  }

  if (viewer) {
    return (
      <div className="cl-auth-card">
        <div className="cl-session-pill">
          <span />
          Vyb session active
        </div>
        <h3>{viewer.displayName}</h3>
        <p>{viewer.email}</p>
        <p className="cl-panel-note">
          Ab ye viewer state real Firebase Auth se aa rahi hai, aur same identity gateway tak pass ho sakti
          hai.
        </p>
        <div className="cl-form-actions">
          <button type="button" className="cl-button-primary" onClick={handleSignOut} disabled={isBusy}>
            {isBusy ? "Signing out..." : "Sign out"}
          </button>
        </div>
        {message ? <p className="cl-form-message">{message}</p> : null}
      </div>
    );
  }

  if (!isFirebaseClientConfigured()) {
    return (
      <div className="cl-auth-card">
        <h3>Firebase web config missing</h3>
        <p className="cl-panel-note">
          `NEXT_PUBLIC_FIREBASE_*` env values complete honi chahiye tabhi real login UI chalegi.
        </p>
      </div>
    );
  }

  return (
    <div className="cl-auth-card">
      <div className="cl-auth-mode-switch" role="tablist" aria-label="Vyb auth modes">
        <button
          type="button"
          className={mode === "sign-in" ? "cl-auth-mode-active" : ""}
          onClick={() => setMode("sign-in")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={mode === "sign-up" ? "cl-auth-mode-active" : ""}
          onClick={() => setMode("sign-up")}
        >
          Create account
        </button>
      </div>

      <h3>{mode === "sign-in" ? "Login with your college email" : "Create your campus account"}</h3>
      <p className="cl-panel-note">
        College email se sign in karo. Agar pehli baar ho, account banao aur verification mail confirm karo.
      </p>

      {mode === "sign-up" ? (
        <label className="cl-field">
          <span>Display name</span>
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Utkarsh Patel" />
        </label>
      ) : null}

      <label className="cl-field">
        <span>College email</span>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@college.edu"
          type="email"
          autoComplete="email"
        />
      </label>

      <label className="cl-field">
        <span>Password</span>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 6 characters"
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
        />
      </label>

      <div className="cl-form-actions">
        <button type="button" className="cl-button-primary" onClick={handleEmailAuth} disabled={isBusy}>
          {isBusy ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create and verify"}
        </button>
        <button type="button" className="cl-button-secondary" onClick={handleGoogleAuth} disabled={isBusy}>
          Continue with Google
        </button>
      </div>

      <p className="cl-auth-footnote">
        Google Workspace college mail ho to Google se bhi aa sakte ho. Warna email/password + verification use karo.
      </p>
      {message ? <p className="cl-form-message">{message}</p> : null}
    </div>
  );
}
