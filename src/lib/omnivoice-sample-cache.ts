/**
 * Lightweight per-preset sample-audio cache for the OmniVoice page.
 *
 * Samples are small (~60-90 KB WAV each at 24 kHz) and we never want to pay
 * the $0.40/hr T4 cost twice for the same preview. We persist them in a
 * dedicated IDB object store so the cache survives page reloads but never
 * bleeds into the main TTS history DB.
 *
 * The sample we generate per preset is always the same short phrase — this
 * keeps cached blobs predictable and lets us reuse them if the user
 * revisits the page days later.
 */
import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "omnivoice-samples";
const DB_VERSION = 1;
const STORE = "samples";

/** Canonical sample sentence. Short enough to synthesize in <6 seconds. */
export const SAMPLE_PHRASE =
  "Hello, this is OmniVoice. I can speak in over six hundred languages with natural, expressive voices.";

let dbPromise: Promise<IDBPDatabase> | null = null;
function getDb(): Promise<IDBPDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

export async function getCachedSample(presetId: string): Promise<Blob | null> {
  try {
    const db = await getDb();
    const hit = await db.get(STORE, presetId);
    return hit instanceof Blob ? hit : null;
  } catch {
    return null;
  }
}

export async function setCachedSample(presetId: string, blob: Blob): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE, blob, presetId);
  } catch {
    // Cache failures are non-fatal — the sample will just regenerate next time.
  }
}

export async function clearSampleCache(): Promise<void> {
  try {
    const db = await getDb();
    await db.clear(STORE);
  } catch {
    /* ignore */
  }
}
