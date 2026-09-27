/**
 * Pari AI — persistent reminder scheduler.
 *
 * Fixes "scheduling doesn't run": a 30s tick (registered in server.ts
 * alongside the existing task scheduler) scans the persisted reminder
 * store. No in-memory-only state — everything lives in
 * client_reminders.json, so reminders survive restarts. On boot, overdue
 * one-time reminders fire immediately (catch-up) instead of being dropped.
 *
 * Delivery is BOTH:
 *   (a) Web Push, when the user has a push subscription, and
 *   (b) a proactive message inserted into the user's persisted chat thread,
 *       so the reminder appears inside the conversation.
 */
import { pariLoad, pariSave, pariId } from './pariStore';
import { appendPariThreadMessage } from './pariThreads';
import { sendPushToUser } from './pariPush';

export type PariReminderRepeat = 'once' | 'daily' | 'weekly';
export type PariReminderStatus = 'pending' | 'done';

export interface ClientReminder {
  id: string;
  userId: string;
  text: string;
  dueAt: string; // ISO
  repeat: PariReminderRepeat;
  status: PariReminderStatus;
  createdAt: string;
  lastFiredAt: string | null;
}

const STORE_FILE = 'client_reminders.json';

function loadAll(): ClientReminder[] {
  return pariLoad<ClientReminder[]>(STORE_FILE, []);
}

function saveAll(reminders: ClientReminder[]): void {
  pariSave(STORE_FILE, reminders);
}

export function listClientReminders(userId: string, includeDone = false): ClientReminder[] {
  const list = loadAll()
    .filter((r) => r.userId === userId)
    .filter((r) => includeDone || r.status === 'pending');
  list.sort((a, b) => (a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0));
  return list;
}

export function createClientReminder(
  userId: string,
  input: { text: string; dueAt: string; repeat?: PariReminderRepeat }
): ClientReminder {
  const due = new Date(input.dueAt);
  if (isNaN(due.getTime())) throw new Error('Invalid dueAt.');
  const now = new Date().toISOString();
  const reminder: ClientReminder = {
    id: pariId('rem'),
    userId,
    text: input.text.trim().slice(0, 500),
    dueAt: due.toISOString(),
    repeat: input.repeat === 'daily' || input.repeat === 'weekly' ? input.repeat : 'once',
    status: 'pending',
    createdAt: now,
    lastFiredAt: null,
  };
  const all = loadAll();
  all.push(reminder);
  saveAll(all);
  return reminder;
}

export function updateClientReminder(
  userId: string,
  reminderId: string,
  patch: Partial<Pick<ClientReminder, 'text' | 'dueAt' | 'repeat' | 'status'>>
): ClientReminder | null {
  const all = loadAll();
  const r = all.find((x) => x.id === reminderId && x.userId === userId);
  if (!r) return null;
  if (typeof patch.text === 'string' && patch.text.trim()) r.text = patch.text.trim().slice(0, 500);
  if (typeof patch.dueAt === 'string') {
    const d = new Date(patch.dueAt);
    if (!isNaN(d.getTime())) r.dueAt = d.toISOString();
  }
  if (patch.repeat === 'once' || patch.repeat === 'daily' || patch.repeat === 'weekly') r.repeat = patch.repeat;
  if (patch.status === 'pending' || patch.status === 'done') r.status = patch.status;
  saveAll(all);
  return r;
}

export function deleteClientReminder(userId: string, reminderId: string): boolean {
  const all = loadAll();
  const kept = all.filter((x) => !(x.id === reminderId && x.userId === userId));
  if (kept.length === all.length) return false;
  saveAll(kept);
  return true;
}

function advanceForRepeat(dueAt: string, repeat: PariReminderRepeat): string {
  const stepMs = repeat === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  let next = new Date(dueAt).getTime() + stepMs;
  const now = Date.now();
  // If the server was down for a while, skip missed occurrences forward.
  while (next <= now) next += stepMs;
  return new Date(next).toISOString();
}

async function deliverReminder(reminder: ClientReminder): Promise<void> {
  const body = reminder.text;

  // (a) Web Push, best effort.
  try {
    await sendPushToUser(reminder.userId, {
      title: 'Pari AI — Reminder',
      body,
      url: '/chat',
      tag: `pari-reminder-${reminder.id}`,
    });
  } catch (err) {
    console.warn('[PariAI] reminder push failed:', (err as any)?.message || err);
  }

  // (b) Proactive message in the persisted thread (shows up in chat).
  try {
    appendPariThreadMessage(reminder.userId, 'model', `⏰ Reminder: ${body}`);
  } catch (err) {
    console.warn('[PariAI] reminder thread insert failed:', (err as any)?.message || err);
  }
}

let schedulerStarted = false;
let tickRunning = false;

async function schedulerTick(): Promise<void> {
  if (tickRunning) return;
  tickRunning = true;
  try {
    const all = loadAll();
    const now = Date.now();
    let changed = false;

    for (const r of all) {
      if (r.status !== 'pending') continue;
      if (new Date(r.dueAt).getTime() > now) continue;

      // Due (or overdue — boot catch-up fires these immediately).
      await deliverReminder(r);
      r.lastFiredAt = new Date().toISOString();
      if (r.repeat === 'once') {
        r.status = 'done';
      } else {
        r.dueAt = advanceForRepeat(r.dueAt, r.repeat);
      }
      changed = true;
      console.log(`[PariAI] Fired reminder ${r.id} for user ${r.userId} (repeat=${r.repeat}).`);
    }

    if (changed) saveAll(all);
  } catch (err) {
    console.error('[PariAI] scheduler tick failed:', (err as any)?.message || err);
  } finally {
    tickRunning = false;
  }
}

/**
 * Start the 30s reminder tick. Idempotent — safe to call once from server.ts.
 * The first tick runs immediately so overdue reminders catch up on boot.
 */
export function startPariReminderScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  console.log('[PariAI] Reminder scheduler started (30s tick, persisted store).');
  void schedulerTick();
  setInterval(() => {
    void schedulerTick();
  }, 30_000);
}
