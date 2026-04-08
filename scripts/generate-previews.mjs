#!/usr/bin/env node
/**
 * One-time batch job: pre-generate voice preview MP3s for every reference
 * voice the Fish Speech backend knows about. Writes the results to
 * public/previews/<voice-id>.mp3 so Vercel's CDN can serve them instantly.
 *
 * Usage (from fish-speech-ui/):
 *   FISH_SPEECH_API_URL=http://localhost:8080 \
 *   FISH_SPEECH_API_KEY=... \
 *   node scripts/generate-previews.mjs
 *
 * Only voices with a missing preview file are generated, so the script is
 * safe to re-run after adding new voices.
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outDir = join(__dirname, "..", "public", "previews");

const FISH_API_URL = process.env.FISH_SPEECH_API_URL || "http://localhost:8080";
const FISH_API_KEY = process.env.FISH_SPEECH_API_KEY || "";

const PREVIEW_TEXTS = {
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

function previewTextFor(voiceId) {
  for (const [key, text] of Object.entries(PREVIEW_TEXTS)) {
    if (voiceId.includes(key)) return text;
  }
  return "This is a voice preview.";
}

function authHeaders(extra = {}) {
  const h = { ...extra };
  if (FISH_API_KEY) h.Authorization = `Bearer ${FISH_API_KEY}`;
  return h;
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function listReferences() {
  const res = await fetch(`${FISH_API_URL}/v1/references/list`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to list references: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const { unpack } = await import("msgpackr");
  const data = unpack(buf);
  return data.reference_ids || [];
}

async function generateOne(voiceId) {
  const text = previewTextFor(voiceId);
  const res = await fetch(`${FISH_API_URL}/v1/tts`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      text,
      reference_id: voiceId,
      format: "wav",
      max_new_tokens: 400,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TTS failed ${res.status}: ${body.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

async function main() {
  await mkdir(outDir, { recursive: true });

  console.log(`Listing reference voices from ${FISH_API_URL}...`);
  const ids = await listReferences();
  console.log(`Found ${ids.length} voices`);

  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const id of ids) {
    const outPath = join(outDir, `${id}.wav`);
    if (await fileExists(outPath)) {
      skipped++;
      continue;
    }
    const idx = done + failed + skipped + 1;
    process.stdout.write(`[${idx}/${ids.length}] ${id}... `);
    const t0 = Date.now();
    try {
      const buf = await generateOne(id);
      await writeFile(outPath, buf);
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`ok (${(buf.length / 1024).toFixed(0)}KB, ${secs}s)`);
      done++;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log(
    `\nDone. Generated ${done}, skipped ${skipped} (already existed), failed ${failed}.`
  );
  console.log(`Output: ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
