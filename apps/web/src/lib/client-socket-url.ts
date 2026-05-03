import "server-only";

const API_BASE_URL =
  process.env.VYB_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "0.0.0.0";
}

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || "";
}

function normalizeHttpProtocol(protocol: string) {
  const normalized = protocol.trim().replace(/:$/u, "").toLowerCase();
  return normalized === "https" ? "https" : "http";
}

export function getRequestOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstForwardedValue(request.headers.get("x-forwarded-proto"));
  const host = forwardedHost || request.headers.get("host") || requestUrl.host;
  const protocol = normalizeHttpProtocol(forwardedProto || requestUrl.protocol);

  try {
    return new URL(`${protocol}://${host}`);
  } catch {
    return requestUrl;
  }
}

export function buildClientSocketUrl(request: Request, path: string, token: string) {
  const apiSocketUrl = new URL(path, API_BASE_URL);
  const requestOrigin = getRequestOrigin(request);
  const socketUrl =
    isLoopbackHost(apiSocketUrl.hostname) && !isLoopbackHost(requestOrigin.hostname)
      ? new URL(path, requestOrigin)
      : apiSocketUrl;

  socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
  socketUrl.searchParams.set("token", token);
  return socketUrl;
}
