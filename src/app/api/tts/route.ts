import { backendFetch } from "../_lib/backend";

// TTS generation can take a while on consumer GPUs. On Vercel Hobby this is
// capped at 60s. On Pro you can bump it via vercel.json.
export const maxDuration = 300;

/**
 * Thin proxy: forward the JSON body to {FISH_API_URL}/v1/tts and stream the
 * audio response straight back to the browser. No DB writes, no disk writes —
 * the browser stores the resulting blob in IndexedDB on the client side.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = (body as { text?: unknown }).text;
  if (typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "Text is required" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await backendFetch("/v1/tts", {
      method: "POST",
      body: JSON.stringify(body),
      timeoutMs: 290_000,
    });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "TTS generation timed out"
        : err instanceof Error
          ? err.message
          : "Failed to reach Fish Speech backend";
    return Response.json({ error: message }, { status: 504 });
  }

  if (!upstream.ok || !upstream.body) {
    const errorText = await upstream.text().catch(() => "");
    return Response.json(
      { error: errorText || `Backend returned ${upstream.status}` },
      { status: upstream.status || 502 }
    );
  }

  const contentType = upstream.headers.get("Content-Type") || "audio/wav";
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}
