import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

// Import the canonical tag list so the prompt always matches the picker UI
const ALLOWED_TAGS = [
  // Positive / High Energy
  "HAPPY", "JOYFUL", "EXCITED", "CHEERFUL", "CONFIDENT", "PLAYFULLY",
  // Calm / Soft
  "CALM", "SERENE", "CARING", "ROMANTIC", "GENTLE", "HUSHED TONE",
  // Sad / Melancholic
  "SAD", "MELANCHOLIC", "HEARTBROKEN", "LONELY", "WISTFUL", "RESIGNED TONE",
  // Anger / Irritation
  "ANGRY", "IRRITATED", "FRUSTRATED", "RAGEFUL", "THROUGH GRITTED TEETH",
  // Suspense / Thought
  "SKEPTICAL", "ANXIOUS", "CONFUSED", "CURIOUS", "PENSIVE", "DEADPAN",
  // Volume & Energy
  "WHISPERING", "SOFT", "LOUD", "INTENSE", "ENERGETIC", "LETHARGIC",
  // Reactions
  "laughs", "giggles", "sighs", "gasps", "coughs", "clears throat",
  "exhales", "chuckles", "groans", "hums",
  // Pacing
  "short pause", "medium pause", "long pause", "breath", "slowly", "quickly",
  // Accents
  "American accent", "British accent", "Australian accent", "Indian English",
  "French accent", "German accent",
  // Character & Style
  "pirate voice", "knight voice", "robotic tone", "sci-fi AI voice",
  "childlike tone", "narrator", "conversational tone", "news reporter", "sarcastic",
];

const SYSTEM_PROMPT = `You are an expert voice director for text-to-speech. Annotate scripts with expression tags so the TTS sounds natural, emotional, and engaging — like a professional audiobook narrator.

AVAILABLE TAGS (use ONLY these, exactly as spelled):
${ALLOWED_TAGS.map((t) => `[${t}]`).join(", ")}

RULES:
- Insert tags using [TAG] syntax inline BEFORE the words they modify
- Be generous but natural: use 3-6 tags per paragraph for rich expression
- Place emotion tags BEFORE the phrase: "[EXCITED] I can't believe it!"
- Place reaction tags where they naturally occur: "She said [laughs] that was hilarious"
- Use [short pause], [medium pause], or [long pause] at natural breaks
- Use [breath] before long sentences for realism
- Use accent/character tags at the START of a character's first line if appropriate
- Preserve the original text EXACTLY — only ADD tags, never change, remove, or rephrase words
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
      max_tokens: Math.min(Math.ceil(text.length * 2), 4096),
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
