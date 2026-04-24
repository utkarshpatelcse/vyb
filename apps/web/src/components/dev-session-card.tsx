"use client";

import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User
} from "firebase/auth";
import { createGoogleProvider, getFirebaseClientAuth, isFirebaseClientConfigured } from "../lib/firebase-client";
import {
  getCollegeEmailMessage,
  getCollegeEmailPlaceholder,
  isAllowedCollegeEmail,
  launchCollege,
  normalizeEmail
} from "../lib/college-access";
import { VybLogoLockup } from "./vyb-logo";

type Mode = "sign-in" | "sign-up";
type FeedbackTone = "neutral" | "success" | "error";
type AuthFeedback = {
  tone: FeedbackTone;
  title: string;
  message: string;
  code?: string | null;
  details?: string | null;
};
type AuthFailure = Error & {
  code?: string;
  details?: unknown;
  step?: string;
};
type AuthWithStateReady = {
  currentUser: User | null;
  authStateReady?: () => Promise<void>;
};

const GOOGLE_REDIRECT_INTENT_KEY = "vyb-google-redirect-intent";

function GoogleGlyph() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.23 36 24 36c-6.627 0-12-5.373-12-12
        s5.373-12 12-12c3.059 0 5.842 1.155 7.961 3.039l5.657-5.657C34.046 6.053 29.27 4 24 4
        12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.155
        7.961 3.039l5.657-5.657C34.046 6.053 29.27 4 24 4c-7.682 0-14.344 4.337-17.694 10.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.143 35.091 26.715 36 24 36
        c-5.209 0-9.617-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.084 5.571
        .001-.001 6.19 5.238 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

function mapFirebaseError(code: string) {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account already exists for this email address.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The email or password is incorrect.";
    case "auth/invalid-email":
      return "Enter a valid college email address.";
    case "auth/weak-password":
      return "Use a password with at least 8 characters.";
    case "auth/popup-closed-by-user":
      return "The Google sign-in window was closed before completion.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in window. Allow pop-ups and try again.";
    case "auth/unauthorized-domain":
      return "This domain is not enabled for Firebase Authentication.";
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled in Firebase Authentication.";
    case "auth/cancelled-popup-request":
      return "Another Google sign-in request is already in progress.";
    case "auth/network-request-failed":
      return "A network issue interrupted the request. Check your connection and try again.";
    case "auth/operation-not-supported-in-this-environment":
      return "This browser cannot complete popup sign-in. Redirect sign-in will be used instead.";
    case "auth/too-many-requests":
      return "Too many attempts were made. Please wait a moment and try again.";
    case "COLLEGE_DOMAIN_NOT_ALLOWED":
      return getCollegeEmailMessage();
    case "COLLEGE_ACCESS_PENDING":
      return "Your campus access is not active yet.";
    case "EMAIL_NOT_VERIFIED":
      return "Verify your college email before you continue.";
    case "PASSWORD_MISMATCH":
      return "Your password confirmation does not match.";
    default:
      return null;
  }
}

function logAuthEvent(level: "info" | "warn" | "error", event: string, payload?: Record<string, unknown>) {
  const logger = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  logger(`[auth] ${event}`, payload ?? {});
}

function logAuthFailure(event: string, error: unknown, payload?: Record<string, unknown>) {
  console.error(
    `[auth] ${event}`,
    {
      code: extractErrorCode(error),
      message: extractErrorMessage(error, "Authentication request failed."),
      details:
        typeof error === "object" && error && "details" in error ? normalizeFeedbackDetails(error.details) : null,
      ...(payload ?? {})
    },
    error
  );
}

