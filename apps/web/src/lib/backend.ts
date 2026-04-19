import "server-only";
import type {
  ClientShellResponse,
  MeResponse,
  ProfileResponse,
  SessionBootstrapRequest,
  SessionBootstrapResponse
} from "@vyb/contracts";
import type { DevSession } from "./dev-session";
import { buildFallbackProfileResponse } from "./profile-fallback";

const API_BASE_URL =
  process.env.VYB_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const INTERNAL_API_KEY = process.env.VYB_INTERNAL_API_KEY ?? "local-vyb-internal-key";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildBackendHeaders(viewer?: DevSession): HeadersInit {
  if (!viewer) {
    return {
      "content-type": "application/json",
      "x-vyb-internal-key": INTERNAL_API_KEY
    };
  }

  return {
    "content-type": "application/json",
    "x-vyb-internal-key": INTERNAL_API_KEY,
    "x-demo-user-id": viewer.userId,
    "x-demo-email": viewer.email,
    "x-demo-display-name": viewer.displayName
  };
}

async function readResponseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function fetchBackendJson<T>(path: string, viewer?: DevSession): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: buildBackendHeaders(viewer),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Backend request failed for ${path} with ${response.status}`);
  }

  return readResponseJson<T>(response);
}

export async function postBackendJson<TResponse>(
  path: string,
  payload: SessionBootstrapRequest | Record<string, unknown>,
  viewer?: DevSession
): Promise<TResponse> {
  let attempt = 0;
  let lastError = null;

  while (attempt < 2) {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: buildBackendHeaders(viewer),
        body: JSON.stringify(payload),
        cache: "no-store"
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Backend request failed for ${path} with ${response.status}`);
      }

      return readResponseJson<TResponse>(response);
    } catch (error) {
      lastError = error;
      attempt += 1;

      if (attempt < 2) {
        await delay(250);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Backend request failed for ${path}.`);
}

export async function proxyBackendMutation(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  payload: unknown,
  viewer: DevSession
) {
  const upstream = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildBackendHeaders(viewer),
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  const responseText = await upstream.text();

  return new Response(responseText, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8"
    }
  });
}

function buildClientShellFallback(): ClientShellResponse {
  return {
    shell: "pwa-first",
    mobileInstallable: true,
    desktopResponsive: true,
    nativeReadyContracts: true,
    backendRuntime: "modular-monolith",
    launchCampus: {
      id: "kiet",
      name: "KIET Group of Institutions Delhi-NCR",
      domain: "kiet.edu"
    },
    hero: {
      eyebrow: "Verified Campus Network",
      title: "One trusted home for college identity, community, and utility.",
      summary:
        "Vyb is building the digital operating system for verified campus life, starting with KIET Group of Institutions Delhi-NCR."
    },
    pillars: [
      {
        title: "Trusted Identity",
        description: "Access begins with a verified college email so every interaction stays inside the right campus boundary."
      },
      {
        title: "Useful Community",
        description: "Students should land inside relevant college, branch, batch, and hostel spaces instead of scattered chat groups."
      },
      {
        title: "Daily Utility",
        description: "Notes, resources, and a campus feed should reinforce each other instead of living in separate tools."
      }
    ],
    phaseOne: [
      "College-scoped authentication and onboarding",
      "Verified communities and membership routing",
      "Campus feed for text and image posts",
      "Academic resource vault",
      "Moderation-aware backend foundation"
    ],
    trustPoints: [
      "Single backend runtime for a simpler Phase 1 launch",
      "Responsive web now, native-ready contracts later",
      "Strict tenant boundaries across every authenticated flow"
    ]
  };
}

export async function getClientShellData() {
  try {
    return await fetchBackendJson<ClientShellResponse>("/v1/client-shell");
  } catch {
    return buildClientShellFallback();
  }
}

export async function getViewerProfile(viewer: DevSession) {
  try {
    return await fetchBackendJson<ProfileResponse>("/v1/profile", viewer);
  } catch {
    return buildFallbackProfileResponse(viewer);
  }
}

export async function getViewerMe(viewer: DevSession) {
  return fetchBackendJson<MeResponse>("/v1/me", viewer);
}

export async function bootstrapViewerSession(payload: SessionBootstrapRequest) {
  return postBackendJson<SessionBootstrapResponse>("/v1/auth/session/bootstrap", payload);
}
