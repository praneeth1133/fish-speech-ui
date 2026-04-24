import { NextRequest } from "next/server";
import { backendFetch } from "../../_lib/backend";

export const maxDuration = 300;

/**
 * POST /api/omnivoice/tts
 *
 * Proxies to the k2-fsa/OmniVoice HuggingFace Space using Gradio's HTTP API.
 *
 * Request body (JSON):
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
 *   "postprocess_output"?: true,
 *   // design mode only
 *   "gender"?: "Auto" | "Male / 男" | "Female / 女",
 *   "age"?: "Auto" | ...,
 *   "pitch"?: "Auto" | ...,
 *   "style"?: "Auto" | "Whisper / 耳语",
 *   "accent"?: "Auto" | ...,
 *   "dialect"?: "Auto" | ...
 * }
 *
 * Env vars:
 *   OMNIVOICE_SPACE_URL   default: https://k2-fsa-omnivoice.hf.space (public Space,
 *                         unreliable). Point at your own duplicated Space or HF
 *                         Inference Endpoint for reliability.
 *   HF_TOKEN              required if OMNIVOICE_SPACE_URL points at a private
 *                         Space. Read-scope token is sufficient.
 *
 * Response: audio/wav stream.
 */

const DEFAULT_SPACE_URL = "https://k2-fsa-omnivoice.hf.space";

// GET /api/omnivoice/tts — simple health check that confirms which Space
// URL is configured and whether a token is set. Useful for debugging prod
// env-var wiring without having to trigger a full generation.
export async function GET() {
  const SPACE_URL = (process.env.OMNIVOICE_SPACE_URL || DEFAULT_SPACE_URL).replace(
    /\/$/,
    ""
  );
  const hasToken = !!process.env.HF_TOKEN;
  const isPublicSpace = SPACE_URL === DEFAULT_SPACE_URL;
  return Response.json({
    ok: true,
    space_url: SPACE_URL,
    has_token: hasToken,
    using_public_space: isPublicSpace,
    notice: isPublicSpace
      ? "Using the free public Space on Zero-GPU — it is often unavailable. " +
        "Set OMNIVOICE_SPACE_URL to your duplicated paid Space for reliability."
      : "Custom Space URL configured. Generation should be reliable.",
  });
}

