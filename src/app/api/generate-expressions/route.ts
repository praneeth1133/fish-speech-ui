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

// Subset that Indic Parler-TTS can render cleanly.  Reaction tags ([laughs],
// [sighs]) and accent/character tags are dropped because Parler either
// ignores them or mispronounces them as speech.  See
// fish-speech/tools/server/engines/expression_translator.py for the mapping.
const PARLER_SAFE_TAGS = [
  // Emotion
  "HAPPY", "JOYFUL", "EXCITED", "CHEERFUL", "CONFIDENT", "PLAYFULLY",
  "CALM", "SERENE", "CARING", "ROMANTIC", "GENTLE", "HUSHED TONE", "SOFT",
  "SAD", "MELANCHOLIC", "HEARTBROKEN", "LONELY", "WISTFUL", "RESIGNED TONE",
  "ANGRY", "IRRITATED", "FRUSTRATED", "RAGEFUL", "THROUGH GRITTED TEETH",
  "SKEPTICAL", "ANXIOUS", "CONFUSED", "CURIOUS", "PENSIVE", "DEADPAN",
  // Volume / pace
  "WHISPERING", "LOUD", "INTENSE", "ENERGETIC", "LETHARGIC",
  "slowly", "quickly",
  // Pauses (handled by backend, engine-agnostic)
  "short pause", "medium pause", "long pause",
];

function buildSystemPrompt(engine: "fish-speech" | "indic-parler"): string {
  const tags = engine === "indic-parler" ? PARLER_SAFE_TAGS : ALLOWED_TAGS;
  const extraRule =
    engine === "indic-parler"
      ? "- This script will be rendered by Indic Parler-TTS (Telugu). Only use the tags listed above — reaction/accent tags (like [laughs], [British accent], [pirate voice]) will be silently dropped by the Telugu engine.\n"
      : "- Use accent/character tags at the START of a character's first line if appropriate\n- Place reaction tags where they naturally occur: \"She said [laughs] that was hilarious\"\n- Use [breath] before long sentences for realism\n";
  return `You are an expert voice director for text-to-speech. Annotate scripts with expression tags so the TTS sounds natural, emotional, and engaging — like a professional audiobook narrator.

AVAILABLE TAGS (use ONLY these, exactly as spelled):
${tags.map((t) => `[${t}]`).join(", ")}

RULES:
- Insert tags using [TAG] syntax inline BEFORE the words they modify
- Be generous but natural: use 3-6 tags per paragraph for rich expression
- Place emotion tags BEFORE the phrase: "[EXCITED] I can't believe it!"
- Use [short pause], [medium pause], or [long pause] at natural breaks
${extraRule}- Preserve the original text EXACTLY — only ADD tags, never change, remove, or rephrase words
- Return ONLY the annotated text. No explanations, no markdown, no commentary.`;
}

/**
 * POST /api/generate-expressions
 * Takes raw text, calls Claude Haiku to annotate it with Fish Speech
 * expression tags, returns the annotated text.
 */
export async function POST(request: Request) {
  let body: { text?: unknown; engine?: unknown };
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

  const engine: "fish-speech" | "indic-parler" =
    body.engine === "indic-parler" ? "indic-parler" : "fish-speech";

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
      model: "claude-haiku-4-5",
      max_tokens: Math.min(Math.ceil(text.length * 2), 4096),
      system: buildSystemPrompt(engine),
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
