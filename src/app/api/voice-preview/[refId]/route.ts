import { type NextRequest } from "next/server";
import { backendFetch } from "../../_lib/backend";
import { existsSync } from "fs";
import { join } from "path";

export const maxDuration = 60;

/**
 * GET /api/voice-preview/<refId>
 *
 * Serves the voice preview audio. First checks if a pre-baked static file
 * exists in public/previews/<refId>.wav (for the 75 built-in voices).
 * If not, generates one on-demand by calling Fish Speech TTS with a short
 * sample text and the given reference_id, then streams the result back.
 *
 * The on-demand path is used for custom voices added via Record/Upload.
 * A Cache-Control header ensures the browser caches the result for 1 hour
 * so subsequent plays are instant.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ refId: string }> }
) {
  const { refId } = await params;

  if (!/^[a-zA-Z0-9\-_]+$/.test(refId)) {
    return Response.json({ error: "Invalid voice ID" }, { status: 400 });
  }

  // Check for pre-baked static preview first (used for the 75 built-in voices)
  const staticPath = join(process.cwd(), "public", "previews", `${refId}.wav`);
  if (existsSync(staticPath)) {
    return new Response(null, {
      status: 307,
      headers: { Location: `/previews/${refId}.wav` },
    });
  }

  // Second: the backend stores the original reference audio on disk as
  // references/<refId>/sample.wav. Serve that directly — instant, no GPU work.
  try {
    const sampleRes = await backendFetch(
      `/v1/references/${encodeURIComponent(refId)}/sample`,
      { method: "GET", timeoutMs: 15_000 }
    );
    if (sampleRes.ok) {
      const audioBuffer = await sampleRes.arrayBuffer();
      return new Response(audioBuffer, {
        headers: {
          "Content-Type": sampleRes.headers.get("Content-Type") || "audio/wav",
          "Content-Length": String(audioBuffer.byteLength),
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      });
    }
    // 404 means the reference has no static sample (e.g. user-recorded voice
    // registered without the sample surviving on disk). Fall through to TTS.
  } catch (err) {
    console.warn(`Static sample fetch failed for ${refId}:`, err);
    // Fall through to TTS generation below.
  }

  // On-demand TTS fallback (only used if no static sample exists)
  const previewText = "Hello, this is a voice preview. Nice to meet you!";

  try {
    const upstream = await backendFetch("/v1/tts", {
      method: "POST",
      body: JSON.stringify({
        text: previewText,
        reference_id: refId,
        format: "wav",
        max_new_tokens: 400,
      }),
      timeoutMs: 55_000,
    });

    if (!upstream.ok) {
      const errorText = await upstream.text().catch(() => "");
      console.error(`Preview failed for ${refId}: ${upstream.status} ${errorText}`);
      return Response.json(
        { error: "Failed to generate preview" },
        { status: 502 }
      );
    }

    // Buffer the full WAV so the browser gets a complete file with
    // Content-Length — streamed chunked audio won't reliably play in
    // <audio> elements because the RIFF size field stays unknown.
    const audioBuffer = await upstream.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "audio/wav",
        "Content-Length": String(audioBuffer.byteLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("Error generating voice preview:", error);
    return Response.json(
      { error: "Failed to generate voice preview" },
      { status: 502 }
    );
  }
}