export async function POST(request: NextRequest) {
  const SPACE_URL = (process.env.OMNIVOICE_SPACE_URL || DEFAULT_SPACE_URL).replace(
    /\/$/,
    ""
  );
  const HF_TOKEN = process.env.HF_TOKEN || "";
  const isPublicSpace = SPACE_URL === DEFAULT_SPACE_URL;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const rawText = ((body.text as string) || "").trim();
  if (!rawText) return jsonError(400, "'text' is required");
  if (rawText.length > 5000) return jsonError(400, "text too long (max 5000 chars)");

  // Strip expression tags so OmniVoice doesn't speak them literally.
  // Pause tags are converted to punctuation (commas / periods / em-dashes)
  // which the model naturally reads as short / medium / long pauses.
  // Emotion tags ([EXCITED], [SAD], etc.) are SILENTLY DROPPED rather than
  // rewritten into the `instruct` field — OmniVoice's _clone_fn validates
  // instruct against a strict attribute vocabulary (gender / age / pitch /
  // accent / style keywords), so any free-form "Voice it excited…" phrase
  // trips "ValueError: Unsupported instruct items".
  const { cleanText } = parseExpressions(rawText);

  const language = (body.language as string) || "Auto";
  let mode = (body.mode as string) || "clone"; // "clone" or "design"
  let refAudioB64 = body.ref_audio_b64 as string | undefined;
  const refAudioUrl = body.ref_audio_url as string | undefined;
  const refText = (body.ref_text as string) || "";
  const fishSpeechVoiceId = body.fish_speech_voice_id as string | undefined;

  // Holds the Gradio file upload path (set either from a Fish Speech bridge
  // voice or from a user-provided base64/url clone upload).
  let uploadedRefPath: string | null = null;

  // When a Fish Speech voice id is supplied, pull its reference WAV directly
  // from the local backend and feed it into OmniVoice's _clone_fn. This is
  // how we make every Fish Speech reference voice available inside OmniVoice
  // without the user having to upload audio manually.
  if (fishSpeechVoiceId && !refAudioB64 && !refAudioUrl) {
    if (!/^[a-zA-Z0-9\-_]+$/.test(fishSpeechVoiceId)) {
      return jsonError(400, "Invalid fish_speech_voice_id");
    }
    try {
      const sampleResp = await backendFetch(
        `/v1/references/${encodeURIComponent(fishSpeechVoiceId)}/sample`,
        { method: "GET", timeoutMs: 15_000 }
      );
      if (!sampleResp.ok) {
        return jsonError(
          sampleResp.status === 404 ? 404 : 502,
          sampleResp.status === 404
            ? `Fish Speech voice "${fishSpeechVoiceId}" has no reference audio on the backend`
            : `Failed to fetch Fish Speech reference audio (${sampleResp.status})`
        );
      }
      const wavBuf = await sampleResp.arrayBuffer();
      const contentType = sampleResp.headers.get("Content-Type") || "audio/wav";
      // Upload into Gradio's sandbox first. Passing a raw data URL in the
      // FileData payload makes Gradio 5 pydantic reject it with a
      // "ValidationError: 1 validation error for FileData" — the modern
      // queue API wants an actual /tmp/gradio/<path> that the Space has
      // already accepted via its /upload endpoint.
      const space = (process.env.OMNIVOICE_SPACE_URL || DEFAULT_SPACE_URL).replace(/\/$/, "");
      const token = process.env.HF_TOKEN || "";
      uploadedRefPath = await uploadToGradio(
        space,
        token,
        new Uint8Array(wavBuf),
        `${fishSpeechVoiceId}.wav`,
        contentType
      );
      mode = "clone"; // Force clone mode whenever a Fish Speech voice is attached
    } catch (err) {
      return jsonError(
        502,
        `Couldn't stage Fish Speech reference for OmniVoice: ${String(err)}`
      );
    }
  }

  // If the caller sent an inline clone upload (Clone mode), stage it through
  // Gradio's /upload too so the FileData object we pass to _clone_fn always
  // points at a Space-hosted path, never a data URL.
  if (!uploadedRefPath && (refAudioB64 || refAudioUrl)) {
    try {
      let bytes: Uint8Array;
      let filename = "reference.wav";
      let ctype = "audio/wav";
      if (refAudioB64) {
        const match = refAudioB64.match(/^data:([^;]+);base64,(.*)$/);
        const dataPart = match ? match[2] : refAudioB64;
        ctype = match?.[1] || "audio/wav";
        bytes = Buffer.from(dataPart, "base64");
      } else if (refAudioUrl) {
        const r = await fetch(refAudioUrl);
        if (!r.ok) throw new Error(`Could not fetch ref audio URL: ${r.status}`);
        bytes = new Uint8Array(await r.arrayBuffer());
        ctype = r.headers.get("Content-Type") || ctype;
      } else {
        bytes = new Uint8Array();
      }
      if (bytes.length > 0) {
        const space = (process.env.OMNIVOICE_SPACE_URL || DEFAULT_SPACE_URL).replace(/\/$/, "");
        const token = process.env.HF_TOKEN || "";
        uploadedRefPath = await uploadToGradio(space, token, bytes, filename, ctype);
      }
    } catch (err) {
      return jsonError(
        502,
        `Couldn't stage reference audio for OmniVoice: ${String(err)}`
      );
    }
  }
  const instruct = (body.instruct as string) || "";
  const numStep = clampInt(body.num_step, 4, 64, 32);
  const guidanceScale = clampFloat(body.guidance_scale, 0.5, 5.0, 2.0);
  const speed = clampFloat(body.speed, 0.5, 2.0, 1.0);
  const duration = clampFloat(body.duration, -1, 60, -1);
  const denoise = body.denoise !== false;
  const preprocess = body.preprocess_prompt !== false;
  const postprocess = body.postprocess_output !== false;

  // Build a Gradio 5-compliant FileData payload. The queue-based endpoint
  // requires a real server-side `path` (returned by /gradio_api/upload) plus
  // the {_type: "gradio.FileData"} marker on meta; any other shape trips
  // pydantic validation with "1 validation error for FileData".
  const refAudioArg = uploadedRefPath
    ? {
        path: uploadedRefPath,
        orig_name: uploadedRefPath.split("/").pop() || "reference.wav",
        mime_type: "audio/wav",
        size: null,
        url: null,
        is_stream: false,
        meta: { _type: "gradio.FileData" },
      }
    : null;

  // Only pass the user-supplied instruct through. OmniVoice expects this
  // field to use its controlled vocabulary (e.g. "male, elderly, high pitch"),
  // so we trust whatever the caller put there and never append our own text.
  const instructFinal = instruct;

  // OmniVoice exposes two Gradio functions:
  //   fn_index 0 = _clone_fn   — used when ref_audio is provided
  //   fn_index 1 = _design_fn  — used when describing via attribute dropdowns
  const useClone = mode === "clone";
  const fnIndex: 0 | 1 = useClone ? 0 : 1;

  // Duration as number ("" in Gradio = null/auto)
  const durationArg = duration >= 0 ? duration : null;

  const data: unknown[] = useClone
    ? [
        cleanText,      // [0] text
        language,       // [1] language
        refAudioArg,    // [2] ref_audio (FileData | null)
        refText,        // [3] ref_text
        instructFinal,  // [4] instruct
        numStep,        // [5] inference steps
        guidanceScale,  // [6] guidance scale
        denoise,        // [7] denoise
        speed,          // [8] speed
        durationArg,    // [9] duration
        preprocess,     // [10] preprocess_prompt
        postprocess,    // [11] postprocess_output
      ]
    : [
        cleanText,                                  // [0] text
        language,                                   // [1] language
        numStep,                                    // [2] steps
        guidanceScale,                              // [3] cfg
        denoise,                                    // [4] denoise
        speed,                                      // [5] speed
        durationArg,                                // [6] duration
        preprocess,                                 // [7] preprocess
        postprocess,                                // [8] postprocess
        (body.gender as string) || "Auto",          // [9] gender
        (body.age as string) || "Auto",             // [10] age
        (body.pitch as string) || "Auto",           // [11] pitch
        (body.style as string) || "Auto",           // [12] style
        (body.accent as string) || "Auto",          // [13] English accent
        (body.dialect as string) || "Auto",         // [14] Chinese dialect
      ];

  // Try up to 2 attempts: the Zero-GPU public Space often fails the first call
  // after a cold boot and succeeds on retry. For paid Spaces the retry is
  // essentially free (it only runs after a genuine error).
  const MAX_ATTEMPTS = isPublicSpace ? 2 : 1;
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await callSpaceOnce({
      spaceUrl: SPACE_URL,
      token: HF_TOKEN,
      fnIndex,
      data,
    });
    if (result.audio) {
      return new Response(result.audio, {
        headers: {
          "Content-Type": result.contentType || "audio/wav",
          "Content-Length": String(result.audio.byteLength),
          "Content-Disposition": `inline; filename="omnivoice-${Date.now()}.wav"`,
          "X-Generator": "omnivoice",
          "X-Language": language,
          "X-Mode": mode,
          "X-Attempts": String(attempt),
          "Cache-Control": "no-store",
        },
      });
    }
    lastError = result.error || "unknown error";
    // Only retry on transient errors, not user errors
    const transient =
      result.status >= 500 ||
      /zero-size|ValueError|null|unavailable|timeout/i.test(lastError);
    if (!transient) break;
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // All attempts failed — return the last error with guidance.
  const guidance = isPublicSpace
    ? " — The free HF Space on Zero-GPU is unstable. Duplicate the Space with " +
      "paid hardware and set OMNIVOICE_SPACE_URL + HF_TOKEN in your env vars."
    : " — Your custom Space responded with an error. Check the Space logs " +
      "at huggingface.co/spaces/<owner>/<name>?logs=container.";
  return jsonError(502, lastError + guidance);
}

