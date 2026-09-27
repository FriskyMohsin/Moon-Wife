/**
 * Pari AI — server-side conversation threads.
 *
 * Fixes the old "memory broken" behavior where the server trusted whatever
 * history the client sent. The server now persists every turn itself
 * (userId-isolated) and builds chat context from this store.
 */
import { pariLoad, pariSave } from './pariStore';

export interface PariThreadMessage {
  role: 'user' | 'model';
  text: string;
  ts: string;
}

export interface PariThread {
  userId: string;
  messages: PariThreadMessage[];
  updatedAt: string;
}

const STORE_FILE = 'client_threads.json';
const MAX_MESSAGES = 50;

function loadAll(): PariThread[] {
  return pariLoad<PariThread[]>(STORE_FILE, []);
}

function saveAll(threads: PariThread[]): void {
  pariSave(STORE_FILE, threads);
}

export function getPariThread(userId: string): PariThread | null {
  return loadAll().find((t) => t.userId === userId) || null;
}

/** Append a turn; thread is capped at MAX_MESSAGES (oldest dropped). */
export function appendPariThreadMessage(userId: string, role: 'user' | 'model', text: string): PariThread {
  const threads = loadAll();
  let thread = threads.find((t) => t.userId === userId);
  if (!thread) {
    thread = { userId, messages: [], updatedAt: new Date().toISOString() };
    threads.push(thread);
  }
  thread.messages.push({ role, text, ts: new Date().toISOString() });
  if (thread.messages.length > MAX_MESSAGES) {
    thread.messages = thread.messages.slice(thread.messages.length - MAX_MESSAGES);
  }
  thread.updatedAt = new Date().toISOString();
  saveAll(threads);
  return thread;
}

/** Last N turns formatted for the Gemini contents array. */
export function getPariThreadHistoryForModel(userId: string, limit = 20): Array<{ role: string; parts: Array<{ text: string }> }> {
  const thread = getPariThread(userId);
  if (!thread) return [];
  return thread.messages.slice(-limit).map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }],
  }));
}

export function clearPariThread(userId: string): void {
  const threads = loadAll().filter((t) => t.userId !== userId);
  saveAll(threads);
}
