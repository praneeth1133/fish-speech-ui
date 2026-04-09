import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

const ALLOWED_TAGS = [
  "happy", "sad", "angry", "excited", "surprised", "nervous", "serious",
  "calm", "cheerful", "sarcastic", "confused", "scared", "whispers",
  "shouts", "slowly", "quickly", "softly", "loudly", "singing", "dramatic",
  "laughs", "giggles", "sighs", "gasps", "coughs", "clears throat",
  "exhales", "chuckles", "groans", "hums", "pause", "long pause", "breath",
];

const SYSTEM_PROMPT = `You are an expert voice director for text-to-speech. Annotate scripts with expression tags so the TTS sounds natural, emotional, and engaging — like a professional audiobook.

RULES:
- Insert tags using [tag] syntax inline BEFORE the words they modify
- ONLY use these tags: ${ALLOWED_TAGS.map((t) => `[${t}]`).join(", ")}
- Be selective and natural: use 2-4 tags per paragraph. Not every sentence needs one.
- Place emotion/delivery tags BEFORE the phrase they affect: "[excited] I can't believe it!"
- Place reaction tags where they naturally occur: "She said [laughs] that was hilarious"
- Use [pause] or [breath] at natural dramatic breaks
- Preserve the original text EXACTLY — only ADD tags, never change, remove, or rephrase any words
- Return ONLY the annotated text. No explanations, no markdown, no commentary.`;

/**
 * POST /api/generate-expressions
 * Takes raw text, calls Claude Haiku to annotate it with Fish Speech
 * expression tags, returns the annotated text.
 */
export async function POST(request: Request) {
  let body: { text?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = body.text;
  if (typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "Text is required" }, { status: 400 });
  }
  if (text.length > 10_000) {
    return Response.json(
      { error: "Text too long (max 10,000 characters)" },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server" },
      { status: 500 }
    );
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: Math.min(Math.ceil(text.length * 1.5), 4096),
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Annotate this script with expression tags:\n\n${text}`,
        },
      ],
    });

    const annotatedText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (!annotatedText.trim()) {
      return Response.json(
        { error: "AI returned empty result" },
        { status: 502 }
      );
    }

    return Response.json({ annotatedText });
  } catch (err) {
    console.error("Expression generation error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate expressions";
    return Response.json({ error: message }, { status: 502 });
  }
}
