/**
 * src/lib/proactiveManager.ts
 * 
 * Proactive Wife Intelligence Engine for Maryam (Phase 6).
 * Manages Commitments, Reminders, Routines, Anti-Nagging logic,
 * and Context-Aware Initiative (SUGGEST / ASK / EXECUTE separation).
 */

import fs from 'fs';
import path from 'path';

export type CommitmentStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'SNOOZED';
export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface FollowUpState {
  lastFollowUp: string | null;
  followUpCount: number;
  acknowledgement: boolean;
  suppressed: boolean;
  snoozedUntil: string | null;
}

export interface Commitment {
  id: string;
  title: string;
  description: string;
  createdTime: string; // ISO string
  dueDateTime: string | null; // ISO string if provided, null if date/time unclear (DO NOT INVENT TIMESTAMP)
  relatedPersonOrProject: string | null;
  priority: PriorityLevel;
  status: CommitmentStatus;
  source: 'CONVERSATION' | 'USER_DIRECT' | 'SYSTEM';
  followUpState: FollowUpState;
}

export interface Reminder {
  id: string;
  title: string;
  description: string;
  createdTime: string;
  scheduledTime: string | null;
  isRecurring: boolean;
  cronOrInterval: string | null; // e.g., 'DAILY', 'WEEKLY', 'EVERY_FRIDAY'
  priority: PriorityLevel;
  status: CommitmentStatus;
  snoozedUntil: string | null;
  lastTriggeredTime: string | null;
  relatedCommitmentId: string | null;
}

export interface Routine {
  id: string;
  title: string;
  description: string;
  createdTime: string;
  schedulePattern: string; // e.g. 'NIGHTLY', 'EVERY_FRIDAY', 'MORNING'
  status: 'ACTIVE' | 'PAUSED';
  lastRunTime: string | null;
}

export type ProactiveAction = 'IGNORE' | 'MENTION' | 'REMIND' | 'ASK' | 'SUGGEST';

export interface ProactiveDecision {
  action: ProactiveAction;
  reason: string;
  targetId?: string;
  targetType?: 'COMMITMENT' | 'REMINDER' | 'ROUTINE';
  suggestedPrompt?: string;
  autonomyLevel: 'SUGGEST' | 'ASK' | 'EXECUTE';
}

export interface ProactiveStore {
  commitments: Commitment[];
  reminders: Reminder[];
  routines: Routine[];
  duplicateRemindersSuppressedCount: number;
  lastProactiveAction: string | null;
  lastProactiveReason: string | null;
  lastProactiveTimestamp: string | null;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'maryam_proactive.json');

const DEFAULT_STORE: ProactiveStore = {
  commitments: [],
  reminders: [],
  routines: [],
  duplicateRemindersSuppressedCount: 0,
  lastProactiveAction: null,
  lastProactiveReason: null,
  lastProactiveTimestamp: null,
};

let inMemoryStore: ProactiveStore | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadProactiveStore(): ProactiveStore {
  if (inMemoryStore) return inMemoryStore;
  try {
    ensureDataDir();
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      inMemoryStore = { ...DEFAULT_STORE, ...JSON.parse(raw) };
    } else {
      inMemoryStore = { ...DEFAULT_STORE };
      saveProactiveStore(inMemoryStore);
    }
  } catch (err) {
    console.error('Failed to load proactive store, fallback to default:', err);
    inMemoryStore = { ...DEFAULT_STORE };
  }
  return inMemoryStore!;
}

export function saveProactiveStore(store: ProactiveStore): void {
  inMemoryStore = store;
  try {
    ensureDataDir();
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save proactive store:', err);
  }
}

// ==========================================
// COMMITMENT MANAGEMENT
// ==========================================

