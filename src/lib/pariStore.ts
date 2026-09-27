/**
 * Pari AI — shared persistence + AI helpers for the client panel.
 *
 * All client-panel stores live as JSON files under the durable data dir
 * ($MARYAM_DATA_DIR/hoorvia_platform, or <cwd>/data in dev), with atomic
 * writes via dataPersistence. Every row carries userId; all reads filter
 * by it. Never weaken this isolation.
 */
import { GoogleGenAI } from '@google/genai';
import { resolveDataPath } from './runtimePaths';
import { readJsonSafeSync, writeJsonAtomicSync } from './dataPersistence';

/** Load a Pari client store file (array-of-rows JSON) with LKG recovery. */
export function pariLoad<T>(filename: string, fallback: T): T {
  return readJsonSafeSync<T>(resolveDataPath('hoorvia_platform', filename), fallback);
}

/** Atomically persist a Pari client store file. */
export function pariSave<T>(filename: string, data: T): void {
  writeJsonAtomicSync(resolveDataPath('hoorvia_platform', filename), data);
}

/** Short random id with a readable prefix. */
export function pariId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  return `${prefix}_${rand}`;
}

/**
 * Cheap single-shot text generation with the USER's own Gemini key.
 * Returns trimmed text on success, null on any failure (never throws —
 * callers treat null as "skip this enrichment", never as a hard error).
 */
export async function generateTextWithUserKey(
  apiKey: string,
  model: string,
  prompt: string,
  systemInstruction?: string
): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      ...(systemInstruction ? { config: { systemInstruction } } : {}),
    });
    const text = (response.text || '').trim();
    return text.length > 0 ? text : null;
  } catch (err) {
    console.warn('[PariAI] generateTextWithUserKey failed:', (err as any)?.message || err);
    return null;
  }
}

/** Extract the first {...} or [...] JSON payload from a model reply. */
export function extractJsonPayload(text: string): any | null {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, '```').replace(/```/g, '').trim();
  const start = cleaned.search(/[{[]/);
  if (start < 0) return null;
  const sliced = cleaned.slice(start);
  // Try progressively shorter tails to survive trailing prose.
  for (let end = sliced.length; end > start; end--) {
    const ch = sliced[end - 1];
    if (ch !== '}' && ch !== ']') continue;
    try {
      return JSON.parse(sliced.slice(0, end));
    } catch (_) {
      /* keep trimming */
    }
  }
  return null;
}
