"use client";

import type { ProfileRecord } from "@vyb/contracts";
import type { FormEvent } from "react";
import { onboardingProfileSchema, usernameSchema } from "../../../../packages/validation/src/index";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  courseOptions,
  defaultCourse,
  getStreamOptions,
  getYearOptionsForCourse,
  inferCourseAndStream,
  splitDisplayName
} from "../lib/college-access";

function toFieldLabel(path: Array<string | number>) {
  const key = String(path[0] ?? "field");
  switch (key) {
    case "username":
      return "User ID";
    case "firstName":
      return "First name";
    case "lastName":
      return "Last name";
    case "course":
      return "Course";
    case "stream":
      return "Stream";
    case "year":
      return "Year";
    case "section":
      return "Section";
    case "hostelName":
      return "Hostel name";
    case "phoneNumber":
      return "Phone number";
    default:
      return "This field";
  }
}

function getValidationMessage(
  issue:
    | {
        message?: string;
        path?: Array<string | number>;
      }
    | undefined
) {
  if (!issue) {
    return "Please review the form and try again.";
  }

  if (issue.message && issue.message !== "Required") {
    return issue.message;
  }

  return `${toFieldLabel(issue.path ?? [])} is required.`;
}

function extractServerMessage(payload: {
  error?: {
    code?: string;
    message?: string;
    details?: {
      fieldErrors?: Record<string, string[] | undefined>;
      formErrors?: string[];
    } | null;
  };
} | null) {
  const code = payload?.error?.code;
  if (code === "USERNAME_TAKEN") {
    return "That user ID is already taken. Pick one of the suggestions below and try again.";
  }

  if (code === "INVALID_USERNAME") {
    return "User ID can use letters, numbers, dots, and underscores only, and it must start and end with a letter or number.";
  }

  const message = payload?.error?.message?.trim();
  if (message && message !== "Required") {
    return message;
  }

  const fieldErrors = payload?.error?.details?.fieldErrors;
  if (fieldErrors) {
    const firstEntry = Object.entries(fieldErrors).find(([, value]) => Array.isArray(value) && value.length > 0);
    if (firstEntry) {
      return firstEntry[1]?.[0] ?? `${toFieldLabel([firstEntry[0]])} is required.`;
    }
  }

  const formError = payload?.error?.details?.formErrors?.[0];
  if (formError) {
    return formError;
  }

  return "We could not save your profile right now.";
}

function parseYearValue(value: string) {
  const match = value.match(/\d+/u);
  return match ? Number(match[0]) : Number.NaN;
}

function sanitizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]+/gu, "_")
    .replace(/[._]{2,}/gu, "_")
    .replace(/^[._]+/gu, "")
    .slice(0, 24)
    .replace(/[._]+$/gu, "");
}

function buildUsernameSuggestions({
  email,
  firstName,
  lastName,
  displayName,
  preferred
}: {
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  preferred?: string;
}) {
  const localPart = email.split("@")[0] ?? "";
  const digits = localPart.replace(/[^0-9]/gu, "").slice(0, 4);
  const nameWithDot = [firstName, lastName].filter(Boolean).join(".");
  const nameWithUnderscore = [firstName, lastName].filter(Boolean).join("_");
  const displayHandle = displayName.replace(/\s+/gu, ".");

  const seeds = [
    preferred,
    localPart,
    nameWithDot,
    nameWithUnderscore,
    `${firstName}${digits ? `.${digits}` : ""}`,
    displayHandle
  ];

  const suggestions = new Set<string>();

  for (const seed of seeds) {
    const cleanSeed = sanitizeUsername(seed ?? "");
    if (!cleanSeed) {
      continue;
    }

    for (const variant of [cleanSeed, `${cleanSeed}.1`, `${cleanSeed}_1`]) {
      const cleanVariant = sanitizeUsername(variant);
      if (cleanVariant.length < 3) {
        continue;
      }

      const parsed = usernameSchema.safeParse(cleanVariant);
      if (parsed.success) {
        suggestions.add(cleanVariant);
      }

      if (suggestions.size >= 4) {
        return Array.from(suggestions);
      }
    }
  }

  return Array.from(suggestions);
}

