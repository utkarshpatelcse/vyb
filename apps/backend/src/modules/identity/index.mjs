import { getFirebaseAdminAuth } from "../../../../../packages/config/src/index.mjs";
import { readJson, sendError, sendJson } from "../../lib/http.mjs";
import { buildFallbackDisplayName, resolveLiveContext } from "../shared/viewer-context.mjs";
import { getAllowedCollegeDomains, isAllowedCollegeEmail, launchCollege, normalizeEmail } from "./college-access.mjs";
import { getProfileByUserId, updateUsername, upsertProfile } from "./profile-repository.mjs";
import { z } from "zod";

function requireNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeOptionalString(value) {
  return requireNonEmptyString(value) ? value.trim() : null;
}

function normalizePhoneNumber(value) {
  if (!requireNonEmptyString(value)) {
    return null;
  }

  const cleaned = value.trim();
  return /^[+\d][\d\s-]{7,18}$/u.test(cleaned) ? cleaned : null;
}

function buildCollegeOnlyMessage() {
  return "Please sign in or sign up with your college email address.";
}

function buildProfileResponse({ profile, collegeName }) {
  return {
    profileCompleted: Boolean(profile?.profileCompleted),
    allowedEmailDomain: launchCollege.domain,
    collegeName,
    profile
  };
}

const profileSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "User ID must be at least 3 characters long.")
      .max(24, "User ID must be 24 characters or fewer.")
      .regex(/^[a-z0-9](?:[a-z0-9._]{1,22}[a-z0-9])?$/u, "Use lowercase letters, numbers, dots, and underscores only."),
    firstName: z.string().trim().min(2, "First name must be at least 2 characters long."),
    lastName: z
      .union([z.string().trim().min(1, "Last name must be a valid string when provided."), z.literal(""), z.null()])
      .optional(),
    course: z.string().trim().min(2, "Course is required."),
    stream: z.string().trim().min(2, "Stream is required."),
    year: z.coerce.number().int().min(1, "Year must be between 1 and 6.").max(6, "Year must be between 1 and 6."),
    section: z.string().trim().min(1, "Section is required.").max(12, "Section must be shorter than 12 characters."),
    isHosteller: z.boolean(),
    hostelName: z.union([z.string().trim().min(1), z.literal(""), z.null()]).optional(),
    phoneNumber: z
      .union([z.string().trim().regex(/^[+\d][\d\s-]{7,18}$/u, "Phone number format is invalid."), z.literal(""), z.null()])
      .optional(),
    avatarUrl: z.union([z.string().trim().min(1).max(2_500_000), z.literal(""), z.null()]).optional()
  })
  .superRefine((payload, ctx) => {
    if (payload.isHosteller && !requireNonEmptyString(payload.hostelName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Hostel name is required for hostellers.",
        path: ["hostelName"]
      });
    }
  });

const usernameUpdateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "User ID must be at least 3 characters long.")
    .max(24, "User ID must be 24 characters or fewer.")
    .regex(/^[a-z0-9](?:[a-z0-9._]{1,22}[a-z0-9])?$/u, "Use lowercase letters, numbers, dots, and underscores only.")
});

function buildSessionPayload({ displayName, email, membership, tenant, userId }) {
  return {
    userId,
    email,
    displayName,
    membershipId: membership.id,
    tenantId: tenant.id,
    role: membership.role
  };
}

export function getIdentityModuleHealth() {
  return {
    module: "identity",
    status: "ok"
  };
}

