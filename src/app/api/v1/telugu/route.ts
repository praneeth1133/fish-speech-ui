/**
 * GET /api/v1/telugu
 *
 * Machine-readable index for the Telugu API. Link this to partners who want
 * to discover the endpoints and request/response shape without reading docs.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json(
    {
      language: "telugu",
      description: "Fish Speech Telugu Text-to-Speech public API",
      endpoints: {
        listVoices: {
          method: "GET",
          url: `${origin}/api/v1/telugu/voices`,
          description: "Returns all available Telugu voices.",
        },
        generate: {
          method: "POST",
          url: `${origin}/api/v1/telugu/tts`,
          description:
            "Generate Telugu speech. Body: { text, voice?, format?, temperature?, top_p?, max_new_tokens?, chunk_length? }",
          example: {
            curl: `curl -X POST '${origin}/api/v1/telugu/tts' -H 'Content-Type: application/json' -d '{"text":"నమస్కారం. ఇది తెలుగు పరీక్ష.","voice":"telugu-female-3","format":"wav"}' --output telugu.wav`,
          },
          supportedFormats: ["wav", "mp3"],
          supportedExpressionTags: [
            "[CALM]",
            "[EXCITED]",
            "[SAD]",
            "[ANGRY]",
            "[WHISPERING]",
            "[SUSPENSE]",
            "[POSITIVE]",
            "[SHORT PAUSE]",
            "[MEDIUM PAUSE]",
            "[LONG PAUSE]",
          ],
        },
      },
      notes: [
        "All endpoints support CORS with Access-Control-Allow-Origin: *",
        "Max text length is 10000 characters per request",
        "Audio previews available at /api/voice-preview/<voice-id>",
        "Pause tags produce exact silence: SHORT=0.5s, MEDIUM=1.0s, LONG=1.5s",
      ],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
