import { backendFetch } from "../../../_lib/backend";
import { VOICE_NAME_MAP } from "@/lib/voice-names";

/**
 * GET /api/v1/telugu/voices
 *
 * Public listing of every Telugu voice available in the Fish Speech backend.
 * Safe to embed in any app — no auth required.
 *
 * Response:
 * {
 *   "language": "telugu",
 *   "total": 10,
 *   "voices": [{ id, name, displayName, gender, ageBucket, previewUrl }, ...]
 * }
 */
export async function GET(request: Request) {
  let referenceIds: string[] = [];
  try {
    const detailed = await backendFetch("/v1/references/list-detailed", {
      method: "GET",
      timeoutMs: 10_000,
    });
    if (detailed.ok) {
      const data = (await detailed.json()) as {
        references?: { id: string; mtime: number }[];
      };
      referenceIds = (data.references || []).map((e) => e.id);
    }
  } catch (err) {
    console.error("telugu/voices: backend list failed", err);
  }

  const origin = new URL(request.url).origin;
  const voices = referenceIds
    .filter((id) => {
      const info = VOICE_NAME_MAP[id];
      return (info?.language || "").toLowerCase() === "telugu";
    })
    .map((id) => {
      const info = VOICE_NAME_MAP[id]!;
      return {
        id,
        name: id,
        displayName: info.displayName,
        gender: info.gender,
        ageBucket: info.ageBucket,
        tagline: info.tagline,
        previewUrl: `${origin}/api/voice-preview/${id}`,
      };
    });

  return Response.json(
    {
      language: "telugu",
      total: voices.length,
      voices,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60",
        // Allow third-party sites to call this endpoint from the browser.
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    }
  );
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
