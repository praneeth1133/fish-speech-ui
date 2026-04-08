import { type NextRequest } from "next/server";
import { backendFetch } from "../../../_lib/backend";

export const maxDuration = 120;

const PREVIEW_TEXTS: Record<string, string> = {
  "english-female": "Hello, this is a preview.",
  "english-male": "Hello, this is a preview.",
  "spanish-female": "Hola, esto es una vista previa.",
  "spanish-male": "Hola, esto es una vista previa.",
  "hindi-female": "नमस्ते, यह एक पूर्वावलोकन है।",
  "hindi-male": "नमस्ते, यह एक पूर्वावलोकन है।",
  "telugu-female": "హలో, ఇది ప్రదర్శన.",
  "telugu-male": "హలో, ఇది ప్రదర్శన.",
  "kannada-female": "ನಮಸ್ಕಾರ, ಇದು ಪೂರ್ವದರ್ಶನವಾಗಿದೆ.",
  "kannada-male": "ನಮಸ್ಕಾರ, ಇದು ಪೂರ್ವದರ್ಶನವಾಗಿದೆ.",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ voiceId: string }> }
) {
  const { voiceId } = await params;

  if (!/^[a-zA-Z0-9\-_]+$/.test(voiceId)) {
    return Response.json({ error: "Invalid voice ID" }, { status: 400 });
  }

  let previewText = "This is a voice preview.";
  for (const [key, text] of Object.entries(PREVIEW_TEXTS)) {
    if (voiceId.includes(key)) {
      previewText = text;
      break;
    }
  }

  try {
    const upstream = await backendFetch("/v1/tts", {
      method: "POST",
      body: JSON.stringify({
        text: previewText,
        reference_id: voiceId,
        format: "wav",
      }),
      timeoutMs: 110_000,
    });

    if (!upstream.ok || !upstream.body) {
      const errorText = await upstream.text().catch(() => "");
      console.error(`Preview failed for ${voiceId}: ${upstream.status} ${errorText}`);
      return Response.json({ error: "Failed to generate preview" }, { status: 502 });
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "audio/wav",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error generating voice preview:", error);
    return Response.json({ error: "Failed to generate voice preview" }, { status: 502 });
  }
}