// ---------------------------------------------------------------------------
// Queue-based Gradio call.
//
// The older `/gradio_api/call/<endpoint>` API returns `event: error / data: null`
// intermittently against the k2-fsa/OmniVoice Space — every test against it
// failed even when the Space was healthy. The newer `/gradio_api/queue/join`
// + `/gradio_api/queue/data` pipeline is what the Gradio JS client itself
// uses; it streams structured queue messages (estimation → process_starts →
// process_completed) and is reliable.
// ---------------------------------------------------------------------------
async function callSpaceOnce(args: {
  spaceUrl: string;
  token: string;
  fnIndex: 0 | 1; // 0 = _clone_fn, 1 = _design_fn
  data: unknown[];
}): Promise<
  | { audio: ArrayBuffer; contentType: string; status: 200; error?: never }
  | { audio: null; contentType?: never; status: number; error: string }
> {
  const { spaceUrl, token, fnIndex, data } = args;

  const sessionHash = randomSessionHash();

  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Step 1: POST to /gradio_api/queue/join — schedules the work and returns
  // an event_id. We include fn_index (the position of the endpoint in
  // Gradio's dependency list) and a unique session_hash so we can later
  // subscribe to exactly our job's updates.
  let eventId: string;
  try {
    const joinResp = await fetch(`${spaceUrl}/gradio_api/queue/join`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        data,
        fn_index: fnIndex,
        session_hash: sessionHash,
        trigger_id: 0,
      }),
    });
    if (!joinResp.ok) {
      const errText = await joinResp.text().catch(() => "");
      return {
        audio: null,
        status: joinResp.status,
        error: `Gradio queue join failed (${joinResp.status}): ${errText || joinResp.statusText}`,
      };
    }
    const joined = (await joinResp.json()) as { event_id?: string };
    if (!joined.event_id) {
      return { audio: null, status: 502, error: "Gradio did not return an event_id" };
    }
    eventId = joined.event_id;
  } catch (err) {
    return { audio: null, status: 502, error: `Gradio unreachable: ${String(err)}` };
  }

  // Step 2: subscribe to the SSE stream. Events we care about:
  //   {msg: "estimation"}       — queued, optional rank_eta
  //   {msg: "process_starts"}   — model is actually running
  //   {msg: "process_completed", success, output: {...|error}}
  //   {msg: "close_stream"}
  const streamUrl = `${spaceUrl}/gradio_api/queue/data?session_hash=${encodeURIComponent(sessionHash)}`;
  let audioUrl: string | null = null;
  let completionInfo = "";

  try {
    const streamResp = await fetch(streamUrl, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!streamResp.ok || !streamResp.body) {
      return {
        audio: null,
        status: streamResp.status,
        error: `Gradio queue stream failed: ${streamResp.status}`,
      };
    }

    const reader = streamResp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    outer: while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let lineEnd;
      while ((lineEnd = buf.indexOf("\n")) !== -1) {
        const rawLine = buf.slice(0, lineEnd);
        buf = buf.slice(lineEnd + 1);
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;
        let msg: QueueMessage;
        try {
          msg = JSON.parse(jsonStr) as QueueMessage;
        } catch {
          continue;
        }
        // Only react to our own event_id (the stream can carry other users' events)
        if (msg.event_id && msg.event_id !== eventId) continue;

        if (msg.msg === "process_completed") {
          if (msg.success && msg.output && Array.isArray(msg.output.data)) {
            const first = msg.output.data[0] as
              | { url?: string; path?: string }
              | null;
            if (first && typeof first === "object") {
              if (first.url) audioUrl = first.url;
              else if (first.path) audioUrl = `${spaceUrl}/gradio_api/file=${first.path}`;
            }
            const second = msg.output.data[1];
            if (typeof second === "string") completionInfo = second;
          } else if (msg.output && typeof msg.output === "object" && "error" in msg.output) {
            completionInfo = String(msg.output.error);
          }
          break outer;
        }
        if (msg.msg === "close_stream") break outer;
      }
    }
  } catch (err) {
    return { audio: null, status: 504, error: `Gradio poll error: ${String(err)}` };
  }

  if (!audioUrl) {
    const msg = completionInfo || "empty result";
    return { audio: null, status: 502, error: `OmniVoice: ${msg}` };
  }

  // Step 3: fetch the generated audio bytes and return them to the caller
  try {
    const audioResp = await fetch(audioUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!audioResp.ok) {
      return {
        audio: null,
        status: audioResp.status,
        error: `Failed to fetch generated audio: ${audioResp.status}`,
      };
    }
    const audio = await audioResp.arrayBuffer();
    return {
      audio,
      contentType: audioResp.headers.get("Content-Type") || "audio/wav",
      status: 200,
    };
  } catch (err) {
    return { audio: null, status: 502, error: `Audio fetch failed: ${String(err)}` };
  }
}

