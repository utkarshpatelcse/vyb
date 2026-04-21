import "server-only";

type BackendRouteArgs = {
  request: MockNodeRequest;
  response: MockNodeResponse;
  url: URL;
  context: any;
};

type BackendModules = {
  createRequestContext: (request: MockNodeRequest) => any;
  sendError: (
    response: MockNodeResponse,
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
    extraHeaders?: Record<string, string>
  ) => void;
  handleIdentityRoute: (args: BackendRouteArgs) => Promise<boolean>;
  handleCampusRoute: (args: BackendRouteArgs) => Promise<boolean>;
  handleSocialRoute: (args: BackendRouteArgs) => Promise<boolean>;
  handleResourcesRoute: (args: BackendRouteArgs) => Promise<boolean>;
  handleModerationRoute: (args: BackendRouteArgs) => Promise<boolean>;
};

type BackendBridgeRequest = {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

type MockNodeRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  [Symbol.asyncIterator]: () => AsyncGenerator<Buffer, void, void>;
};

const BACKEND_BASE_URL = "http://internal.vyb";

let backendModulesPromise: Promise<BackendModules> | null = null;

function normalizeHeaders(headers?: Record<string, string>) {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers ?? {})) {
    if (typeof value !== "string") {
      continue;
    }

    normalized[key.toLowerCase()] = value;
  }

  return normalized;
}

function toHeaderRecord(headers: Record<string, string | string[] | undefined>) {
  const record: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      record[key] = value.join(", ");
      continue;
    }

    if (typeof value === "string") {
      record[key] = value;
    }
  }

  return record;
}

function createMockRequest({
  path,
  method = "GET",
  headers,
  body
}: BackendBridgeRequest): MockNodeRequest {
  const normalizedHeaders = normalizeHeaders(headers);
  const bodyBuffer = body ? Buffer.from(body, "utf8") : null;

  return {
    method,
    url: path,
    headers: normalizedHeaders,
    async *[Symbol.asyncIterator]() {
      if (bodyBuffer) {
        yield bodyBuffer;
      }
    }
  };
}

class MockNodeResponse {
  headersSent = false;
  statusCode = 200;
  private readonly chunks: Buffer[] = [];
  private headers: Record<string, string> = {};

  writeHead(statusCode: number, headers: Record<string, string | string[] | undefined> = {}) {
    this.statusCode = statusCode;
    this.headers = {
      ...this.headers,
      ...toHeaderRecord(headers)
    };
    this.headersSent = true;
    return this;
  }

  end(chunk?: string | Buffer | null) {
    if (typeof chunk === "string") {
      this.chunks.push(Buffer.from(chunk, "utf8"));
    } else if (chunk instanceof Buffer) {
      this.chunks.push(chunk);
    }

    this.headersSent = true;
  }

  toResponse() {
    return new Response(Buffer.concat(this.chunks), {
      status: this.statusCode,
      headers: this.headers
    });
  }
}

async function loadBackendModules() {
  if (!backendModulesPromise) {
    backendModulesPromise = Promise.all([
      // @ts-expect-error Server-only bridge imports backend runtime modules directly.
      import("../../../backend/src/lib/request-context.mjs"),
      // @ts-expect-error Server-only bridge imports backend runtime modules directly.
      import("../../../backend/src/lib/http.mjs"),
      // @ts-expect-error Server-only bridge imports backend runtime modules directly.
      import("../../../backend/src/modules/identity/index.mjs"),
      // @ts-expect-error Server-only bridge imports backend runtime modules directly.
      import("../../../backend/src/modules/campus/index.mjs"),
      // @ts-expect-error Server-only bridge imports backend runtime modules directly.
      import("../../../backend/src/modules/social/index.mjs"),
      // @ts-expect-error Server-only bridge imports backend runtime modules directly.
      import("../../../backend/src/modules/resources/index.mjs"),
      // @ts-expect-error Server-only bridge imports backend runtime modules directly.
      import("../../../backend/src/modules/moderation/index.mjs")
    ]).then(([requestContextModule, httpModule, identityModule, campusModule, socialModule, resourcesModule, moderationModule]) => ({
      createRequestContext: requestContextModule.createRequestContext,
      sendError: httpModule.sendError,
      handleIdentityRoute: identityModule.handleIdentityRoute,
      handleCampusRoute: campusModule.handleCampusRoute,
      handleSocialRoute: socialModule.handleSocialRoute,
      handleResourcesRoute: resourcesModule.handleResourcesRoute,
      handleModerationRoute: moderationModule.handleModerationRoute
    }));
  }

  return backendModulesPromise;
}

export function isBackendConnectionError(error: unknown): error is Error {
  return error instanceof Error && /fetch failed|econnrefused|enotfound|etimedout|socket hang up/i.test(error.message);
}

export async function invokeBackendRoute(requestInit: BackendBridgeRequest) {
  const modules = await loadBackendModules();
  const request = createMockRequest(requestInit);
  const response = new MockNodeResponse();
  const url = new URL(requestInit.path, BACKEND_BASE_URL);
  const context = modules.createRequestContext(request);
  const routeHandlers = [
    modules.handleIdentityRoute,
    modules.handleCampusRoute,
    modules.handleSocialRoute,
    modules.handleResourcesRoute,
    modules.handleModerationRoute
  ];

  try {
    for (const handler of routeHandlers) {
      if (await handler({ request, response, url, context })) {
        return response.toResponse();
      }
    }
  } catch (error) {
    console.error("[web/backend-bridge] request failed", {
      method: request.method,
      path: requestInit.path,
      requestId: context?.requestId ?? null,
      message: error instanceof Error ? error.message : "unknown"
    });
    throw error;
  }

  modules.sendError(
    response,
    404,
    "ROUTE_NOT_FOUND",
    `Unknown route ${url.pathname}`,
    null,
    {
      "x-request-id": context?.requestId ?? ""
    }
  );

  return response.toResponse();
}
