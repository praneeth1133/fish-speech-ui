import { backendFetch } from "../../../_lib/backend";
import { VOICE_NAME_MAP } from "@/lib/voice-names";

export const maxDuration = 300;

const DEFAULT_TELUGU_VOICE = "telugu-female-3";

/**
 * POST /api/v1/telugu/tts
 *
 * Public Telugu Text-to-Speech API. Accepts a Telugu script (with optional
 * expression tags like [EXCITED], [LONG PAUSE], etc.) and returns a generated
 * WAV or MP3 file.
 *
 * Request body:
 * {
 *   "text": "నమస్కారం. ఈ ఒక తెలుగు పరీక్ష.",
 *   "voice": "telugu-female-3",           // optional, any telugu-* id from /api/v1/telugu/voices
 *   "format": "wav",                       // "wav" | "mp3", default "wav"
 *   "temperature": 0.8,                    // optional, 0.1-1.2
 *   "top_p": 0.8,                          // optional, 0.1-1.0
 *   "max_new_tokens": 1024,                // optional, 64-2048
 *   "chunk_length": 200                    // optional, 50-500 (bytes before auto-split)
 * }
 *
 * Response:
 * - 200 with audio/wav or audio/mpeg body
 * - 400 on bad input
 * - 502 when the backend is down
 *
 * Response headers include:
 *   X-Language: telugu
 *   X-Voice: <resolved voice id>
 *   Content-Type: audio/wav | audio/mpeg
 */
export async function POST(request: Request) {
  let body: {
    text?: string;
    voice?: string;
    format?: string;
    temperature?: number;
    top_p?: number;
    max_new_tokens?: number;
    chunk_length?: number;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const text = (body.text || "").trim();
  if (!text) return jsonError(400, "'text' is required");
  if (text.length > 10000) return jsonError(400, "'text' too long (max 10000 chars)");

  // Resolve voice — default if omitted, validate if provided
  const voice = (body.voice || DEFAULT_TELUGU_VOICE).trim();
  const voiceInfo = VOICE_NAME_MAP[voice];
  if (!voiceInfo) {
    return jsonError(
      400,
      `Unknown voice '${voice}'. See GET /api/v1/telugu/voices.`
    );
  }
  if ((voiceInfo.language || "").toLowerCase() !== "telugu") {
    return jsonError(
      400,
      `Voice '${voice}' is not a Telugu voice (it's ${voiceInfo.language}). Use GET /api/v1/telugu/voices for valid options.`
    );
  }

  const format = (body.format || "wav").toLowerCase();
  if (format !== "wav" && format !== "mp3") {
    return jsonError(400, "'format' must be 'wav' or 'mp3'");
  }

  const payload = {
    text,
    reference_id: voice,
    references: [],
    format,
    temperature: clamp(body.temperature ?? 0.8, 0.1, 1.2),
    top_p: clamp(body.top_p ?? 0.8, 0.1, 1.0),
    max_new_tokens: Math.floor(clamp(body.max_new_tokens ?? 1024, 64, 2048)),
    chunk_length: Math.floor(clamp(body.chunk_length ?? 200, 50, 500)),
    repetition_penalty: 1.1,
  };

  try {
    const upstream = await backendFetch("/v1/tts", {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 290_000,
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      return jsonError(
        upstream.status >= 500 ? 502 : upstream.status,
        `TTS backend error: ${errText || upstream.statusText}`
      );
    }

    const audio = await upstream.arrayBuffer();
    const contentType = format === "mp3" ? "audio/mpeg" : "audio/wav";
    return new Response(audio, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(audio.byteLength),
        "Content-Disposition": `inline; filename="telugu-${Date.now()}.${format}"`,
        "X-Language": "telugu",
        "X-Voice": voice,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "X-Language, X-Voice, Content-Disposition",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("telugu/tts error", err);
    return jsonError(502, err instanceof Error ? err.message : "Backend unreachable");
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

function jsonError(status: number, error: string): Response {
  return Response.json(
    { error, language: "telugu" },
    {
      status,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
