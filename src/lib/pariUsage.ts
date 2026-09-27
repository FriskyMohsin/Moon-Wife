/**
 * Pari AI — per-user usage limits, enforced app-side.
 *
 * BYOK means the user's own Gemini key pays for the API calls; these caps
 * exist so one account cannot burn through unreasonable volume and so the
 * client UI can show a usage meter. The platform owner is exempt.
 *
 * Defaults (policy-overridable later via PARI_USAGE_LIMITS):
 *   chat:        100/day, 500/week
 *   image:       10/day,   50/week
 *   file:        10/day,   50/week
 *   live voice:  30 min/day, 180 min/week
 */
import { Response } from 'express';
import { getUserById } from './hoorviaPlatform';
import { pariLoad, pariSave } from './pariStore';

export const PARI_USAGE_LIMITS = {
  chat: { perDay: 100, perWeek: 500 },
  image: { perDay: 10, perWeek: 50 },
  file: { perDay: 10, perWeek: 50 },
  liveVoiceMinutes: { perDay: 30, perWeek: 180 },
} as const;

export type PariUsageKind = 'chat' | 'image' | 'file' | 'liveVoice';

interface PariUsageRow {
  userId: string;
  dateStr: string; // YYYY-MM-DD (UTC)
  chat: number;
  image: number;
  file: number;
  liveMinutes: number;
  lastActive: string;
}

const STORE_FILE = 'client_usage_detail.json';

function dayStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function loadAll(): PariUsageRow[] {
  return pariLoad<PariUsageRow[]>(STORE_FILE, []);
}

function saveAll(rows: PariUsageRow[]): void {
  pariSave(STORE_FILE, rows);
}

function todayRow(rows: PariUsageRow[], userId: string, create: boolean): PariUsageRow | null {
  const today = dayStr(new Date());
  let row = rows.find((r) => r.userId === userId && r.dateStr === today);
  if (!row && create) {
    row = {
      userId,
      dateStr: today,
      chat: 0,
      image: 0,
      file: 0,
      liveMinutes: 0,
      lastActive: new Date().toISOString(),
    };
    rows.push(row);
  }
  return row || null;
}

function weekRows(rows: PariUsageRow[], userId: string): PariUsageRow[] {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const cutoffStr = dayStr(cutoff);
  return rows.filter((r) => r.userId === userId && r.dateStr >= cutoffStr);
}

export function isPariOwnerExempt(userId: string): boolean {
  try {
    return getUserById(userId)?.role === 'owner';
  } catch {
    return false;
  }
}

/** Record one usage event. */
export function recordPariUsage(userId: string, kind: Exclude<PariUsageKind, 'liveVoice'>, n = 1): void {
  const rows = loadAll();
  const row = todayRow(rows, userId, true)!;
  row[kind] += n;
  row.lastActive = new Date().toISOString();
  saveAll(rows);
}

/** Record live-voice minutes (called when a live session ends). */
export function recordPariLiveMinutes(userId: string, minutes: number): void {
  if (minutes <= 0) return;
  const rows = loadAll();
  const row = todayRow(rows, userId, true)!;
  row.liveMinutes += minutes;
  row.lastActive = new Date().toISOString();
  saveAll(rows);
}

export interface PariUsageCheck {
  ok: boolean;
  scope?: 'daily_limit' | 'weekly_limit';
  resetAt?: string;
  message?: string;
}

function nextUtcMidnightIso(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

function nextWeekResetIso(): string {
  // Weekly window is a rolling 7 days; surface next UTC midnight as the
  // earliest point the rolling count can drop.
  return nextUtcMidnightIso();
}

/**
 * Check whether the user may perform one more event of `kind`.
 * Owner accounts are exempt. Returns ok:false with a plain message
 * and resetAt timestamp when a cap is hit.
 */
export function checkPariUsage(userId: string, kind: PariUsageKind): PariUsageCheck {
  if (isPariOwnerExempt(userId)) return { ok: true };

  const rows = loadAll();
  const today = todayRow(rows, userId, false);
  const limits = PARI_USAGE_LIMITS[kind === 'liveVoice' ? 'liveVoiceMinutes' : kind];
  const field: keyof PariUsageRow = kind === 'liveVoice' ? 'liveMinutes' : kind;

  const todayCount = today ? Number(today[field] || 0) : 0;
  const weekCount = weekRows(rows, userId).reduce((sum, r) => sum + Number(r[field] || 0), 0);

  const unit = kind === 'liveVoice' ? 'minutes of live voice' : `${kind} requests`;
  if (todayCount >= limits.perDay) {
    return {
      ok: false,
      scope: 'daily_limit',
      resetAt: nextUtcMidnightIso(),
      message: `You've reached your daily limit of ${limits.perDay} ${unit}. It resets at midnight (UTC).`,
    };
  }
  if (weekCount >= limits.perWeek) {
    return {
      ok: false,
      scope: 'weekly_limit',
      resetAt: nextWeekResetIso(),
      message: `You've reached your weekly limit of ${limits.perWeek} ${unit}. It resets as older usage rolls off (7-day window).`,
    };
  }
  return { ok: true };
}

/** Summary for the client usage meter: today + rolling week vs limits.
 * Shape: {today:{chat,images,files,liveMinutes}, week:{...}, limits:{...}} */
export function getPariUsageSummary(userId: string) {
  const rows = loadAll();
  const today = todayRow(rows, userId, false);
  const week = weekRows(rows, userId);
  const sum = (f: 'chat' | 'image' | 'file' | 'liveMinutes') =>
    week.reduce((s, r) => s + Number(r[f] || 0), 0);
  const t = (f: 'chat' | 'image' | 'file' | 'liveMinutes') => (today ? Number(today[f] || 0) : 0);

  return {
    today: { chat: t('chat'), images: t('image'), files: t('file'), liveMinutes: t('liveMinutes') },
    week: { chat: sum('chat'), images: sum('image'), files: sum('file'), liveMinutes: sum('liveMinutes') },
    limits: {
      chat: { perDay: PARI_USAGE_LIMITS.chat.perDay, perWeek: PARI_USAGE_LIMITS.chat.perWeek },
      images: { perDay: PARI_USAGE_LIMITS.image.perDay, perWeek: PARI_USAGE_LIMITS.image.perWeek },
      files: { perDay: PARI_USAGE_LIMITS.file.perDay, perWeek: PARI_USAGE_LIMITS.file.perWeek },
      liveMinutes: {
        perDay: PARI_USAGE_LIMITS.liveVoiceMinutes.perDay,
        perWeek: PARI_USAGE_LIMITS.liveVoiceMinutes.perWeek,
      },
    },
    exempt: isPariOwnerExempt(userId),
    resetAtDay: nextUtcMidnightIso(),
  };
}

/** Express helper: answer HTTP 429 in the contract shape, or return true to proceed. */
export function enforcePariUsage(res: Response, userId: string, kind: PariUsageKind): boolean {
  const check = checkPariUsage(userId, kind);
  if (check.ok) return true;
  res.status(429).json({
    error: check.scope,
    message: check.message,
    resetAt: check.resetAt,
  });
  return false;
}
