import { backendFetch, FISH_API_URL } from "../_lib/backend";

/**
 * Health check — proxies to the Fish Speech backend's /v1/health endpoint.
 * Used by the api-keys page to confirm the tunnel is reachable.
 */
export async function GET() {
  try {
    const res = await backendFetch("/v1/health", {
      method: "GET",
      timeoutMs: 5_000,
    });
    return Response.json({
      status: res.ok ? "connected" : "disconnected",
      fish_speech_url: FISH_API_URL,
    });
  } catch {
    return Response.json({
      status: "disconnected",
      fish_speech_url: FISH_API_URL,
    });
  }
}
