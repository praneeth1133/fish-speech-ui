import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

/**
 * POST /api/identify-characters
 *
 * Takes a script/dialogue and returns a structured breakdown:
 * - A list of distinct characters
 * - A segment-by-segment script with each line attributed to a character
 *
 * The segments preserve reading order. The `narrator` character is used for
 * any non-dialogue prose ("She smiled", "The sun set over the mountains",
 * etc.). If the script has no narration, the narrator won't appear in the
 * characters list.
 */

const SYSTEM_PROMPT = `You are a script parser for a multi-voice text-to-speech system. Given a script or piece of dialogue, identify the distinct characters and split the text into ordered segments, each attributed to one character.

RULES:
- Use the character name exactly as it appears. If the script uses nicknames, keep them consistent.
- For non-dialogue prose (narration, stage direction, descriptions), use the character name "Narrator".
- Split on natural speaker turns. Each segment should be one contiguous piece of text from one character.
- Preserve the ORIGINAL text verbatim inside each segment. Do not paraphrase, summarize, or alter wording.
- Strip speaker prefixes from segment text (e.g. remove "Alice:" from "Alice: Hello" — the character field already carries that info).
- If the script is a single paragraph with no dialogue at all, return ONE segment with character "Narrator".
- Preserve any existing expression tags like [excited], [whispers], [pause] in the segment text.

Respond ONLY with a JSON object matching this exact schema:
{
  "characters": [{ "name": "string", "description": "short description of speaking style or role" }],
  "segments": [{ "character": "string", "text": "string" }]
}

No markdown fences. No explanations. Just raw JSON.`;

interface IdentifyResponse {
  characters: { name: string; description: string }[];
  segments: { character: string; text: string }[];
}

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
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: Math.min(Math.ceil(text.length * 2) + 500, 4096),
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Parse this script:\n\n${text}`,
        },
      ],
    });

    const raw = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (!raw) {
      return Response.json(
        { error: "AI returned empty result" },
        { status: 502 }
      );
    }

    // Strip any accidental markdown fences
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: IdentifyResponse;
    try {
      parsed = JSON.parse(cleaned) as IdentifyResponse;
    } catch (err) {
      console.error("Failed to parse AI JSON:", cleaned.slice(0, 500), err);
      return Response.json(
        { error: "AI returned malformed JSON. Try again." },
        { status: 502 }
      );
    }

    // Sanity check the shape
    if (
      !Array.isArray(parsed.characters) ||
      !Array.isArray(parsed.segments) ||
      parsed.segments.length === 0
    ) {
      return Response.json(
        { error: "AI response missing characters or segments" },
        { status: 502 }
      );
    }

    // Normalize: deduplicate characters, trim whitespace, drop empty segments
    const seen = new Set<string>();
    const characters: { name: string; description: string }[] = [];
    for (const c of parsed.characters) {
      if (!c?.name || typeof c.name !== "string") continue;
      const name = c.name.trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      characters.push({
        name,
        description:
          (typeof c.description === "string" && c.description.trim()) ||
          "",
      });
    }

    const segments: { character: string; text: string }[] = [];
    for (const s of parsed.segments) {
      if (!s?.character || !s?.text) continue;
      const ch = String(s.character).trim();
      const t = String(s.text).trim();
      if (!ch || !t) continue;
      segments.push({ character: ch, text: t });
    }

    // Ensure every segment's character is in the characters list
    for (const seg of segments) {
      if (!seen.has(seg.character.toLowerCase())) {
        seen.add(seg.character.toLowerCase());
        characters.push({ name: seg.character, description: "" });
      }
    }

    if (segments.length === 0) {
      return Response.json(
        { error: "No segments produced by AI" },
        { status: 502 }
      );
    }

    return Response.json({ characters, segments });
  } catch (err) {
    console.error("identify-characters error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to identify characters";
    return Response.json({ error: message }, { status: 502 });
  }
}
