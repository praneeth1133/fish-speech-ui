/**
 * localStorage-backed list of "API keys". These keys are decorative — they
 * were never actually enforced by the Fish Speech backend. They're kept so
 * the API Keys page can still demonstrate the API and let users copy a token.
 */

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  created_at: string;
  last_used_at: string | null;
  usage_count: number;
  active: number; // 1 or 0, kept for parity with old SQLite shape
}

const STORAGE_KEY = "fish-speech-api-keys";

function readAll(): ApiKey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(keys: ApiKey[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

function generateKey(): string {
  // 32 random bytes hex-encoded → "fsk_<64-hex>"
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `fsk_${hex}`;
}

function generateId(): string {
  return crypto.randomUUID();
}

export function listApiKeys(): ApiKey[] {
  return readAll();
}

export function createApiKey(name: string): ApiKey {
  const keys = readAll();
  const newKey: ApiKey = {
    id: generateId(),
    name: name.trim(),
    key: generateKey(),
    created_at: new Date().toISOString(),
    last_used_at: null,
    usage_count: 0,
    active: 1,
  };
  keys.unshift(newKey);
  writeAll(keys);
  return newKey;
}

export function revokeApiKey(id: string): void {
  const keys = readAll();
  const next = keys.map((k) => (k.id === id ? { ...k, active: 0 } : k));
  writeAll(next);
}

export function deleteApiKey(id: string): void {
  const keys = readAll();
  writeAll(keys.filter((k) => k.id !== id));
}