export async function handleIdentityRoute({ request, response, url, context }) {
  if (request.method === "POST" && url.pathname === "/v1/auth/session/bootstrap") {
    const payload = await readJson(request);
    if (payload === null) {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    if (!requireNonEmptyString(payload?.idToken)) {
      sendError(response, 400, "MISSING_TOKEN", "Firebase ID token is required.");
      return true;
    }

    try {
      console.info("[identity] session-bootstrap:start", {
        hasDisplayName: requireNonEmptyString(payload?.displayName)
      });
      const decoded = await getFirebaseAdminAuth().verifyIdToken(payload.idToken.trim(), true);
      const email = normalizeEmail(decoded.email);

      if (!email) {
        console.warn("[identity] session-bootstrap:email-missing", {
          uid: decoded.uid
        });
        sendError(response, 400, "EMAIL_REQUIRED", "A verified email is required.");
        return true;
      }

      if (!isAllowedCollegeEmail(email)) {
        console.warn("[identity] session-bootstrap:domain-rejected", {
          uid: decoded.uid,
          email
        });
        sendError(response, 403, "COLLEGE_DOMAIN_NOT_ALLOWED", buildCollegeOnlyMessage(), {
          allowedDomains: getAllowedCollegeDomains()
        });
        return true;
      }

      if (!decoded.email_verified) {
        console.warn("[identity] session-bootstrap:email-not-verified", {
          uid: decoded.uid,
          email
        });
        sendError(response, 403, "EMAIL_NOT_VERIFIED", "Verify your college email before you continue.");
        return true;
      }

      const displayName =
        normalizeOptionalString(payload.displayName) ?? decoded.name ?? buildFallbackDisplayName(email);
      const resolved = await resolveLiveContext({
        id: decoded.uid,
        email,
        displayName
      });

      if (!resolved?.live?.tenant || !resolved.live.membership) {
        console.warn("[identity] session-bootstrap:access-pending", {
          uid: decoded.uid,
          email
        });
        sendError(
          response,
          403,
          "COLLEGE_ACCESS_PENDING",
          "College access is not active for this account yet."
        );
        return true;
      }

      const storedProfile = await getProfileByUserId({
        tenantId: resolved.live.tenant.id,
        userId: resolved.live.user.id
      });
      const session = buildSessionPayload({
        userId: decoded.uid,
        email,
        displayName: storedProfile?.fullName ?? resolved.live.user.displayName ?? displayName,
        membership: resolved.live.membership,
        tenant: resolved.live.tenant
      });

      sendJson(response, 200, {
        session,
        profileCompleted: Boolean(storedProfile?.profileCompleted),
        nextPath: storedProfile?.profileCompleted ? "/home" : "/onboarding"
      });
      console.info("[identity] session-bootstrap:success", {
        uid: decoded.uid,
        email,
        tenantId: session.tenantId,
        nextPath: storedProfile?.profileCompleted ? "/home" : "/onboarding"
      });
      return true;
    } catch (error) {
      console.error("[identity] session-bootstrap:failed", {
        message: error instanceof Error ? error.message : "unknown"
      });
      sendError(response, 401, "INVALID_TOKEN", "Firebase session verification failed.", {
        message: error instanceof Error ? error.message : "unknown"
      });
      return true;
    }
  }

  if (request.method === "POST" && url.pathname === "/v1/auth/bootstrap") {
    const payload = await readJson(request);
    if (payload === null) {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    const resolved = await resolveLiveContext(context.actor);
    if (!resolved) {
      sendError(response, 401, "UNAUTHENTICATED", "Viewer context is required to bootstrap identity.");
      return true;
    }

    const user = resolved.live?.user
      ? {
          id: resolved.viewer.id,
          primaryEmail: resolved.live.user.primaryEmail,
          displayName: resolved.live.user.displayName ?? resolved.viewer.displayName,
          status: resolved.live.user.status
        }
      : resolved.viewer;
    const emailDomain = String(user.primaryEmail).split("@")[1] ?? null;

    sendJson(response, 200, {
      user,
      onboarding: {
        stage: resolved.live?.membership ? "membership-pending" : "manual-review",
        displayName: typeof payload?.displayName === "string" ? payload.displayName : user.displayName
      },
      verification: {
        emailVerified: true,
        emailDomain
      }
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/me") {
    const resolved = await resolveLiveContext(context.actor);
    if (!resolved) {
      sendError(response, 401, "UNAUTHENTICATED", "Viewer context is required.");
      return true;
    }

    if (resolved.live?.membership && resolved.live.tenant) {
      sendJson(response, 200, {
        user: {
          id: resolved.viewer.id,
          primaryEmail: resolved.live.user.primaryEmail,
          displayName: resolved.live.user.displayName ?? resolved.viewer.displayName,
          status: resolved.live.user.status
        },
        membershipSummary: {
          id: resolved.live.membership.id,
          tenantId: resolved.live.tenant.id,
          role: resolved.live.membership.role,
          verificationStatus: resolved.live.membership.verificationStatus
        }
      });
      return true;
    }

    sendJson(response, 200, {
      user: resolved.viewer,
      membershipSummary: {
        id: "membership-demo-1",
        tenantId: "tenant-demo",
        role: "student",
        verificationStatus: "verified"
      }
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/profile") {
    const resolved = await resolveLiveContext(context.actor);
    if (!resolved) {
      sendError(response, 401, "UNAUTHENTICATED", "Viewer context is required.");
      return true;
    }

    const profile = await getProfileByUserId({
      tenantId: resolved.live?.tenant?.id ?? null,
      userId: resolved.live?.user?.id ?? null
    });
    sendJson(
      response,
      200,
      buildProfileResponse({
        profile,
        collegeName: resolved.live?.tenant?.name ?? launchCollege.name
      })
    );
    return true;
  }

  if (request.method === "PUT" && url.pathname === "/v1/profile") {
    const resolved = await resolveLiveContext(context.actor);
    if (!resolved?.live?.tenant || !resolved.live.membership) {
      sendError(response, 401, "UNAUTHENTICATED", "An authenticated membership is required.");
      return true;
    }

    if (!isAllowedCollegeEmail(resolved.viewer.primaryEmail)) {
      sendError(response, 403, "COLLEGE_DOMAIN_NOT_ALLOWED", buildCollegeOnlyMessage(), {
        allowedDomains: getAllowedCollegeDomains()
      });
      return true;
    }

    const payload = await readJson(request);
    if (payload === null) {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    const parsedProfile = profileSchema.safeParse(payload);
    if (!parsedProfile.success) {
      sendError(
        response,
        400,
        "INVALID_PROFILE",
        parsedProfile.error.issues[0]?.message ?? "Profile payload is invalid.",
        parsedProfile.error.flatten()
      );
      return true;
    }

    const normalizedPayload = parsedProfile.data;
    const firstName = normalizedPayload.firstName.trim();
    const lastName = normalizeOptionalString(normalizedPayload.lastName);
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    let profile;
    try {
      profile = await upsertProfile({
        userId: resolved.live.user.id,
        tenantId: resolved.live.tenant.id,
        primaryEmail: resolved.viewer.primaryEmail,
        collegeName: resolved.live.tenant.name,
        username: normalizedPayload.username.trim(),
        firstName,
        lastName,
        fullName,
        course: normalizedPayload.course.trim(),
        stream: normalizedPayload.stream.trim(),
        year: normalizedPayload.year,
        section: normalizedPayload.section.trim().toUpperCase(),
        isHosteller: normalizedPayload.isHosteller,
        hostelName: normalizeOptionalString(normalizedPayload.hostelName),
        phoneNumber: normalizePhoneNumber(normalizedPayload.phoneNumber),
        avatarUrl: normalizeOptionalString(normalizedPayload.avatarUrl)
      });
    } catch (error) {
      if (error?.code === "USERNAME_TAKEN") {
        sendError(response, 409, "USERNAME_TAKEN", "That user ID is already taken.");
        return true;
      }

      if (error?.code === "INVALID_USERNAME") {
        sendError(response, 400, "INVALID_USERNAME", error.message);
        return true;
      }

      throw error;
    }

    sendJson(
      response,
      200,
      buildProfileResponse({
        profile,
        collegeName: resolved.live.tenant.name
      })
    );
    return true;
  }

  if (request.method === "PATCH" && url.pathname === "/v1/profile/username") {
    const resolved = await resolveLiveContext(context.actor);
    if (!resolved?.live?.tenant) {
      sendError(response, 401, "UNAUTHENTICATED", "An authenticated membership is required.");
      return true;
    }

    const payload = await readJson(request);
    if (payload === null) {
      sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
      return true;
    }

    const parsed = usernameUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      sendError(response, 400, "INVALID_USERNAME", parsed.error.issues[0]?.message ?? "User ID is invalid.");
      return true;
    }

    try {
      const profile = await updateUsername({
        tenantId: resolved.live.tenant.id,
        userId: resolved.live.user.id,
        username: parsed.data.username
      });

      if (!profile) {
        sendError(response, 404, "PROFILE_NOT_FOUND", "Complete your profile before changing your user ID.");
        return true;
      }

      sendJson(response, 200, { profile });
      return true;
    } catch (error) {
      if (error?.code === "USERNAME_TAKEN") {
        sendError(response, 409, "USERNAME_TAKEN", "That user ID is already taken.");
        return true;
      }

      sendError(response, 400, "INVALID_USERNAME", error instanceof Error ? error.message : "User ID is invalid.");
      return true;
    }
  }

  return false;
}