function isExpectedAuthIssue(code: string) {
  return [
    "COLLEGE_DOMAIN_NOT_ALLOWED",
    "COLLEGE_ACCESS_PENDING",
    "EMAIL_NOT_VERIFIED",
    "PASSWORD_MISMATCH",
    "auth/popup-closed-by-user",
    "auth/popup-blocked",
    "auth/cancelled-popup-request",
    "auth/operation-not-supported-in-this-environment",
    "auth/email-already-in-use",
    "auth/invalid-credential",
    "auth/wrong-password",
    "auth/user-not-found",
    "auth/invalid-email",
    "auth/weak-password",
    "auth/network-request-failed",
    "auth/too-many-requests"
  ].includes(code);
}

function extractErrorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error && typeof error.code === "string"
    ? error.code
    : "unknown";
}

function extractErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function normalizeFeedbackDetails(details: unknown) {
  if (!details) {
    return null;
  }

  if (typeof details === "string") {
    return details;
  }

  if (typeof details === "object" && details && "message" in details && typeof details.message === "string") {
    return details.message;
  }

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

function buildFeedback({
  tone,
  title,
  message,
  code = null,
  details = null
}: {
  tone: FeedbackTone;
  title: string;
  message: string;
  code?: string | null;
  details?: string | null;
}) {
  return {
    tone,
    title,
    message,
    code,
    details
  } satisfies AuthFeedback;
}

function getFriendlyErrorCopy(code: string, fallbackTitle: string, fallbackMessage: string) {
  switch (code) {
    case "COLLEGE_DOMAIN_NOT_ALLOWED":
      return {
        title: "Use your college email",
        message: getCollegeEmailMessage()
      };
    case "EMAIL_NOT_VERIFIED":
      return {
        title: "Check your inbox",
        message: "Verify your college email first, then sign in again."
      };
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return {
        title: "Check your details",
        message: "The email or password is incorrect."
      };
    case "auth/popup-closed-by-user":
      return {
        title: "Sign-in cancelled",
        message: "Google sign-in was closed before it finished."
      };
    case "auth/popup-blocked":
      return {
        title: "Allow pop-ups",
        message: "Your browser blocked the Google window. Allow pop-ups and try again."
      };
    default:
      return {
        title: fallbackTitle,
        message: fallbackMessage
      };
  }
}

function buildErrorFeedback(error: unknown, title: string, fallbackMessage: string) {
  const code = extractErrorCode(error);
  const message = mapFirebaseError(code) ?? extractErrorMessage(error, fallbackMessage);
  const friendlyCopy = getFriendlyErrorCopy(code, title, message);
  const details =
    typeof error === "object" && error && "details" in error
      ? normalizeFeedbackDetails(error.details)
      : null;

  if (isExpectedAuthIssue(code)) {
    return buildFeedback({
      tone: "error",
      title: friendlyCopy.title,
      message: friendlyCopy.message
    });
  }

  return buildFeedback({
    tone: "error",
    title: friendlyCopy.title,
    message: friendlyCopy.message,
    code: code === "unknown" ? null : code,
    details
  });
}

function persistGoogleRedirectIntent(intent: Mode) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(GOOGLE_REDIRECT_INTENT_KEY, intent);
}

function readGoogleRedirectIntent() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(GOOGLE_REDIRECT_INTENT_KEY) as Mode | null;
}

function clearGoogleRedirectIntent() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(GOOGLE_REDIRECT_INTENT_KEY);
}

async function waitForResolvedFirebaseUser(auth: AuthWithStateReady, timeoutMs = 10000) {
  if (typeof window === "undefined") {
    return auth.currentUser;
  }

  if (typeof auth.authStateReady === "function") {
    await auth.authStateReady().catch(() => undefined);
  }

  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise<User | null>((resolve) => {
    const timeoutId = window.setTimeout(() => {
      unsubscribe();
      resolve(auth.currentUser);
    }, timeoutMs);

    const unsubscribe = onAuthStateChanged(
      auth as never,
      (user) => {
        window.clearTimeout(timeoutId);
        unsubscribe();
        resolve(user);
      },
      () => {
        window.clearTimeout(timeoutId);
        unsubscribe();
        resolve(auth.currentUser);
      }
    );
  });
}