export function CompleteProfileForm({
  viewer,
  initialProfile,
  collegeName
}: {
  viewer: {
    displayName: string;
    email: string;
  };
  initialProfile: ProfileRecord | null;
  collegeName: string;
}) {
  const router = useRouter();
  const fallbackName = useMemo(() => splitDisplayName(viewer.displayName), [viewer.displayName]);
  const initialCourseAndStream = useMemo(() => inferCourseAndStream(initialProfile ?? {}), [initialProfile]);
  const [firstName, setFirstName] = useState(initialProfile?.firstName ?? fallbackName.firstName);
  const [lastName, setLastName] = useState(initialProfile?.lastName ?? fallbackName.lastName);
  const [username, setUsername] = useState(sanitizeUsername(initialProfile?.username ?? ""));
  const [course, setCourse] = useState(initialProfile?.course ?? initialCourseAndStream.course ?? defaultCourse);
  const streamOptions = useMemo(() => getStreamOptions(course), [course]);
  const yearOptions = useMemo(() => getYearOptionsForCourse(course), [course]);
  const [stream, setStream] = useState(initialProfile?.stream ?? initialCourseAndStream.stream ?? streamOptions[0]);
  const [year, setYear] = useState(String(initialProfile?.year ?? yearOptions[0]));
  const [section, setSection] = useState(initialProfile?.section ?? "");
  const [isHosteller, setIsHosteller] = useState(initialProfile?.isHosteller ?? false);
  const [hostelName, setHostelName] = useState(initialProfile?.hostelName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(initialProfile?.phoneNumber ?? "");
  const [hasCustomizedUsername, setHasCustomizedUsername] = useState(Boolean(initialProfile?.username));
  const [message, setMessage] = useState<{ tone: "error" | "neutral"; text: string } | null>(null);
  const [isPending, setIsPending] = useState(false);

  const autoUsernameSuggestions = useMemo(
    () =>
      buildUsernameSuggestions({
        email: viewer.email,
        firstName,
        lastName,
        displayName: viewer.displayName
      }),
    [firstName, lastName, viewer.displayName, viewer.email]
  );

  const usernameSuggestions = useMemo(
    () =>
      buildUsernameSuggestions({
        email: viewer.email,
        firstName,
        lastName,
        displayName: viewer.displayName,
        preferred: username
      }),
    [firstName, lastName, username, viewer.displayName, viewer.email]
  );

  const usernameValidation = useMemo(() => usernameSchema.safeParse(username), [username]);

  const previewName = useMemo(
    () => [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || viewer.displayName,
    [firstName, lastName, viewer.displayName]
  );

  const previewHandle = username || autoUsernameSuggestions[0] || "your-campus-id";

  const progressItems = useMemo(
    () => [
      {
        label: "Pick a searchable user ID",
        done: usernameValidation.success
      },
      {
        label: "Add your name",
        done: firstName.trim().length > 0
      },
      {
        label: "Select course and stream",
        done: course.trim().length > 0 && stream.trim().length > 0
      },
      {
        label: "Choose year and section",
        done: Number.isFinite(parseYearValue(year)) && section.trim().length > 0
      },
      {
        label: "Confirm stay details",
        done: !isHosteller || hostelName.trim().length > 0
      }
    ],
    [course, firstName, hostelName, isHosteller, section, stream, usernameValidation.success, year]
  );

  const completedSteps = progressItems.filter((item) => item.done).length;
  const completionPercentage = Math.round((completedSteps / progressItems.length) * 100);

  const usernameHelper = useMemo(() => {
    if (!username) {
      const nextSuggestion = autoUsernameSuggestions[0];
      return {
        tone: "neutral" as const,
        text: nextSuggestion
          ? `Suggested for you: @${nextSuggestion}`
          : "Use letters, numbers, dots, or underscores for your public ID."
      };
    }

    if (!usernameValidation.success) {
      return {
        tone: "error" as const,
        text: usernameValidation.error.issues[0]?.message ?? "Please enter a valid user ID."
      };
    }

    return {
      tone: "neutral" as const,
      text: `People will find you as @${username}`
    };
  }, [autoUsernameSuggestions, username, usernameValidation]);

  useEffect(() => {
    if (!streamOptions.includes(stream)) {
      setStream(streamOptions[0]);
    }
  }, [stream, streamOptions]);

  useEffect(() => {
    if (!yearOptions.includes(Number(year))) {
      setYear(String(yearOptions[0]));
    }
  }, [year, yearOptions]);

  useEffect(() => {
    const nextSuggestedUsername = autoUsernameSuggestions[0];
    if (!hasCustomizedUsername && nextSuggestedUsername && username !== nextSuggestedUsername) {
      setUsername(nextSuggestedUsername);
    }
  }, [autoUsernameSuggestions, hasCustomizedUsername, username]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const normalizedPayload = {
      username: sanitizeUsername(username),
      firstName: firstName.trim(),
      lastName: lastName.trim() || null,
      course: course.trim(),
      stream: stream.trim(),
      year: parseYearValue(String(year)),
      section: section.trim().toUpperCase(),
      isHosteller,
      hostelName: isHosteller ? hostelName.trim() || null : null,
      phoneNumber: phoneNumber.trim() || null
    };

    const parsed = onboardingProfileSchema.safeParse({
      ...normalizedPayload
    });

    if (!parsed.success) {
      console.warn("[onboarding] validation-failed", {
        issue: parsed.error.issues[0],
        payload: normalizedPayload
      });
      setMessage({
        tone: "error",
        text: getValidationMessage(parsed.error.issues[0])
      });
      return;
    }

    setIsPending(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(parsed.data)
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: {
              code?: string;
              message?: string;
              details?: {
                fieldErrors?: Record<string, string[] | undefined>;
                formErrors?: string[];
              } | null;
            };
          }
        | null;

      if (!response.ok) {
        console.warn("[onboarding] save-failed", {
          status: response.status,
          code: payload?.error?.code,
          message: payload?.error?.message,
          details: payload?.error?.details
        });
        setMessage({
          tone: "error",
          text: extractServerMessage(payload)
        });
        return;
      }

      router.replace("/home");
      router.refresh();
    } catch (error) {
      console.warn("[onboarding] request-failed", {
        message: error instanceof Error ? error.message : "unknown"
      });
      setMessage({
        tone: "error",
        text: "We could not reach the profile service. Please try again."
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="vyb-onboarding-form" onSubmit={handleSubmit}>
      <div className="vyb-onboarding-hero">
        <div className="vyb-onboarding-header">
          <span className="vyb-page-badge">Profile Setup</span>
          <h1>Complete your campus profile</h1>
          <p>
            Finish your verified campus profile so we can place you inside the right community, feed, and
            dashboard from day one.
          </p>
        </div>

        <aside className="vyb-onboarding-preview" aria-label="Profile progress preview">
          <div className="vyb-onboarding-preview-head">
            <span className="vyb-page-badge vyb-page-badge-soft">Live Preview</span>
            <strong>{completedSteps} of 5 ready</strong>
          </div>

          <div className="vyb-onboarding-preview-card">
            <div className="vyb-onboarding-avatar" aria-hidden="true">
              {(previewName[0] ?? "V").toUpperCase()}
            </div>
            <div className="vyb-onboarding-preview-copy">
              <strong>{previewName}</strong>
              <span>@{previewHandle}</span>
              <small>
                {course}
                {stream ? ` / ${stream}` : ""}
                {year ? ` / Year ${parseYearValue(year)}` : ""}
              </small>
            </div>
          </div>

          <div className="vyb-onboarding-progress" aria-hidden="true">
            <span style={{ width: `${completionPercentage}%` }} />
          </div>

          <div className="vyb-onboarding-meta-grid">
            <div className="vyb-onboarding-meta-card">
              <span>Campus</span>
              <strong>{collegeName}</strong>
            </div>
            <div className="vyb-onboarding-meta-card">
              <span>Stay</span>
              <strong>{isHosteller ? hostelName.trim() || "Hosteller" : "Day scholar"}</strong>
            </div>
          </div>

          <div className="vyb-onboarding-checklist" aria-live="polite">
            {progressItems.map((item) => (
              <div
                key={item.label}
                className={`vyb-onboarding-check-item${item.done ? " is-complete" : ""}`}
              >
                <span aria-hidden="true">{item.done ? "01" : "00"}</span>
                <strong>{item.label}</strong>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="vyb-onboarding-grid">
        <label className="vyb-field">
          <span>College</span>
          <input value={collegeName} readOnly />
        </label>

        <label className="vyb-field">
          <span>College email</span>
          <input value={viewer.email} readOnly />
        </label>

        <label
          className={`vyb-field vyb-field--full${usernameHelper.tone === "error" ? " is-error" : ""}`}
        >
          <span>User ID</span>
          <input
            value={username}
            onChange={(event) => {
              setHasCustomizedUsername(true);
              setUsername(sanitizeUsername(event.target.value));
            }}
            placeholder="yourcampusid"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="username"
            maxLength={24}
            required
          />
          <div className="vyb-onboarding-field-foot">
            <small className={usernameHelper.tone === "error" ? "is-error" : undefined}>{usernameHelper.text}</small>

            {usernameSuggestions.length > 0 ? (
              <div className="vyb-onboarding-suggestion-list">
                {usernameSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className={`vyb-onboarding-suggestion${suggestion === username ? " is-active" : ""}`}
                    onClick={() => {
                      setHasCustomizedUsername(true);
                      setUsername(suggestion);
                      setMessage(null);
                    }}
                  >
                    @{suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </label>

        <label className="vyb-field">
          <span>First name</span>
          <input
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="Aarav"
            autoComplete="given-name"
            required
          />
        </label>

        <label className="vyb-field">
          <span>Last name</span>
          <input
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            placeholder="Optional"
            autoComplete="family-name"
          />
        </label>

        <label className="vyb-field">
          <span>Course</span>
          <select value={course} onChange={(event) => setCourse(event.target.value)} required>
            {courseOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="vyb-field">
          <span>Stream</span>
          <select value={stream} onChange={(event) => setStream(event.target.value)} required>
            {streamOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="vyb-field">
          <span>Year</span>
          <select value={year} onChange={(event) => setYear(event.target.value)} required>
            {yearOptions.map((option) => (
              <option key={option} value={String(option)}>
                Year {option}
              </option>
            ))}
          </select>
        </label>

        <label className="vyb-field">
          <span>Section</span>
          <input
            value={section}
            onChange={(event) => setSection(event.target.value.toUpperCase().trimStart())}
            placeholder="A"
            autoCapitalize="characters"
            maxLength={12}
            required
          />
        </label>

        <label className="vyb-field">
          <span>Phone number</span>
          <input
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="Optional"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
          />
        </label>
      </div>

      <div className="vyb-onboarding-toggle-card">
        <div>
          <strong>Hostel stay</strong>
          <p>Tell us whether you stay on campus so future community routing can include your hostel layer.</p>
        </div>
        <label className="vyb-onboarding-switch">
          <input
            type="checkbox"
            checked={isHosteller}
            onChange={(event) => {
              setIsHosteller(event.target.checked);
              if (!event.target.checked) {
                setHostelName("");
              }
            }}
          />
          <span>{isHosteller ? "Hosteller" : "Day scholar"}</span>
        </label>
      </div>

      {isHosteller ? (
        <label className="vyb-field">
          <span>Hostel name</span>
          <input
            value={hostelName}
            onChange={(event) => setHostelName(event.target.value)}
            placeholder="Boys Hostel A"
            required
          />
        </label>
      ) : null}

      {message ? (
        <p
          className={`vyb-inline-message ${message.tone === "error" ? "vyb-inline-message-error" : "vyb-inline-message-neutral"}`}
          aria-live="polite"
        >
          {message.text}
        </p>
      ) : null}

      <div className="vyb-onboarding-actions">
        <button type="submit" className="vyb-primary-button" disabled={isPending}>
          {isPending ? "Saving profile..." : "Continue to home"}
        </button>
      </div>
    </form>
  );
}
