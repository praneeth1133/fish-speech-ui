import { NextRequest } from "next/server";

export const maxDuration = 300;

/**
 * POST /api/omnivoice/tts
 *
 * Proxies to the k2-fsa/OmniVoice HuggingFace Space using Gradio's HTTP API.
 *
 * Request body (multipart or JSON — we accept JSON here, reference audio
 * comes as a base64 string or URL):
 * {
 *   "text": "Hello world",
 *   "language": "English",        // or "Auto"
 *   "mode": "clone",              // "clone" | "design"
 *   "ref_audio_b64"?: "...",      // base64 wav bytes (voice clone)
 *   "ref_audio_url"?: "https://...", // URL instead of base64
 *   "ref_text"?: "",              // optional transcript of reference
 *   "instruct"?: "",              // voice design prompt
 *   "num_step"?: 32,
 *   "guidance_scale"?: 2.0,
 *   "speed"?: 1.0,
 *   "duration"?: -1,              // -1 = auto
 *   "denoise"?: true,
 *   "preprocess_prompt"?: true,
 *   "postprocess_output"?: true
 * }
 *
 * Env vars:
 *   OMNIVOICE_SPACE_URL   default: https://k2-fsa-omnivoice.hf.space
 *                         override to point at your own pay-as-you-go
 *                         HF Inference Endpoint (same Gradio surface).
 *   HF_TOKEN              optional bearer token, required for private
 *                         endpoints or high rate limits.
 *
 * Response: audio/wav stream.
 */
