/**
 * Pari AI — client tasks. Full CRUD + AI auto-creation from chat.
 *
 * The old create-task path was owner-guarded, so client users could never
 * create tasks — this module is the honest client-side replacement.
 */
import { generateTextWithUserKey, extractJsonPayload, pariLoad, pariSave, pariId } from './pariStore';

export type PariTaskRepeat = 'once' | 'daily' | 'weekly';
export type PariTaskPriority = 'low' | 'med' | 'high';
export type PariTaskStatus = 'pending' | 'done';

export interface ClientTask {
  id: string;
  userId: string;
  title: string;
  detail: string;
  dueAt: string | null; // ISO, resolved to Asia/Riyadh by the extractor
  repeat: PariTaskRepeat;
  priority: PariTaskPriority;
  status: PariTaskStatus;
  source: 'chat' | 'manual' | 'reminder' | 'voice';
  createdAt: string;
  updatedAt: string;
}

const STORE_FILE = 'client_tasks.json';

function loadAll(): ClientTask[] {
  return pariLoad<ClientTask[]>(STORE_FILE, []);
}

function saveAll(tasks: ClientTask[]): void {
  pariSave(STORE_FILE, tasks);
}

export function listClientTasks(userId: string, includeDone = true): ClientTask[] {
  const tasks = loadAll()
    .filter((t) => t.userId === userId)
    .filter((t) => includeDone || t.status !== 'done');
  tasks.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    const ad = a.dueAt || '9999';
    const bd = b.dueAt || '9999';
    if (ad !== bd) return ad < bd ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return tasks;
}

export function createClientTask(
  userId: string,
  input: {
    title: string;
    detail?: string;
    dueAt?: string | null;
    repeat?: PariTaskRepeat;
    priority?: PariTaskPriority;
    source?: ClientTask['source'];
  }
): ClientTask {
  const now = new Date().toISOString();
  const task: ClientTask = {
    id: pariId('task'),
    userId,
    title: input.title.trim().slice(0, 200),
    detail: (input.detail || '').trim().slice(0, 2000),
    dueAt: input.dueAt || null,
    repeat: input.repeat === 'daily' || input.repeat === 'weekly' ? input.repeat : 'once',
    priority: input.priority === 'high' || input.priority === 'low' ? input.priority : 'med',
    status: 'pending',
    source: input.source || 'manual',
    createdAt: now,
    updatedAt: now,
  };
  const tasks = loadAll();
  tasks.push(task);
  saveAll(tasks);
  return task;
}

export function updateClientTask(
  userId: string,
  taskId: string,
  patch: Partial<Pick<ClientTask, 'title' | 'detail' | 'dueAt' | 'repeat' | 'priority' | 'status'>>
): ClientTask | null {
  const tasks = loadAll();
  const task = tasks.find((t) => t.id === taskId && t.userId === userId);
  if (!task) return null;
  if (typeof patch.title === 'string' && patch.title.trim()) task.title = patch.title.trim().slice(0, 200);
  if (typeof patch.detail === 'string') task.detail = patch.detail.trim().slice(0, 2000);
  if (patch.dueAt !== undefined) task.dueAt = patch.dueAt || null;
  if (patch.repeat === 'once' || patch.repeat === 'daily' || patch.repeat === 'weekly') task.repeat = patch.repeat;
  if (patch.priority === 'low' || patch.priority === 'med' || patch.priority === 'high') task.priority = patch.priority;
  if (patch.status === 'pending' || patch.status === 'done') task.status = patch.status;
  task.updatedAt = new Date().toISOString();
  saveAll(tasks);
  return task;
}

export function deleteClientTask(userId: string, taskId: string): boolean {
  const tasks = loadAll();
  const kept = tasks.filter((t) => !(t.id === taskId && t.userId === userId));
  if (kept.length === tasks.length) return false;
  saveAll(kept);
  return true;
}

/**
 * Cheap prefilter: only run the Gemini extraction pass when the message
 * actually looks task-like (English + Roman Urdu/Urdu cues). This keeps the
 * second model call off the hot path for ordinary chat.
 */
const TASK_CUE_REGEX =
  /yaad\s*dila|remind|reminder|task|todo|to-?do|kal|parson|baje|schedule|deadline|\bdue\b|add\s+(kar|it|this)|note\s*kar|list\s*(bana|mein)|tomorrow|next\s+week|every\s+day|roz|hafta/i;

export function looksTaskLike(message: string): boolean {
  return TASK_CUE_REGEX.test(message || '');
}

const TASK_EXTRACT_SYSTEM = `You extract a task/reminder from a user's chat message. The user may write in English, Roman Urdu, or Urdu.

Current time: {NOW_ISO} (Asia/Riyadh, UTC+3).

Return ONE JSON object (or null if there is no real task):
{"title": string, "detail": string, "dueAt": string|null, "repeat": "once"|"daily"|"weekly", "priority": "low"|"med"|"high"}

Rules:
- "title": short action phrase, keep the user's language (Roman Urdu stays Roman Urdu).
- "dueAt": resolve relative times to a full ISO datetime with +03:00 offset. "kal 9 baje" = tomorrow 09:00. "kal subah" = tomorrow 08:00. "aaj shaam 6 baje" = today 18:00. No time given -> null.
- "repeat": "daily" for roz/har din/every day, "weekly" for har hafta/every week, else "once".
- "priority": "high" only if the user stresses urgency (urgent/zaroori/ASAP), "low" for casual nice-to-haves, else "med".
- If the message is just chatting with no actionable task, return null.
- Output ONLY the JSON object or null, no prose, no markdown fences.`;

export interface ExtractedTask {
  title: string;
  detail: string;
  dueAt: string | null;
  repeat: PariTaskRepeat;
  priority: PariTaskPriority;
}

/**
 * Second Gemini pass (user's own key) that turns a task-like message into
 * structured task JSON. Returns null when there is no real task or the
 * pass fails — never throws.
 */
export async function extractTaskFromMessage(
  apiKey: string,
  model: string,
  message: string
): Promise<ExtractedTask | null> {
  try {
    if (!looksTaskLike(message)) return null;
    const nowIso = new Date().toISOString();
    const text = await generateTextWithUserKey(
      apiKey,
      model,
      `User message: ${JSON.stringify(message)}`,
      TASK_EXTRACT_SYSTEM.replace('{NOW_ISO}', nowIso)
    );
    if (!text || text.trim().toLowerCase() === 'null') return null;
    const parsed = extractJsonPayload(text);
    if (!parsed || typeof parsed.title !== 'string' || !parsed.title.trim()) return null;

    let dueAt: string | null = null;
    if (typeof parsed.dueAt === 'string' && parsed.dueAt.trim()) {
      const d = new Date(parsed.dueAt);
      if (!isNaN(d.getTime()) && d.getTime() > Date.now() - 60 * 60 * 1000) {
        dueAt = d.toISOString();
      }
    }
    return {
      title: parsed.title.trim().slice(0, 200),
      detail: typeof parsed.detail === 'string' ? parsed.detail.trim().slice(0, 2000) : '',
      dueAt,
      repeat: parsed.repeat === 'daily' || parsed.repeat === 'weekly' ? parsed.repeat : 'once',
      priority: parsed.priority === 'high' || parsed.priority === 'low' ? parsed.priority : 'med',
    };
  } catch (err) {
    console.warn('[PariAI] task extraction failed:', (err as any)?.message || err);
    return null;
  }
}