interface QueueMessage {
  msg: string;
  event_id?: string;
  success?: boolean;
  output?: {
    data?: unknown[];
    error?: unknown;
  };
}

/**
 * Upload a WAV blob to the Gradio Space's /upload endpoint and return the
 * server-side /tmp/gradio/... path the Space issued. That path is what we
 * feed into the FileData object passed to _clone_fn — anything else (raw
 * data URLs, external HTTP URLs) fails pydantic validation in Gradio 5+.
 *
 * Endpoint: POST /gradio_api/upload?upload_id=<hash>
 *   body: multipart/form-data with one "files" field
 *   response: ["/tmp/gradio/<hash>/<origname>"]
 */
async function uploadToGradio(
  spaceUrl: string,
  token: string,
  bytes: Uint8Array,
  filename: string,
  contentType: string
): Promise<string> {
  const uploadId = randomSessionHash();
  // Use a Blob so the runtime builds a real multipart body with proper boundary.
  // Copy into a standalone ArrayBuffer so the DOM Blob type accepts it (avoids
  // a "Uint8Array<ArrayBufferLike> not assignable to BlobPart" TS error that
  // surfaces when the source buffer might be a SharedArrayBuffer).
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const blob = new Blob([ab], { type: contentType });
  const form = new FormData();
  form.append("files", blob, filename);
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const resp = await fetch(
    `${spaceUrl}/gradio_api/upload?upload_id=${encodeURIComponent(uploadId)}`,
    { method: "POST", body: form, headers }
  );
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Gradio upload failed (${resp.status}): ${txt || resp.statusText}`);
  }
  const paths = (await resp.json()) as string[];
  if (!Array.isArray(paths) || typeof paths[0] !== "string") {
    throw new Error("Gradio upload returned no path");
  }
  return paths[0];
}

function randomSessionHash(): string {
  // 12 random hex chars — enough entropy for per-request uniqueness.
  return Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Parse Fish-Speech-style expression tags from user text.
 *
 * OmniVoice does not support free-form emotion direction — its `instruct`
 * field expects a comma-separated list of attribute keywords from a strict
 * vocabulary (gender / age / pitch / accent / style). Any sentence like
 * "Voice it excited and energetic." trips
 *   ValueError: Unsupported instruct items found in '…'
 *
 * So here we only translate pause tags into real punctuation and strip
 * every other bracketed tag entirely. Emotion cues carry through via the
 * reference audio for clone mode, or via the attribute dropdowns for design
 * mode — never via instruct.
 */
function parseExpressions(text: string): { cleanText: string } {
  // Pause tags → punctuation (OmniVoice reads these as real pauses)
  let s = text
    .replace(/\[\s*LONG\s+PAUSE\s*\]/gi, " — ")
    .replace(/\[\s*MEDIUM\s+PAUSE\s*\]/gi, ". ")
    .replace(/\[\s*SHORT\s+PAUSE\s*\]/gi, ", ");

  // Any other bracketed token (emotion tags, stage directions, lowercased
  // "[giggles]", etc.) — drop it silently. Leaving them in would make the
  // model try to pronounce words like "EXCITED" inside the audio.
  s = s.replace(/\[[^\]]+\]/g, " ");

  // Collapse whitespace and tidy up spaces before punctuation
  const cleanText = s
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?—])/g, "$1")
    .trim();

  return { cleanText };
}
