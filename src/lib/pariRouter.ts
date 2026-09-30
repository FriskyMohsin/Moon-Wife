/**
 * Pari AI — per-model BYOK key store + model router.
 *
 * A user can store a different Gemini API key per model
 * (e.g. a separate key for image-capable models). Raw keys are NEVER
 * returned — listings expose only masked keys. The router picks the key
 * registered for the requested model and falls back to the user's default
 * Gemini key; the existing failover logic in
 * executeHoorviaUserChatWithFailover is left intact.
 */
import {
  encryptCredential,
  decryptCredential,
  createMaskedKey,
  createKeyFingerprint,
  getUserGeminiModelAndKey,
} from './hoorviaPlatform';
import { pariLoad, pariSave } from './pariStore';

export interface ModelKeyRecord {
  userId: string;
  model: string;
  encryptedKey: string;
  iv: string;
  tag: string;
  keyMask: string;
  fingerprint: string;
  cryptoVersion?: string;
  algorithm?: string;
  masterKeyFingerprint?: string;
  updatedAt: string;
}

const STORE_FILE = 'client_model_keys.json';

function loadAll(): ModelKeyRecord[] {
  return pariLoad<ModelKeyRecord[]>(STORE_FILE, []);
}

function saveAll(records: ModelKeyRecord[]): void {
  pariSave(STORE_FILE, records);
}

/** Masked listing only — raw keys never leave this module.
 * Shape: {model, maskedKey, fingerprint, updatedAt} (frontend reads `maskedKey`). */
export function listModelKeys(userId: string): Array<{
  model: string;
  maskedKey: string;
  fingerprint: string;
  updatedAt: string;
}> {
  return loadAll()
    .filter((r) => r.userId === userId)
    .map((r) => ({
      model: r.model,
      maskedKey: r.keyMask,
      fingerprint: r.fingerprint,
      updatedAt: r.updatedAt,
    }));
}

export function saveModelKey(
  userId: string,
  model: string,
  plaintextKey: string
): { success: boolean; maskedKey?: string; error?: string } {
  const cleanModel = (model || '').trim().slice(0, 120);
  if (!cleanModel) return { success: false, error: 'Model name is required.' };
  const cleanKey = (plaintextKey || '').trim().replace(/^["']|["']$/g, '').trim();
  if (cleanKey.length < 15) return { success: false, error: 'Invalid API key format. Minimum length required.' };

  const { encryptedKey, iv, tag, cryptoVersion, algorithm, masterKeyFingerprint } = encryptCredential(cleanKey, userId);
  const maskedKey = createMaskedKey(cleanKey);
  const fingerprint = createKeyFingerprint(cleanKey);

  const all = loadAll();
  const idx = all.findIndex((r) => r.userId === userId && r.model === cleanModel);
  const record: ModelKeyRecord = {
    userId,
    model: cleanModel,
    encryptedKey,
    iv,
    tag,
    keyMask: maskedKey,
    fingerprint,
    cryptoVersion,
    algorithm,
    masterKeyFingerprint,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  saveAll(all);
  return { success: true, maskedKey };
}

export function deleteModelKey(userId: string, model: string): boolean {
  const all = loadAll();
  const kept = all.filter((r) => !(r.userId === userId && r.model === model));
  if (kept.length === all.length) return false;
  saveAll(kept);
  return true;
}

function decryptRecord(record: ModelKeyRecord): string | null {
  try {
    return decryptCredential(record.encryptedKey, record.iv, record.tag, record.userId, record.masterKeyFingerprint);
  } catch (err) {
    console.warn('[PariAI] per-model key decrypt failed:', (err as any)?.message || err);
    return null;
  }
}

export interface ResolvedModelKey {
  apiKey: string;
  model: string;
  source: 'per_model' | 'default';
}

/**
 * Resolve which key+model to use for a request.
 * 1. If the user stored a key for the requested model -> use it (decrypted).
 * 2. Else fall back to the user's default Gemini key; if a model was
 *    requested, it is still honored with the default key.
 * Returns null only when the user has no usable key at all.
 */
export function resolveModelKeyForUser(userId: string, requestedModel?: string): ResolvedModelKey | null {
  const cleanRequested = (requestedModel || '').trim() || undefined;

  if (cleanRequested) {
    const record = loadAll().find((r) => r.userId === userId && r.model === cleanRequested);
    if (record) {
      const key = decryptRecord(record);
      if (key) return { apiKey: key, model: cleanRequested, source: 'per_model' };
      // Decrypt failed -> fall through to default key with requested model.
    }
  } else {
    // No specific model requested: use the user's first decryptable per-model key.
    // (Previously per-model keys were skipped entirely here, making keys saved
    // via Provider Settings invisible to Live Voice / Studio / voice tools.)
    const ownRecords = loadAll().filter((r) => r.userId === userId);
    for (const record of ownRecords) {
      const key = decryptRecord(record);
      if (key) return { apiKey: key, model: record.model, source: 'per_model' };
    }
  }

  const fallback = getUserGeminiModelAndKey(userId);
  if (!fallback) return null;
  return {
    apiKey: fallback.apiKey,
    model: cleanRequested || fallback.model,
    source: 'default',
  };
}
