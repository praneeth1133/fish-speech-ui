import { backendFetch } from "../_lib/backend";
import { VOICE_NAME_MAP, getLanguageFromId } from "@/lib/voice-names";

/**
 * GET — list reference voices from the Fish Speech backend (msgpack response),
 * enrich them with display metadata, and return as JSON.
 */
export async function GET() {
  let referenceIds: string[] = [];
  const mtimes: Record<string, number> = {};
  try {
    // Prefer the detailed endpoint so we have mtimes for sorting.
    const detailed = await backendFetch("/v1/references/list-detailed", {
      method: "GET",
      timeoutMs: 10_000,
    });
    if (detailed.ok) {
      const data = (await detailed.json()) as {
        references?: { id: string; mtime: number }[];
      };
      for (const e of data.references || []) {
        referenceIds.push(e.id);
        mtimes[e.id] = e.mtime || 0;
      }
    } else {
      // Fallback: old list endpoint (no mtimes)
      const res = await backendFetch("/v1/references/list", {
        method: "GET",
        timeoutMs: 10_000,
      });
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const { unpack } = await import("msgpackr");
        const data = unpack(new Uint8Array(buffer)) as { reference_ids?: string[] };
        referenceIds = data.reference_ids || [];
      }
    }
  } catch (err) {
    console.error("Failed to list references:", err);
  }

  const voices = referenceIds.map((refId) => {
    const info = VOICE_NAME_MAP[refId];
    const lang = getLanguageFromId(refId);
    return {
      id: `ref:${refId}`,
      name: refId,
      displayName: info?.displayName || refId,
      language: info?.language || lang,
      gender: info?.gender || (refId.includes("-male-") ? "male" : "female"),
      languageCode: info?.languageCode || lang.slice(0, 2),
      avatarInitials: info?.avatarInitials || refId.slice(0, 2).toUpperCase(),
      tagline: info?.tagline || "",
      country: info?.country || "International",
      countryCode: info?.countryCode || "xx",
      ageBucket: info?.ageBucket || "adult",
      age: info?.age ?? null,
      source: info?.source || "fish-speech-builtin",
      previewUrl: `/api/voice-preview/${refId}`,
      description: "",
      reference_text: "",
      is_backend_ref: true,
      mtime: mtimes[refId] || 0,
    };
  });

  return Response.json(
    { voices, references: referenceIds },
    { headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } }
  );
}

/**
 * POST — register a custom reference voice.
 *
 * Two flavours:
 *   - Fish-Speech (default): multipart with { name, audio, reference_text }.
 *     Forwarded to /v1/references/add (audio cloning).
 *   - Indic Parler-TTS (Telugu): multipart with
 *     { name, engine: "indic-parler", speaker_id, description, language }.
 *     Forwarded as JSON to /v1/references/add-profile (description-based,
 *     no audio upload).
 *
 * Branch picked by the `engine` form field; absent = Fish-Speech.
 */
export async function POST(request: Request) {
  let inForm: FormData;
  try {
    inForm = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const name = (inForm.get("name") as string | null)?.trim();
  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  const refId = name.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
  const engine = (inForm.get("engine") as string | null)?.trim() || "fish-speech";

  if (engine === "indic-parler") {
    const speakerId = (inForm.get("speaker_id") as string | null)?.trim() || "";
    const description = (inForm.get("description") as string | null)?.trim() || "";
    const language = (inForm.get("language") as string | null)?.trim() || "telugu";
    const displayName = (inForm.get("description") as string | null)?.trim() || name;
    const gender = (inForm.get("gender") as string | null)?.trim() || "";
    const ageBucket = (inForm.get("age_bucket") as string | null)?.trim() || "adult";

    if (!speakerId || !description) {
      return Response.json(
        { error: "speaker_id and description are required for Indic Parler-TTS" },
        { status: 400 }
      );
    }

    try {
      const res = await backendFetch("/v1/references/add-profile", {
        method: "POST",
        body: JSON.stringify({
          id: refId,
          engine: "indic-parler",
          speaker_id: speakerId,
          description,
          display_name: displayName,
          gender,
          language,
          age_bucket: ageBucket,
        }),
        timeoutMs: 15_000,
      });
      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        return Response.json(
          { error: errorText || `Backend returned ${res.status}` },
          { status: res.status }
        );
      }
      return Response.json({
        id: refId,
        reference_id: refId,
        name,
        engine: "indic-parler",
      });
    } catch (err) {
      console.error("Telugu profile creation error:", err);
      return Response.json(
        { error: err instanceof Error ? err.message : "Failed to create voice" },
        { status: 502 }
      );
    }
  }

  // Fish-Speech path (default) — audio upload + reference text.
  const referenceText = (inForm.get("reference_text") as string | null)?.trim() || "";
  const audioFile = inForm.get("audio") as File | null;

  if (!audioFile || !referenceText) {
    return Response.json(
      { error: "Audio file and reference text are required" },
      { status: 400 }
    );
  }

  // Re-build the multipart payload with the field names the Fish Speech API expects.
  const outForm = new FormData();
  outForm.append("id", refId);
  outForm.append("text", referenceText);
  outForm.append("audio", audioFile, audioFile.name || "reference.wav");

  try {
    const res = await backendFetch("/v1/references/add", {
      method: "POST",
      body: outForm,
      skipJsonContentType: true, // let fetch set the multipart boundary
      timeoutMs: 30_000,
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      return Response.json(
        { error: errorText || `Backend returned ${res.status}` },
        { status: res.status }
      );
    }
    return Response.json({ id: refId, reference_id: refId, name });
  } catch (err) {
    console.error("Voice creation error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create voice" },
      { status: 502 }
    );
  }
}

/**
 * DELETE — unregister a reference voice from the Fish Speech backend.
 */
export async function DELETE(request: Request) {
  let body: { reference_id?: string; id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Accept either reference_id or id (legacy callers passed both)
  const referenceId =
    body.reference_id ||
    (body.id?.startsWith("ref:") ? body.id.slice(4) : body.id);

  if (!referenceId) {
    return Response.json({ error: "reference_id is required" }, { status: 400 });
  }

  try {
    const res = await backendFetch("/v1/references/delete", {
      method: "DELETE",
      body: JSON.stringify({ reference_id: referenceId }),
      timeoutMs: 10_000,
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      return Response.json(
        { error: errorText || `Backend returned ${res.status}` },
        { status: res.status }
      );
    }
    return Response.json({ success: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to delete voice" },
      { status: 502 }
    );
  }
}
