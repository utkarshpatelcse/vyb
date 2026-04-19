"use client";

import type { ProfileRecord } from "@vyb/contracts";
import { onboardingProfileSchema } from "@vyb/validation";
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
  const [course, setCourse] = useState(initialProfile?.course ?? initialCourseAndStream.course ?? defaultCourse);
  const streamOptions = useMemo(() => getStreamOptions(course), [course]);
  const yearOptions = useMemo(() => getYearOptionsForCourse(course), [course]);
  const [stream, setStream] = useState(initialProfile?.stream ?? initialCourseAndStream.stream ?? streamOptions[0]);
  const [year, setYear] = useState(String(initialProfile?.year ?? yearOptions[0]));
  const [section, setSection] = useState(initialProfile?.section ?? "");
  const [isHosteller, setIsHosteller] = useState(initialProfile?.isHosteller ?? false);
  const [hostelName, setHostelName] = useState(initialProfile?.hostelName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(initialProfile?.phoneNumber ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

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

  async function handleSubmit() {
    setMessage(null);

    const normalizedPayload = {
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
      setMessage(getValidationMessage(parsed.error.issues[0]));
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
        setMessage(extractServerMessage(payload));
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      console.warn("[onboarding] request-failed", {
        message: error instanceof Error ? error.message : "unknown"
      });
      setMessage("We could not reach the profile service. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="vyb-profile-shell">
      <div className="vyb-profile-header">
        <span className="vyb-page-badge">Profile Setup</span>
        <h1>Complete your campus profile</h1>
        <p>
          Finish your verified KIET profile so we can place you inside the correct community and dashboard
          scope from day one.
        </p>
      </div>

      <div className="vyb-profile-grid">
        <label className="vyb-field">
          <span>College</span>
          <input value={collegeName} readOnly />
        </label>

        <label className="vyb-field">
          <span>College email</span>
          <input value={viewer.email} readOnly />
        </label>

        <label className="vyb-field">
          <span>First name</span>
          <input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Aarav" />
        </label>

        <label className="vyb-field">
          <span>Last name</span>
          <input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Optional" />
        </label>

        <label className="vyb-field">
          <span>Course</span>
          <select value={course} onChange={(event) => setCourse(event.target.value)}>
            {courseOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="vyb-field">
          <span>Stream</span>
          <select value={stream} onChange={(event) => setStream(event.target.value)}>
            {streamOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
              ))}
          </select>
        </label>

        <label className="vyb-field">
          <span>Year</span>
          <select value={year} onChange={(event) => setYear(event.target.value)}>
            {yearOptions.map((option) => (
              <option key={option} value={String(option)}>
                Year {option}
              </option>
            ))}
          </select>
        </label>

        <label className="vyb-field">
          <span>Section</span>
          <input value={section} onChange={(event) => setSection(event.target.value)} placeholder="A" />
        </label>

        <label className="vyb-field">
          <span>Phone number</span>
          <input
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="Optional"
            type="tel"
          />
        </label>
      </div>

      <div className="vyb-toggle-card">
        <div>
          <strong>Hostel stay</strong>
          <p>Tell us whether you stay on campus so future community routing can include your hostel layer.</p>
        </div>
        <label className="vyb-switch">
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
          />
        </label>
      ) : null}

      <div className="vyb-profile-actions">
        <button type="button" className="vyb-primary-button" onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Saving profile..." : "Continue to dashboard"}
        </button>
      </div>

      {message ? <p className="vyb-inline-message">{message}</p> : null}
    </div>
  );
}
