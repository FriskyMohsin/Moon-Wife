/**
 * Pari AI — durable memory extraction via the user's own Gemini key.
 *
 * Replaces the old English-only keyword sniffer ("i like", "my favorite",
 * ...) which silently dropped every Roman Urdu / Urdu / non-English fact.
 * This pass is multilingual by construction: the extraction prompt tells
 * the model to catch facts in ANY language the user writes in.
 *
 * Fire-and-forget by design: it enriches the memory store, never blocks
 * the reply. Failures return [] and are logged, never surfaced.
 */
import { generateTextWithUserKey, extractJsonPayload } from './pariStore';
import {
  getUserCompanionMemories,
  addUserCompanionMemory,
} from './hoorviaPlatform';

export interface ExtractedMemoryFact {
  fact: string;
  category: 'preference' | 'personal' | 'goal' | 'relationship' | 'general';
}

const VALID_CATEGORIES = ['preference', 'personal', 'goal', 'relationship', 'general'] as const;

const EXTRACTION_SYSTEM = `You extract durable personal facts about a user from a single chat message, in ANY language (English, Roman Urdu, Urdu, etc.).

Return a JSON array of objects: [{"fact": string, "category": "preference"|"personal"|"goal"|"relationship"|"general"}].

Rules:
- Only extract facts the user would want remembered long-term: name/nickname, family members, job/role, likes/dislikes, hobbies, goals, plans, health notes, pets, important dates.
- Write each fact as a short self-contained sentence in the user's own language (keep Roman Urdu as Roman Urdu).
- "category": preference = likes/dislikes/favorites; personal = identity/family/job; goal = aims/plans; relationship = how they relate to the companion; general = anything else durable.
- If the message contains no durable personal fact, return [].
- Output ONLY the JSON array, no prose, no markdown fences.`;

/**
 * Run the extraction pass for one user turn. Returns the stored facts
 * (after dedupe); never throws.
 */
export async function extractAndStoreMemories(
  apiKey: string,
  model: string,
  userId: string,
  companionId: string,
  userName: string,
  message: string
): Promise<ExtractedMemoryFact[]> {
  try {
    const msg = (message || '').trim();
    if (msg.length < 8) return [];

    const text = await generateTextWithUserKey(
      apiKey,
      model,
      `User "${userName}" said: ${JSON.stringify(msg)}\n\nExtract durable personal facts.`,
      EXTRACTION_SYSTEM
    );
    if (!text) return [];

    const parsed = extractJsonPayload(text);
    const items = Array.isArray(parsed) ? parsed : [];
    const facts: ExtractedMemoryFact[] = [];
    for (const it of items) {
      const fact = typeof it?.fact === 'string' ? it.fact.trim().slice(0, 300) : '';
      const category = VALID_CATEGORIES.includes(it?.category) ? it.category : 'general';
      if (fact.length >= 4) facts.push({ fact, category });
    }
    if (facts.length === 0) return [];

    // Dedupe against what's already stored (case-insensitive substring).
    const existing = getUserCompanionMemories(userId, companionId).map((m) =>
      (m.fact || '').toLowerCase()
    );
    const stored: ExtractedMemoryFact[] = [];
    for (const f of facts) {
      const lower = f.fact.toLowerCase();
      const dup = existing.some((e) => e.includes(lower) || lower.includes(e));
      if (dup) continue;
      addUserCompanionMemory(userId, companionId, f.fact, f.category);
      existing.push(lower);
      stored.push(f);
    }
    return stored;
  } catch (err) {
    console.warn('[PariAI] memory extraction failed:', (err as any)?.message || err);
    return [];
  }
}