export async function POST(request: NextRequest) {
  const SPACE_URL =
    process.env.OMNIVOICE_SPACE_URL?.replace(/\/$/, "") ||
    "https://k2-fsa-omnivoice.hf.space";
  const HF_TOKEN = process.env.HF_TOKEN || "";

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const text = ((body.text as string) || "").trim();
  if (!text) return jsonError(400, "'text' is required");
  if (text.length > 5000) return jsonError(400, "text too long (max 5000 chars)");

  const language = (body.language as string) || "Auto";
  const mode = (body.mode as string) || "clone"; // "clone" or "design"
  const refAudioB64 = body.ref_audio_b64 as string | undefined;
  const refAudioUrl = body.ref_audio_url as string | undefined;
  const refText = (body.ref_text as string) || "";
  const instruct = (body.instruct as string) || "";
  const numStep = clampInt(body.num_step, 4, 64, 32);
  const guidanceScale = clampFloat(body.guidance_scale, 0.5, 5.0, 2.0);
  const speed = clampFloat(body.speed, 0.5, 2.0, 1.0);
  const duration = clampFloat(body.duration, -1, 60, -1);
  const denoise = body.denoise !== false;
  const preprocess = body.preprocess_prompt !== false;
  const postprocess = body.postprocess_output !== false;

  // Resolve the reference audio into a Gradio-compatible `FileData` object.
  // Gradio accepts either a URL ({url: "https://..."}) or a base64 dataURL
  // inside the same `url` field (it parses data: URLs).
  let refAudioArg: null | { url: string; meta?: { _type?: string } } = null;
  if (refAudioUrl) {
    refAudioArg = { url: refAudioUrl };
  } else if (refAudioB64) {
    refAudioArg = {
      url: refAudioB64.startsWith("data:")
        ? refAudioB64
        : `data:audio/wav;base64,${refAudioB64}`,
    };
  }

  // Build the payload matching OmniVoice's _gen_core signature.
  // Exact order matters for Gradio — see app.py in the Space.
  const payload = {
    data: [
      text,                       // text
      language,                   // language
      refAudioArg,                // ref_audio (FileData | null)
      instruct,                   // instruct (voice design prompt)
      numStep,                    // num_step
      guidanceScale,              // guidance_scale
      denoise,                    // denoise
      speed,                      // speed
      duration,                   // duration
      preprocess,                 // preprocess_prompt
      postprocess,                // postprocess_output
      mode,                       // mode
      refText,                    // ref_text
    ],
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (HF_TOKEN) headers["Authorization"] = `Bearer ${HF_TOKEN}`;

  // Gradio 4/5/6 two-step call:
  //   POST /gradio_api/call/generate_fn      → { event_id }
  //   GET  /gradio_api/call/generate_fn/<id> → SSE with the result
  const callUrl = `${SPACE_URL}/gradio_api/call/generate_fn`;

  let eventId: string;
  try {
    const startResp = await fetch(callUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!startResp.ok) {
      const errText = await startResp.text().catch(() => "");
      return jsonError(
        startResp.status >= 500 ? 502 : startResp.status,
        `OmniVoice start failed: ${errText || startResp.statusText}`
      );
    }
    const started = (await startResp.json()) as { event_id?: string };
    if (!started.event_id) {
      return jsonError(502, "OmniVoice did not return an event_id");
    }
    eventId = started.event_id;
  } catch (err) {
    return jsonError(502, `OmniVoice unreachable: ${String(err)}`);
  }

  // Poll / stream the result. Gradio returns SSE lines like:
  //   event: complete
  //   data: [{"url":"https://...wav","path":"..."},"info string"]
  const resultUrl = `${SPACE_URL}/gradio_api/call/generate_fn/${eventId}`;
  let audioUrl: string | null = null;
  let audioData: string | null = null;

  try {
    const streamResp = await fetch(resultUrl, {
      method: "GET",
      headers: HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : {},
    });
    if (!streamResp.ok || !streamResp.body) {
      return jsonError(502, `OmniVoice poll failed: ${streamResp.status}`);
    }

    // Read the SSE stream line-by-line until we see event: complete
    const reader = streamResp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let currentEvent = "";
    outer: while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let lineEnd;
      while ((lineEnd = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, lineEnd).trim();
        buf = buf.slice(lineEnd + 1);
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          const dataStr = line.slice(5).trim();
          if (currentEvent === "complete" || currentEvent === "generating") {
            try {
              const data = JSON.parse(dataStr);
              // data is typically [outputArray, infoString]
              const first = Array.isArray(data) ? data[0] : null;
              if (first && typeof first === "object") {
                if (first.url) audioUrl = first.url;
                else if (first.path) audioUrl = `${SPACE_URL}/gradio_api/file=${first.path}`;
              }
            } catch { /* ignore non-JSON status lines */ }
          }
          if (currentEvent === "complete") break outer;
          if (currentEvent === "error") {
            return jsonError(502, `OmniVoice error: ${dataStr}`);
          }
        }
      }
    }
  } catch (err) {
    return jsonError(504, `OmniVoice polling error: ${String(err)}`);
  }

  if (!audioUrl && !audioData) {
    return jsonError(502, "OmniVoice finished without an audio URL");
  }

  // Fetch the generated audio and stream back to the caller as audio/wav
  try {
    const audioResp = await fetch(audioUrl!, {
      headers: HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : {},
    });
    if (!audioResp.ok) {
      return jsonError(502, `Failed to fetch generated audio: ${audioResp.status}`);
    }
    const audio = await audioResp.arrayBuffer();
    return new Response(audio, {
      headers: {
        "Content-Type": audioResp.headers.get("Content-Type") || "audio/wav",
        "Content-Length": String(audio.byteLength),
        "Content-Disposition": `inline; filename="omnivoice-${Date.now()}.wav"`,
        "X-Generator": "omnivoice",
        "X-Language": language,
        "X-Mode": mode,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return jsonError(502, `Audio fetch failed: ${String(err)}`);
  }
}

function jsonError(status: number, error: string): Response {
  return Response.json({ error, generator: "omnivoice" }, { status });
}

function clampInt(v: unknown, min: number, max: number, def: number): number {
  const n = typeof v === "number" ? Math.floor(v) : NaN;
  if (!isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}
function clampFloat(v: unknown, min: number, max: number, def: number): number {
  const n = typeof v === "number" ? v : NaN;
  if (!isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}
