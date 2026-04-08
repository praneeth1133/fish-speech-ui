/**
 * IndexedDB wrapper for client-side TTS history.
 * Replaces the old SQLite + filesystem storage. Audio blobs live directly in
 * IndexedDB so a single store holds metadata + audio data per generation.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "fish-speech-ui";
const DB_VERSION = 1;

export interface HistoryItem {
  id: string;
  text: string;
  voice_id: string | null;
  voice_name: string;
  format: string;
  /** JSON-stringified settings (temperature, top_p, etc.) — kept as string for parity with old API */
  settings: string | null;
  created_at: string;
  blob: Blob;
  /** byte size of the blob, denormalized for cheap totals */
  size: number;
}

interface FishDB extends DBSchema {
  history: {
    key: string;
    value: HistoryItem;
    indexes: { "by-created": string };
  };
}

let dbPromise: Promise<IDBPDatabase<FishDB>> | null = null;

function getDb(): Promise<IDBPDatabase<FishDB>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available in this environment"));
  }
  if (!dbPromise) {
    dbPromise = openDB<FishDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("history")) {
          const store = db.createObjectStore("history", { keyPath: "id" });
          store.createIndex("by-created", "created_at");
        }
      },
    });
  }
  return dbPromise;
}

export async function addHistoryItem(
  item: Omit<HistoryItem, "size">
): Promise<HistoryItem> {
  const db = await getDb();
  const full: HistoryItem = { ...item, size: item.blob.size };
  await db.put("history", full);
  return full;
}

export async function listHistory(limit = 200): Promise<HistoryItem[]> {
  const db = await getDb();
  // Iterate the by-created index in reverse to get newest first.
  const items: HistoryItem[] = [];
  let cursor = await db
    .transaction("history")
    .store.index("by-created")
    .openCursor(null, "prev");
  while (cursor && items.length < limit) {
    items.push(cursor.value);
    cursor = await cursor.continue();
  }
  return items;
}

export async function getHistoryItem(id: string): Promise<HistoryItem | undefined> {
  const db = await getDb();
  return db.get("history", id);
}

export async function deleteHistoryItem(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("history", id);
}

export async function clearHistory(): Promise<void> {
  const db = await getDb();
  await db.clear("history");
}

/**
 * Returns a fresh object URL for the given history item's audio blob. Caller
 * is responsible for revoking it (URL.revokeObjectURL) when done.
 */
export async function getHistoryAudioUrl(id: string): Promise<string | null> {
  const item = await getHistoryItem(id);
  if (!item) return null;
  return URL.createObjectURL(item.blob);
}
