import { backendFetch } from "../_lib/backend";
import { VOICE_NAME_MAP, getLanguageFromId } from "@/lib/voice-names";

/**
 * GET — list reference voices from the Fish Speech backend (msgpack response),
 * enrich them with display metadata, and return as JSON.
 */
export async function GET() {
  let referenceIds: string[] = [];
  try {
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
      previewUrl: `/previews/${refId}.wav`,
      description: "",
      reference_text: "",
      is_backend_ref: true,
    };
  });

  return Response.json(
    { voices, references: referenceIds },
    { headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } }
  );
}

/**
 * POST — register a custom reference voice with the Fish Speech backend by
 * forwarding the multipart upload. No local storage.
 */
export async function POST(request: Request) {
  let inForm: FormData;
  try {
    inForm = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const name = (inForm.get("name") as string | null)?.trim();
  const referenceText = (inForm.get("reference_text") as string | null)?.trim() || "";
  const audioFile = inForm.get("audio") as File | null;

  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  if (!audioFile || !referenceText) {
    return Response.json(
      { error: "Audio file and reference text are required" },
      { status: 400 }
    );
  }

  const refId = name.toLowerCase().replace(/[^a-z0-9-_]/g, "-");

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