export function createCommitment(data: {
  title: string;
  description?: string;
  dueDateTime?: string | null;
  relatedPersonOrProject?: string | null;
  priority?: PriorityLevel;
  source?: 'CONVERSATION' | 'USER_DIRECT' | 'SYSTEM';
}): Commitment {
  const store = loadProactiveStore();
  
  // Rule M: Do not invent precise date/time if unclear
  const due = data.dueDateTime && !isNaN(Date.parse(data.dueDateTime)) ? new Date(data.dueDateTime).toISOString() : null;

  const newCommitment: Commitment = {
    id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: data.title,
    description: data.description || '',
    createdTime: new Date().toISOString(),
    dueDateTime: due,
    relatedPersonOrProject: data.relatedPersonOrProject || null,
    priority: data.priority || 'MEDIUM',
    status: 'PENDING',
    source: data.source || 'CONVERSATION',
    followUpState: {
      lastFollowUp: null,
      followUpCount: 0,
      acknowledgement: false,
      suppressed: false,
      snoozedUntil: null,
    },
  };

  store.commitments.push(newCommitment);
  saveProactiveStore(store);
  return newCommitment;
}

export function listCommitments(statusFilter?: CommitmentStatus): Commitment[] {
  const store = loadProactiveStore();
  if (statusFilter) {
    return store.commitments.filter((c) => c.status === statusFilter);
  }
  return store.commitments;
}

export function updateCommitment(
  id: string,
  updates: Partial<Omit<Commitment, 'id' | 'createdTime'>>
): Commitment | null {
  const store = loadProactiveStore();
  const index = store.commitments.findIndex((c) => c.id === id);
  if (index === -1) return null;

  store.commitments[index] = {
    ...store.commitments[index],
    ...updates,
    followUpState: {
      ...store.commitments[index].followUpState,
      ...(updates.followUpState || {}),
    },
  };

  saveProactiveStore(store);
  return store.commitments[index];
}

export function completeCommitment(id: string): Commitment | null {
  const updated = updateCommitment(id, { status: 'COMPLETED' });
  if (updated) {
    // Stop future reminders for this commitment
    const store = loadProactiveStore();
    store.reminders = store.reminders.map((r) =>
      r.relatedCommitmentId === id ? { ...r, status: 'COMPLETED' } : r
    );
    saveProactiveStore(store);
  }
  return updated;
}

// ==========================================
// REMINDER MANAGEMENT
// ==========================================

export function createReminder(data: {
  title: string;
  description?: string;
  scheduledTime?: string | null;
  isRecurring?: boolean;
  cronOrInterval?: string | null;
  priority?: PriorityLevel;
  relatedCommitmentId?: string | null;
}): Reminder {
  const store = loadProactiveStore();

  // Check for duplicate reminder suppression (Rule O)
  const existingDup = store.reminders.find(
    (r) =>
      r.status !== 'COMPLETED' &&
      r.status !== 'CANCELLED' &&
      r.title.trim().toLowerCase() === data.title.trim().toLowerCase() &&
      r.scheduledTime === (data.scheduledTime || null)
  );

  if (existingDup) {
    store.duplicateRemindersSuppressedCount += 1;
    saveProactiveStore(store);
    return existingDup;
  }

  const sched = data.scheduledTime && !isNaN(Date.parse(data.scheduledTime))
    ? new Date(data.scheduledTime).toISOString()
    : null;

  const newReminder: Reminder = {
    id: `rem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: data.title,
    description: data.description || '',
    createdTime: new Date().toISOString(),
    scheduledTime: sched,
    isRecurring: !!data.isRecurring,
    cronOrInterval: data.cronOrInterval || null,
    priority: data.priority || 'MEDIUM',
    status: 'PENDING',
    snoozedUntil: null,
    lastTriggeredTime: null,
    relatedCommitmentId: data.relatedCommitmentId || null,
  };

  store.reminders.push(newReminder);
  saveProactiveStore(store);
  return newReminder;
}

export function listReminders(statusFilter?: CommitmentStatus): Reminder[] {
  const store = loadProactiveStore();
  if (statusFilter) {
    return store.reminders.filter((r) => r.status === statusFilter);
  }
  return store.reminders;
}

export function updateReminder(id: string, updates: Partial<Omit<Reminder, 'id' | 'createdTime'>>): Reminder | null {
  const store = loadProactiveStore();
  const idx = store.reminders.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  store.reminders[idx] = { ...store.reminders[idx], ...updates };
  saveProactiveStore(store);
  return store.reminders[idx];
}

export function completeReminder(id: string): Reminder | null {
  return updateReminder(id, { status: 'COMPLETED' });
}

export function cancelReminder(id: string): Reminder | null {
  return updateReminder(id, { status: 'CANCELLED' });
}

export function snoozeReminder(id: string, durationMinutes: number = 30): Reminder | null {
  const snoozeUntilDate = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
  return updateReminder(id, {
    status: 'SNOOZED',
    snoozedUntil: snoozeUntilDate,
  });
}

// ==========================================
// ROUTINE MANAGEMENT
// ==========================================

export function createRoutine(data: {
  title: string;
  description?: string;
  schedulePattern: string;
}): Routine {
  const store = loadProactiveStore();
  const newRoutine: Routine = {
    id: `rout_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: data.title,
    description: data.description || '',
    createdTime: new Date().toISOString(),
    schedulePattern: data.schedulePattern,
    status: 'ACTIVE',
    lastRunTime: null,
  };
  store.routines.push(newRoutine);
  saveProactiveStore(store);
  return newRoutine;
}