function navigateAfterAuth(nextPath: string) {
  logAuthEvent("info", "auth-navigation", {
    nextPath
  });

  if (typeof window !== "undefined") {
    window.location.assign(nextPath);
  }
}

function isIosStandaloneMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (typeof navigator !== "undefined" && "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent.toLowerCase();
  const isIosDevice =
    /iphone|ipad|ipod/.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  return standalone && isIosDevice;
}

function buildEmailVerificationActionSettings() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return {
    url: `${window.location.origin}/login?verified=1`,
    handleCodeInApp: false
  };
}

function createCollegeDomainError() {
  const error = new Error(getCollegeEmailMessage()) as AuthFailure;
  error.code = "COLLEGE_DOMAIN_NOT_ALLOWED";
  error.details = {
    allowedDomain: launchCollege.domain
  };
  return error;
}

function ensureAllowedCollegeEmail(email: string) {
  if (!isAllowedCollegeEmail(email)) {
    throw createCollegeDomainError();
  }
}

async function activateServerSession(user: User) {
  const normalizedEmail = normalizeEmail(user.email ?? "");
  logAuthEvent("info", "session-bootstrap:start", {
    uid: user.uid,
    email: normalizedEmail
  });

  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      idToken,
      displayName: user.displayName ?? user.email?.split("@")[0] ?? "Vyb Student"
    })
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        nextPath?: string;
        error?: {
          code?: string;
          message?: string;
          details?: unknown;
        };
      }
    | null;

  if (!response.ok) {
    const error = new Error(payload?.error?.message ?? "The authenticated session could not be created.") as AuthFailure;
    error.code = payload?.error?.code;
    error.details = payload?.error?.details ?? null;
    error.step = "session-bootstrap";
    throw error;
  }

  logAuthEvent("info", "session-bootstrap:success", {
    uid: user.uid,
    email: normalizedEmail,
    nextPath: payload?.nextPath ?? "/home"
  });

  return {
    nextPath: payload?.nextPath ?? "/home"
  };
}

