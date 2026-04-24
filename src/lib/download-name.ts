/**
 * Build a human-readable download filename for a generated audio clip.
 *
 * Shape: `<first-15-chars-of-text-slugified>-YYYYMMDD-HHMMSS.<ext>`
 *
 * Examples:
 *   makeDownloadName("Hello everyone", "wav")
 *     → "hello-everyone-20260423-152045.wav"
 *   makeDownloadName("ధన్యవాదాలు", "wav")
 *     → "ధన్యవాదాలు-20260423-152045.wav"   (Telugu script preserved, safe for disk)
 *   makeDownloadName("", "wav")
 *     → "fish-speech-20260423-152045.wav"
 */
export function makeDownloadName(
  text: string,
  format: string,
  createdAt?: string | Date
): string {
  const when = createdAt ? new Date(createdAt) : new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const stamp =
    when.getFullYear().toString() +
    pad(when.getMonth() + 1) +
    pad(when.getDate()) +
    "-" +
    pad(when.getHours()) +
    pad(when.getMinutes()) +
    pad(when.getSeconds());

  const slug = textSlug(text, 15);
  const prefix = slug || "fish-speech";
  const ext = (format || "wav").toLowerCase();
  return `${prefix}-${stamp}.${ext}`;
}

/**
 * Slugify the first N characters of `text`. Keeps Unicode letters/digits
 * (so Telugu, Hindi, etc. survive intact), replaces every run of other
 * characters with a single hyphen, and trims leading/trailing hyphens.
 * Returns "" for empty input.
 */
function textSlug(text: string, maxChars: number): string {
  const cleaned = (text || "").trim();
  if (!cleaned) return "";
  const head = cleaned.slice(0, maxChars);
  // \p{L} = letter, \p{N} = number (Unicode-aware)
  return head
    .replace(/[\p{P}\p{Z}\p{C}\p{S}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
