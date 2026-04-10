import { backendFetch, FISH_API_URL } from "../_lib/backend";

/**
 * Health check — proxies to the Fish Speech backend's /v1/health endpoint.
 * Must be robust against ngrok's offline HTML page (which may return 2xx
 * with HTML content saying the endpoint is offline). We parse the body and
 * verify it actually looks like a Fish Speech health response.
 */
export async function GET() {
  // Prevent the sidebar's browser-side fetch from getting a cached response
  const noCache = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };

  try {
    const res = await backendFetch("/v1/health", {
      method: "GET",
      timeoutMs: 5_000,
    });

    if (!res.ok) {
      return Response.json(
        { status: "disconnected", fish_speech_url: FISH_API_URL },
        { headers: noCache }
      );
    }

    // Some tunnels/proxies return a 200 HTML error page when the origin is
    // offline (e.g. ngrok's "endpoint is offline" page). Check the content
    // type and verify the JSON body matches the Fish Speech shape.
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return Response.json(
        { status: "disconnected", fish_speech_url: FISH_API_URL },
        { headers: noCache }
      );
    }

    const body = (await res.json().catch(() => null)) as
      | { status?: string }
      | null;
    const connected = body?.status === "ok";

    return Response.json(
      {
        status: connected ? "connected" : "disconnected",
        fish_speech_url: FISH_API_URL,
      },
      { headers: noCache }
    );
  } catch {
    return Response.json(
      { status: "disconnected", fish_speech_url: FISH_API_URL },
      { headers: noCache }
    );
  }
}
