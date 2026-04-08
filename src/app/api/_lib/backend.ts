/**
 * Backend helper — single source of truth for talking to the local Fish Speech API.
 * Used by every Next.js route handler that proxies through to the tunnel.
 *
 * Env vars (set in Vercel project settings, or .env.local for dev):
 *   FISH_SPEECH_API_URL  e.g. https://your-static.ngrok-free.app
 *   FISH_SPEECH_API_KEY  optional bearer token, must match the value passed to
 *                        tools/api_server.py --api-key on the local backend
 */

export const FISH_API_URL =
  process.env.FISH_SPEECH_API_URL || "http://localhost:8080";
export const FISH_API_KEY = process.env.FISH_SPEECH_API_KEY || "";

interface BackendFetchInit extends RequestInit {
  /** Override default 60s timeout (ms). Set to 0 to disable. */
  timeoutMs?: number;
  /** Skip the JSON Content-Type header (e.g. for FormData uploads). */
  skipJsonContentType?: boolean;
}

/**
 * Fetch wrapper that prepends FISH_API_URL, attaches the bearer token, and
 * applies a timeout via AbortController. Always passes `cache: "no-store"` so
 * Vercel never caches Fish Speech responses.
 */
export async function backendFetch(
  path: string,
  init: BackendFetchInit = {}
): Promise<Response> {
  const {
    timeoutMs = 60_000,
    skipJsonContentType = false,
    headers: customHeaders,
    ...rest
  } = init;

  const headers = new Headers(customHeaders);
  if (!skipJsonContentType && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (FISH_API_KEY && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${FISH_API_KEY}`);
  }
  // ngrok free tier injects an interstitial unless this header is present.
  headers.set("ngrok-skip-browser-warning", "true");

  const controller = timeoutMs > 0 ? new AbortController() : null;
  const timer =
    controller && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    return await fetch(`${FISH_API_URL}${path}`, {
      ...rest,
      headers,
      cache: "no-store",
      signal: controller?.signal,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