export function DevSessionCard({
  viewer,
  redirectTo = "/home"
}: {
  viewer: {
    displayName: string;
    email: string;
  } | null;
  redirectTo?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState(viewer?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);

  useEffect(() => {
    let cancelled = false;

    function safeSetBusy(value: boolean) {
      if (!cancelled) {
        setIsBusy(value);
      }
    }

    function safeSetFeedback(value: AuthFeedback | null) {
      if (!cancelled) {
        setFeedback(value);
      }
    }

    async function resolveRedirectAuth() {
      if (!isFirebaseClientConfigured()) {
        return;
      }

      const storedIntent = readGoogleRedirectIntent();
      if (!storedIntent) {
        return;
      }

      try {
        const auth = await getFirebaseClientAuth();

        logAuthEvent("info", "redirect-auth:check", {
          hasStoredIntent: true,
          intent: storedIntent,
          currentUserAtStart: auth.currentUser?.email ?? null
        });

        const result = await getRedirectResult(auth);

        logAuthEvent("info", "redirect-auth:result", {
          hasRedirectUser: Boolean(result?.user),
          redirectEmail: result?.user?.email ?? null
        });

        let activeUser = result?.user ?? null;

        if (!activeUser) {
          activeUser = await waitForResolvedFirebaseUser(auth);
        }

        if (!activeUser) {
          if (storedIntent) {
            logAuthEvent("warn", "redirect-auth:user-missing", {
              intent: storedIntent
            });
            clearGoogleRedirectIntent();
            safeSetFeedback(
              buildFeedback({
                tone: "error",
                title: "Google sign-in did not finish",
                message:
                  "Google returned to the app, but no authenticated Firebase user session was restored. Please try again.",
                code: "GOOGLE_REDIRECT_RECOVERY_FAILED"
              })
            );
          }
          return;
        }

        await activeUser.reload().catch(() => undefined);
        const resolvedEmail = normalizeEmail(activeUser.email ?? "");
        const usesPasswordProvider = activeUser.providerData.some((provider) => provider.providerId === "password");

        logAuthEvent("info", "redirect-auth:resolved", {
          hasRedirectResult: Boolean(result?.user),
          uid: activeUser.uid,
          email: resolvedEmail,
          providers: activeUser.providerData.map((provider) => provider.providerId)
        });

        ensureAllowedCollegeEmail(resolvedEmail);

        if (usesPasswordProvider && !activeUser.emailVerified) {
          await sendEmailVerification(activeUser).catch(() => undefined);
          await signOut(auth).catch(() => undefined);
          clearGoogleRedirectIntent();
          safeSetFeedback(
            buildFeedback({
              tone: "error",
              title: "Email verification required",
              message: "Verify your college email before continuing. A fresh verification link has been sent.",
              code: "EMAIL_NOT_VERIFIED"
            })
          );
          return;
        }

        safeSetBusy(true);
        safeSetFeedback(
          buildFeedback({
            tone: "neutral",
            title: "Finishing sign-in",
            message: "Completing your authenticated session and checking your onboarding status."
          })
        );
        const session = await activateServerSession(activeUser);
        clearGoogleRedirectIntent();
        logAuthEvent("info", "redirect-auth:navigate", {
          uid: activeUser.uid,
          nextPath: session.nextPath ?? redirectTo
        });
        navigateAfterAuth(session.nextPath ?? redirectTo);
      } catch (error) {
        if (isFirebaseClientConfigured()) {
          const auth = await getFirebaseClientAuth();
          await signOut(auth).catch(() => undefined);
        }
        clearGoogleRedirectIntent();

        logAuthFailure("redirect-auth:failed", error, {
          intent: storedIntent
        });

        safeSetFeedback(buildErrorFeedback(error, "Google sign-in failed", "Google sign-in failed."));
      } finally {
        safeSetBusy(false);
      }
    }

    void resolveRedirectAuth();

    return () => {
      cancelled = true;
    };
  }, [redirectTo, router]);

  useEffect(() => {
    let cancelled = false;

    function safeSetBusy(value: boolean) {
      if (!cancelled) {
        setIsBusy(value);
      }
    }

    function safeSetFeedback(value: AuthFeedback | null) {
      if (!cancelled) {
        setFeedback(value);
      }
    }

    async function resolveEmailVerificationReturn() {
      if (!isFirebaseClientConfigured() || searchParams.get("verified") !== "1") {
        return;
      }

      try {
        const auth = await getFirebaseClientAuth();
        const activeUser = await waitForResolvedFirebaseUser(auth, 4000);

        logAuthEvent("info", "email-verification:return", {
          currentUserEmail: activeUser?.email ?? null
        });

        if (!activeUser) {
          safeSetFeedback(
            buildFeedback({
              tone: "success",
              title: "Email verified",
              message: "Your email is verified. Sign in to continue."
            })
          );
          return;
        }

        await activeUser.reload().catch(() => undefined);
        const resolvedEmail = normalizeEmail(activeUser.email ?? "");
        ensureAllowedCollegeEmail(resolvedEmail);

        if (!activeUser.emailVerified) {
          safeSetFeedback(
            buildFeedback({
              tone: "success",
              title: "Check your inbox",
              message: "Finish email verification, then come back here to continue."
            })
          );
          return;
        }

        safeSetBusy(true);
        safeSetFeedback(
          buildFeedback({
            tone: "neutral",
            title: "Email verified",
            message: "Setting up your account."
          })
        );
        const session = await activateServerSession(activeUser);
        navigateAfterAuth(session.nextPath ?? "/onboarding");
      } catch (error) {
        logAuthFailure("email-verification:return-failed", error);
        safeSetFeedback(buildErrorFeedback(error, "Verification issue", "We could not finish verification."));
      } finally {
        safeSetBusy(false);
      }
    }

    void resolveEmailVerificationReturn();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function handleEmailAuth() {
    setFeedback(null);
    setIsBusy(true);

    try {
      const auth = await getFirebaseClientAuth();
      const normalizedEmail = normalizeEmail(email);
      logAuthEvent("info", "email-auth:start", {
        mode,
        email: normalizedEmail
      });
      ensureAllowedCollegeEmail(normalizedEmail);

      if (mode === "sign-up") {
        if (password !== confirmPassword) {
          const mismatchError = new Error("Password confirmation mismatch.") as AuthFailure;
          mismatchError.code = "PASSWORD_MISMATCH";
          throw mismatchError;
        }

        const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);

        if (!isAllowedCollegeEmail(credential.user.email ?? normalizedEmail)) {
          await deleteUser(credential.user).catch(() => undefined);
          throw createCollegeDomainError();
        }

        await updateProfile(credential.user, {
          displayName: "Vyb Student"
        });
        await sendEmailVerification(credential.user, buildEmailVerificationActionSettings());
        setPassword("");
        setConfirmPassword("");
        setFeedback(
          buildFeedback({
            tone: "success",
            title: "Verification link sent",
            message: "Your account has been created. Verify your approved college email from your inbox to continue."
          })
        );
        logAuthEvent("info", "email-signup:verification-sent", {
          email: normalizedEmail
        });
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      await credential.user.reload();

      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user, buildEmailVerificationActionSettings()).catch(() => undefined);
        setFeedback(
          buildFeedback({
            tone: "error",
            title: "Email verification required",
            message: "Your email is not verified yet. A fresh verification link has been sent.",
            code: "EMAIL_NOT_VERIFIED"
          })
        );
        await signOut(auth);
        return;
      }

      const session = await activateServerSession(credential.user);
      setPassword("");
      logAuthEvent("info", "email-signin:navigate", {
        uid: credential.user.uid,
        nextPath: session.nextPath ?? redirectTo
      });
      navigateAfterAuth(session.nextPath ?? redirectTo);
    } catch (error) {
      const code = extractErrorCode(error);

      if (
        code === "COLLEGE_DOMAIN_NOT_ALLOWED" ||
        code === "COLLEGE_ACCESS_PENDING" ||
        code === "EMAIL_NOT_VERIFIED"
      ) {
        const auth = await getFirebaseClientAuth();
        await signOut(auth).catch(() => undefined);
      }

      if (isExpectedAuthIssue(code)) {
        logAuthEvent("warn", "email-auth:handled", {
          mode,
          code,
          message: extractErrorMessage(error, "Unable to complete this request."),
          details:
            typeof error === "object" && error && "details" in error ? normalizeFeedbackDetails(error.details) : null
        });
      } else {
        logAuthFailure("email-auth:failed", error, {
          mode
        });
      }

      setFeedback(buildErrorFeedback(error, "Authentication failed", "Unable to complete this request."));
    } finally {
      setIsBusy(false);
    }
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleEmailAuth();
  }

  function shouldPreferGoogleRedirect() {
    return isIosStandaloneMode();
  }

  async function handleGoogleAuth() {
    setFeedback(null);
    setIsBusy(true);

    try {
      const auth = await getFirebaseClientAuth();
      const provider = createGoogleProvider();
      logAuthEvent("info", "google-auth:start", {
        mode
      });

      if (shouldPreferGoogleRedirect()) {
        persistGoogleRedirectIntent(mode);
        setFeedback(
          buildFeedback({
            tone: "neutral",
            title: "Redirecting to Google",
            message: "You will return here after Google verifies your account."
          })
        );
        logAuthEvent("info", "google-auth:redirect", {
          reason: "mobile-or-narrow-screen"
        });
        await signInWithRedirect(auth, provider);
        return;
      }

      const credential = await signInWithPopup(auth, provider);
      const resolvedEmail = normalizeEmail(credential.user.email ?? "");
      logAuthEvent("info", "google-auth:popup-success", {
        uid: credential.user.uid,
        email: resolvedEmail
      });
      ensureAllowedCollegeEmail(resolvedEmail);
      const session = await activateServerSession(credential.user);
      logAuthEvent("info", "google-auth:navigate", {
        uid: credential.user.uid,
        nextPath: session.nextPath ?? redirectTo
      });
      navigateAfterAuth(session.nextPath ?? redirectTo);
    } catch (error) {
      const code = extractErrorCode(error);
      clearGoogleRedirectIntent();

      if (isFirebaseClientConfigured()) {
        const auth = await getFirebaseClientAuth();
        await signOut(auth).catch(() => undefined);
      }

      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        try {
          const auth = await getFirebaseClientAuth();
          persistGoogleRedirectIntent(mode);
          setFeedback(
            buildFeedback({
              tone: "neutral",
              title: "Popup unavailable",
              message: "Popup sign-in is not available here. Redirecting to Google instead.",
              code
            })
          );
          logAuthEvent("warn", "google-auth:popup-fallback", {
            code
          });
          await signInWithRedirect(auth, createGoogleProvider());
          return;
        } catch (redirectError) {
          logAuthEvent("error", "google-auth:redirect-failed", {
            code: extractErrorCode(redirectError),
            message: extractErrorMessage(redirectError, "Google sign-in failed."),
            details:
              typeof redirectError === "object" && redirectError && "details" in redirectError
                ? normalizeFeedbackDetails(redirectError.details)
                : null
          });
          setFeedback(buildErrorFeedback(redirectError, "Google sign-in failed", "Google sign-in failed."));
          return;
        }
      }

      if (isExpectedAuthIssue(code)) {
        logAuthEvent("warn", "google-auth:handled", {
          code,
          message: extractErrorMessage(error, "Google sign-in failed."),
          details:
            typeof error === "object" && error && "details" in error ? normalizeFeedbackDetails(error.details) : null
        });
      } else {
        logAuthFailure("google-auth:failed", error);
      }

      setFeedback(buildErrorFeedback(error, "Google sign-in failed", "Google sign-in failed."));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleForgotPassword() {
    setFeedback(null);
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      setFeedback(
        buildFeedback({
          tone: "error",
          title: "Email required",
          message: "Enter your college email before requesting a password reset."
        })
      );
      return;
    }

    try {
      ensureAllowedCollegeEmail(normalizedEmail);
    } catch (error) {
      setFeedback(buildErrorFeedback(error, "Password reset failed", getCollegeEmailMessage()));
      return;
    }

    setIsBusy(true);
    try {
      const auth = await getFirebaseClientAuth();
      await sendPasswordResetEmail(auth, normalizedEmail);
      setFeedback(
        buildFeedback({
          tone: "success",
          title: "Reset link sent",
          message: "A password reset link has been sent to your college email."
        })
      );
      logAuthEvent("info", "password-reset:sent", {
        email: normalizedEmail
      });
    } catch (error) {
      logAuthEvent("error", "password-reset:failed", {
        code: extractErrorCode(error),
        message: extractErrorMessage(error, "Unable to send the password reset email.")
      });
      setFeedback(buildErrorFeedback(error, "Password reset failed", "Unable to send the password reset email."));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSignOut() {
    setFeedback(null);
    setIsBusy(true);

    try {
      if (isFirebaseClientConfigured()) {
        const auth = await getFirebaseClientAuth();
        await signOut(auth).catch(() => undefined);
      }

      await fetch("/api/auth/session", {
        method: "DELETE"
      });

      logAuthEvent("info", "session:cleared");
      setPassword("");
      setConfirmPassword("");
      router.refresh();
    } finally {
      setIsBusy(false);
    }
  }

  if (viewer) {
    return (
      <div className="vyb-auth-panel">
        <div className="vyb-auth-panel-head">
          <span className="vyb-page-badge">Session Active</span>
          <h2>You are already signed in.</h2>
          <p>Your authenticated session is ready. Continue to your home feed or sign out from this browser.</p>
        </div>

        <div className="vyb-session-card">
          <strong>{viewer.displayName}</strong>
          <span>{viewer.email}</span>
        </div>

        <div className="vyb-auth-actions">
          <button
            type="button"
            className="vyb-primary-button"
            onClick={() => {
              router.replace("/home");
              router.refresh();
            }}
          >
            Open home
          </button>
          <button type="button" className="vyb-secondary-button" onClick={handleSignOut} disabled={isBusy}>
            {isBusy ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    );
  }

  if (!isFirebaseClientConfigured()) {
    return (
      <div className="vyb-auth-panel">
        <div className="vyb-auth-panel-head">
          <span className="vyb-page-badge">Configuration</span>
          <h2>Authentication is not configured.</h2>
          <p>Complete the required Firebase environment variables before using the production login flow.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vyb-auth-layout-grid vyb-auth-layout-grid-clean">
      <section className="vyb-auth-panel vyb-auth-panel-clean">
        <div className="vyb-auth-brand">
          <VybLogoLockup subtitle="Verified college access" priority compactOnSmallScreens />
        </div>

        <div className="vyb-auth-panel-head">
          <span className="vyb-page-badge">{mode === "sign-in" ? "Log In" : "Register"}</span>
          <h2>{mode === "sign-in" ? "Log in" : "Register"}</h2>
          <p>
            {mode === "sign-in"
              ? "Use your college email to continue."
              : "Create your account with your college email."}
          </p>
        </div>

        <button type="button" className="vyb-google-button" onClick={handleGoogleAuth} disabled={isBusy}>
          <GoogleGlyph />
          <span>{mode === "sign-in" ? "Continue with Google" : "Register with Google"}</span>
        </button>

        <div className="vyb-auth-divider" aria-hidden="true">
          <div />
          <span>or</span>
          <div />
        </div>

        <form className="vyb-auth-form" onSubmit={handleFormSubmit}>
          <label className="vyb-field">
            <span>College email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={getCollegeEmailPlaceholder()}
              type="email"
              autoComplete="email"
            />
          </label>

          <label className="vyb-field">
            <span>Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "sign-in" ? "Enter your password" : "Create a password"}
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            />
          </label>

          {mode === "sign-up" ? (
            <label className="vyb-field">
              <span>Confirm password</span>
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm your password"
                type="password"
                autoComplete="new-password"
              />
            </label>
          ) : null}

          {mode === "sign-in" ? (
            <button type="button" className="vyb-inline-link" onClick={handleForgotPassword} disabled={isBusy}>
              Forgot your password?
            </button>
          ) : null}

          <button type="submit" className="vyb-primary-button" disabled={isBusy}>
            {isBusy ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="vyb-auth-meta">
          {mode === "sign-in" ? (
            <>
              <span>If you do not have an account,</span>
              <button
                type="button"
                className="vyb-inline-link"
                onClick={() => {
                  setFeedback(null);
                  setMode("sign-up");
                }}
              >
                please register first
              </button>
            </>
          ) : (
            <>
              <span>Already have an account?</span>
              <button
                type="button"
                className="vyb-inline-link"
                onClick={() => {
                  setFeedback(null);
                  setMode("sign-in");
                }}
              >
                Sign in
              </button>
            </>
          )}
        </div>

        {feedback ? (
          <div
            className={`vyb-inline-message vyb-inline-message-${feedback.tone}`}
            role={feedback.tone === "error" ? "alert" : "status"}
          >
            <strong>{feedback.title}</strong>
            <span>{feedback.message}</span>
            {feedback.code ? <code>{feedback.code}</code> : null}
            {feedback.details ? <small>{feedback.details}</small> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