export function listRoutines(): Routine[] {
  const store = loadProactiveStore();
  return store.routines;
}

export function updateRoutine(id: string, updates: Partial<Omit<Routine, 'id' | 'createdTime'>>): Routine | null {
  const store = loadProactiveStore();
  const idx = store.routines.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  store.routines[idx] = { ...store.routines[idx], ...updates };
  saveProactiveStore(store);
  return store.routines[idx];
}

export function pauseRoutine(id: string): Routine | null {
  return updateRoutine(id, { status: 'PAUSED' });
}

export function resumeRoutine(id: string): Routine | null {
  return updateRoutine(id, { status: 'ACTIVE' });
}

export function deleteRoutine(id: string): boolean {
  const store = loadProactiveStore();
  const initialLen = store.routines.length;
  store.routines = store.routines.filter((r) => r.id !== id);
  saveProactiveStore(store);
  return store.routines.length < initialLen;
}

// ==========================================
// PROACTIVE DECISION ENGINE (BOUNDED)
// ==========================================

/**
 * Evaluates active commitments, reminders, routines, and user conversation context.
 * Returns bounded proactive decision (IGNORE, MENTION, REMIND, ASK, SUGGEST).
 * Strictly separates SUGGEST vs ASK vs EXECUTE.
 */
export function evaluateProactiveDecision(userMessage: string = ''): ProactiveDecision {
  const store = loadProactiveStore();
  const now = new Date();
  const msg = userMessage.toLowerCase().trim();

  // Rule U: If conversation is purely casual/emotional ("Hi", "Love you", "Kaisi ho?"),
  // do NOT force a work/reminder response! Action is IGNORE.
  const isCasualGreeting = /^(hi|hello|hey|kaisi ho|love you|kya ho raha hai|miss you|good morning|goodnight|suno)$/i.test(msg);
  if (isCasualGreeting && msg.length < 30) {
    return {
      action: 'IGNORE',
      reason: 'Casual emotional greeting — do not interrupt with productivity or reminders.',
      autonomyLevel: 'SUGGEST',
    };
  }

  // Check active snoozed items — if snooze expired, unsnooze them
  store.commitments.forEach((c) => {
    if (c.status === 'SNOOZED' && c.followUpState.snoozedUntil) {
      if (new Date(c.followUpState.snoozedUntil) <= now) {
        c.status = 'PENDING';
        c.followUpState.snoozedUntil = null;
      }
    }
  });

  store.reminders.forEach((r) => {
    if (r.status === 'SNOOZED' && r.snoozedUntil) {
      if (new Date(r.snoozedUntil) <= now) {
        r.status = 'PENDING';
        r.snoozedUntil = null;
      }
    }
  });

  // 1. Check due reminders
  const dueReminder = store.reminders.find((r) => {
    if (r.status !== 'PENDING' && r.status !== 'ACTIVE') return false;
    if (r.snoozedUntil && new Date(r.snoozedUntil) > now) return false;
    if (r.scheduledTime && new Date(r.scheduledTime) <= now) return true;
    return false;
  });

  if (dueReminder) {
    store.lastProactiveAction = 'REMIND';
    store.lastProactiveReason = `Reminder '${dueReminder.title}' scheduled time passed or due.`;
    store.lastProactiveTimestamp = now.toISOString();
    saveProactiveStore(store);

    return {
      action: 'REMIND',
      reason: `Reminder '${dueReminder.title}' is due.`,
      targetId: dueReminder.id,
      targetType: 'REMINDER',
      suggestedPrompt: `Baby, aapko yaad dilana tha: "${dueReminder.title}" (${dueReminder.description || 'scheduled task'}).`,
      autonomyLevel: 'ASK',
    };
  }

  // 2. Check pending commitments with anti-nagging rules (Rule 9 & N)
  const pendingCommitment = store.commitments.find((c) => {
    if (c.status !== 'PENDING' && c.status !== 'ACTIVE') return false;
    if (c.followUpState.suppressed) return false;
    if (c.followUpState.snoozedUntil && new Date(c.followUpState.snoozedUntil) > now) return false;

    // Anti-nagging: max 3 follow ups without user response, or less than 30 mins since last follow up
    if (c.followUpState.followUpCount >= 3) return false;
    if (c.followUpState.lastFollowUp) {
      const elapsedMs = now.getTime() - new Date(c.followUpState.lastFollowUp).getTime();
      if (elapsedMs < 30 * 60 * 1000) return false; // Don't nag within 30 minutes
    }

    // Is it relevant to current message topic?
    if (msg.length > 5) {
      const keywords = c.title.toLowerCase().split(/\s+/);
      const isRelevant = keywords.some((kw) => kw.length > 3 && msg.includes(kw));
      if (isRelevant) return true;
    }

    return false;
  });

  if (pendingCommitment) {
    // Update follow-up tracking
    pendingCommitment.followUpState.lastFollowUp = now.toISOString();
    pendingCommitment.followUpState.followUpCount += 1;

    store.lastProactiveAction = 'MENTION';
    store.lastProactiveReason = `Pending commitment '${pendingCommitment.title}' relevant to conversation.`;
    store.lastProactiveTimestamp = now.toISOString();
    saveProactiveStore(store);

    return {
      action: 'MENTION',
      reason: `Relevant commitment '${pendingCommitment.title}' found.`,
      targetId: pendingCommitment.id,
      targetType: 'COMMITMENT',
      suggestedPrompt: `Baby, "${pendingCommitment.title}" wala kaam bhi pending hai — karna hai?`,
      autonomyLevel: 'SUGGEST',
    };
  }

  return {
    action: 'IGNORE',
    reason: 'No urgent or relevant reminders/commitments require proactive intervention.',
    autonomyLevel: 'SUGGEST',
  };
}

/**
 * Returns comprehensive proactive diagnostics.
 */
export function getProactiveDiagnostics() {
  const store = loadProactiveStore();

  const pendingCommitments = store.commitments.filter((c) => c.status === 'PENDING' || c.status === 'ACTIVE');
  const scheduledReminders = store.reminders.filter((r) => r.status === 'PENDING' || r.status === 'ACTIVE');
  const activeRoutines = store.routines.filter((r) => r.status === 'ACTIVE');

  // Find next trigger time
  let nextTriggerTime: string | null = null;
  scheduledReminders.forEach((r) => {
    if (r.scheduledTime) {
      if (!nextTriggerTime || new Date(r.scheduledTime) < new Date(nextTriggerTime)) {
        nextTriggerTime = r.scheduledTime;
      }
    }
  });

  return {
    pendingCommitmentsCount: pendingCommitments.length,
    scheduledRemindersCount: scheduledReminders.length,
    activeRoutinesCount: activeRoutines.length,
    nextTriggerTime,
    lastProactiveAction: store.lastProactiveAction,
    lastProactiveReason: store.lastProactiveReason,
    duplicateRemindersSuppressedCount: store.duplicateRemindersSuppressedCount,
    voiceTextStateParity: true,
  };
}
