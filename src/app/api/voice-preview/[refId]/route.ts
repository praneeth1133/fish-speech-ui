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

  // Check for pre-baked static preview first
  const staticPath = join(process.cwd(), "public", "previews", `${refId}.wav`);
  if (existsSync(staticPath)) {
    // Redirect to the static file — Vercel CDN will serve it fast
    return new Response(null, {
      status: 307,
      headers: { Location: `/previews/${refId}.wav` },
    });
  }

  // On-demand: generate via TTS
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

    if (!upstream.ok || !upstream.body) {
      const errorText = await upstream.text().catch(() => "");
      console.error(`Preview failed for ${refId}: ${upstream.status} ${errorText}`);
      return Response.json(
        { error: "Failed to generate preview" },
        { status: 502 }
      );
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "audio/wav",
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
