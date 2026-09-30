/**
 * Pari AI — server-side browser automation engine (Phase 2).
 *
 * One isolated Playwright browser context per user, lazily created.
 * Pure module: no Express, no routes. Callers (chat tool-calling) code
 * against the API contract exported here.
 *
 * Isolation model: sessions live in a single Map keyed ONLY by userId.
 * There is no way to enumerate or cross into another user's context —
 * every function resolves the session from the userId argument.
 */

import fs from 'fs';
import type { Browser, BrowserContext, Page } from 'playwright';
import { resolveDataPath } from './runtimePaths';

export interface BrowserSessionStatus {
  active: boolean;
  url: string | null;
  title: string | null;
  lastUsedAt: string;
}

export interface BrowserActionResult {
  ok: boolean;
  message: string;
  url?: string;
  title?: string;
}

export const MAX_BROWSER_CONTEXTS = 8;
export const BROWSER_IDLE_MS = 10 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
const SNAPSHOT_MAX_CHARS = 8000;
const AUDIT_ACTION = 'browser';

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

function auditAction(userId: string, action: string, detail: string): void {
  try {
    const file = resolveDataPath('hoorvia_platform', 'browser-audit.jsonl');
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      userId,
      action,
      detail,
    });
    fs.appendFileSync(file, line + '\n');
  } catch {
    // Audit must never break browser actions.
  }
}

// ---------------------------------------------------------------------------
// URL allow-list (SSRF guard)
// ---------------------------------------------------------------------------

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
]);

const BLOCKED_SUFFIXES = ['.internal', '.localhost'];

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // 169.254.169.254 (link-local)
  return false;
}

export function isBrowserUrlAllowed(url: string): { allowed: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, reason: 'Invalid URL.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { allowed: false, reason: `Blocked protocol "${parsed.protocol}" — only http/https are allowed.` };
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  if (BLOCKED_HOSTNAMES.has(host)) {
    return { allowed: false, reason: `Blocked host "${host}".` };
  }
  if (isPrivateIpv4(host)) {
    return { allowed: false, reason: `Private network address "${host}" is not allowed.` };
  }
  for (const suffix of BLOCKED_SUFFIXES) {
    if (host.endsWith(suffix)) {
      return { allowed: false, reason: `Internal hostname "${host}" is not allowed.` };
    }
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// YouTube key map
// ---------------------------------------------------------------------------

export type YoutubeAction = 'play' | 'pause' | 'seek_forward_10' | 'seek_back_10' | 'stop' | 'volume_up' | 'volume_down' | 'mute';

export function youtubeActionToKeys(action: YoutubeAction): string[] {
  switch (action) {
    case 'play':
    case 'pause':
    case 'stop':
      return ['k'];
    case 'seek_forward_10':
      return ['l'];
    case 'seek_back_10':
      return ['j'];
    case 'volume_up':
      return ['ArrowUp'];
    case 'volume_down':
      return ['ArrowDown'];
    case 'mute':
      return ['m'];
  }
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

interface BrowserSession {
  context: BrowserContext;
  page: Page;
  lastUsedAt: number;
}

const sessions = new Map<string, BrowserSession>();
let browserInstance: Browser | null = null;
let sweepStarted = false;

async function getBrowser(): Promise<Browser> {
  if (browserInstance) return browserInstance;
  // Dynamic import so a missing/broken Playwright install fails at use
  // time, not at module import time.
  const { chromium } = await import('playwright');
  const launchOptions: Parameters<typeof chromium.launch>[0] = {
    // Headless by default (production servers have no display). Set
    // PARI_BROWSER_HEADLESS=false to SEE the browser window (local dev/demo).
    headless: process.env.PARI_BROWSER_HEADLESS !== 'false',
    args: [
      '--no-sandbox',
      // Reduce automation detection (YouTube blocks headless/bot browsers).
      '--disable-blink-features=AutomationControlled',
    ],
  };
  const exe = process.env.PARI_CHROMIUM_EXECUTABLE?.trim();
  if (exe) launchOptions.executablePath = exe;
  const proxy = proxyFromEnv();
  if (proxy) launchOptions.proxy = proxy;
  browserInstance = await chromium.launch(launchOptions);
  return browserInstance;
}

/** Honor proxy env vars (this sandbox + proxied hosting route outbound via one). */
function proxyFromEnv():
  | { server: string; bypass?: string; username?: string; password?: string }
  | undefined {
  const raw =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;
  if (!raw || !raw.trim()) return undefined;
  try {
    const u = new URL(raw.trim());
    const cfg: { server: string; bypass?: string; username?: string; password?: string } = {
      server: `${u.protocol}//${u.host}`,
    };
    const noProxy = process.env.NO_PROXY || process.env.no_proxy;
    if (noProxy) cfg.bypass = noProxy;
    if (u.username) cfg.username = decodeURIComponent(u.username);
    if (u.password) cfg.password = decodeURIComponent(u.password);
    return cfg;
  } catch {
    return undefined;
  }
}

function startSweepTimer(): void {
  if (sweepStarted) return;
  sweepStarted = true;
  const timer = setInterval(() => {
    void sweepIdleSessions().catch(() => {});
  }, SWEEP_INTERVAL_MS);
  // Don't keep the process alive for housekeeping.
  if (typeof (timer as unknown as { unref?: () => void }).unref === 'function') {
    (timer as unknown as { unref: () => void }).unref();
  }
}

async function sweepIdleSessions(): Promise<void> {
  const now = Date.now();
  for (const [userId, session] of sessions) {
    if (now - session.lastUsedAt > BROWSER_IDLE_MS) {
      await closeSessionInternal(userId, session);
      auditAction(userId, AUDIT_ACTION, 'session closed: idle timeout');
    }
  }
}

async function closeSessionInternal(userId: string, session: BrowserSession): Promise<void> {
  sessions.delete(userId);
  try {
    await session.page.close();
  } catch {
    // ignore
  }
  try {
    await session.context.close();
  } catch {
    // ignore
  }
}

/** Check if a session's page/context/browser is still alive. */
function isSessionAlive(session: BrowserSession): boolean {
  try {
    if (session.page.isClosed()) return false;
    const browser = session.context.browser();
    if (!browser || !browser.isConnected()) return false;
    return true;
  } catch {
    return false;
  }
}

/** Ensure a live session for this userId; evicts most-idle session when full. */
async function resolveSession(userId: string): Promise<BrowserSession> {
  let session = sessions.get(userId);
  if (session) {
    // The user may have closed the visible browser window, or the browser
    // may have crashed — detect the dead session and start fresh.
    if (!isSessionAlive(session)) {
      await closeSessionInternal(userId, session);
      auditAction(userId, AUDIT_ACTION, 'session was dead (window closed/crashed) — starting fresh');
      session = undefined;
    } else {
      session.lastUsedAt = Date.now();
      return session;
    }
  }
  if (sessions.size >= MAX_BROWSER_CONTEXTS) {
    // Make room: close the most-idle session.
    let oldestUser: string | null = null;
    let oldestTime = Infinity;
    for (const [uid, s] of sessions) {
      if (s.lastUsedAt < oldestTime) {
        oldestTime = s.lastUsedAt;
        oldestUser = uid;
      }
    }
    if (oldestUser) {
      const evicted = sessions.get(oldestUser);
      if (evicted) {
        await closeSessionInternal(oldestUser, evicted);
        auditAction(oldestUser, AUDIT_ACTION, 'session evicted: context pool full (LRU)');
      }
    }
  }
  const browser = await getBrowser();
  const context = await browser.newContext({
    acceptDownloads: false,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: false,
    locale: 'en-US',
  });
  const page = await context.newPage();
  session = { context, page, lastUsedAt: Date.now() };
  sessions.set(userId, session);
  startSweepTimer();
  auditAction(userId, AUDIT_ACTION, 'session created');
  return session;
}

function safeStatus(session: BrowserSession | undefined): Promise<BrowserSessionStatus> {
  if (!session) {
    return Promise.resolve({
      active: false,
      url: null,
      title: null,
      lastUsedAt: new Date(0).toISOString(),
    });
  }
  return session.page
    .title()
    .then((title) => ({
      active: true,
      url: session.page.url() || null,
      title: title || null,
      lastUsedAt: new Date(session.lastUsedAt).toISOString(),
    }))
    .catch(() => ({
      active: false,
      url: null,
      title: null,
      lastUsedAt: new Date(session.lastUsedAt).toISOString(),
    }));
}

export async function ensureBrowserSession(userId: string): Promise<BrowserSessionStatus> {
  try {
    const session = await resolveSession(userId);
    auditAction(userId, AUDIT_ACTION, 'ensure session');
    return await safeStatus(session);
  } catch (err) {
    auditAction(userId, AUDIT_ACTION, `ensure session failed: ${describeError(err)}`);
    return {
      active: false,
      url: null,
      title: null,
      lastUsedAt: new Date().toISOString(),
    };
  }
}

export async function closeBrowserSession(userId: string): Promise<{ ok: boolean }> {
  const session = sessions.get(userId);
  if (!session) return { ok: true };
  await closeSessionInternal(userId, session);
  auditAction(userId, AUDIT_ACTION, 'session closed by request');
  return { ok: true };
}

export async function getBrowserSessionStatus(userId: string): Promise<BrowserSessionStatus> {
  const session = sessions.get(userId);
  if (session) session.lastUsedAt = Date.now();
  return safeStatus(session);
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function withPage(
  userId: string,
  actionName: string,
  fn: (page: Page) => Promise<BrowserActionResult>,
): Promise<BrowserActionResult> {
  try {
    const session = await resolveSession(userId);
    const result = await fn(session.page);
    auditAction(userId, AUDIT_ACTION, `${actionName}: ${result.ok ? 'ok' : 'failed'} — ${result.message}`);
    return result;
  } catch (err) {
    const message = `Browser ${actionName} failed: ${describeError(err)}`;
    auditAction(userId, AUDIT_ACTION, message);
    return { ok: false, message };
  }
}

async function currentUrlAndTitle(page: Page): Promise<{ url: string; title: string }> {
  let title = '';
  try {
    title = await page.title();
  } catch {
    // ignore
  }
  return { url: page.url(), title };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Dismiss common cookie/consent dialogs (YouTube, Google, etc.) that block the page.
 * Runs after navigation so video players and content load properly. */
async function dismissConsentDialogs(page: any): Promise<void> {
  const selectors = [
    'button:has-text("Reject all")',
    'button:has-text("Reject All")',
    '#dismiss-button',
    'button[aria-label*="Reject"]',
    'button[aria-label*="reject"]',
  ];
  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click({ timeout: 3000 });
        await page.waitForTimeout(1000);
        return;
      }
    } catch (_) { /* try next selector */ }
  }
}

export async function browserOpen(userId: string, url: string): Promise<BrowserActionResult> {
  const check = isBrowserUrlAllowed(url);
  if (!check.allowed) {
    const message = `Blocked: ${check.reason ?? 'URL not allowed.'}`;
    auditAction(userId, AUDIT_ACTION, `open refused: ${url} — ${message}`);
    return { ok: false, message };
  }
  return withPage(userId, 'open', async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await dismissConsentDialogs(page);
    const { url: finalUrl, title } = await currentUrlAndTitle(page);
    return { ok: true, message: `Opened ${finalUrl}`, url: finalUrl, title: title || undefined };
  });
}

export async function browserSnapshot(userId: string): Promise<BrowserActionResult & { snapshot: string }> {
  try {
    const session = await resolveSession(userId);
    // YAML accessibility tree; interactive nodes carry [ref=eN] tokens that
    // browserClick / browserType consume via the aria-ref selector engine.
    // mode:'ai' is REQUIRED — without it no [ref=...] tokens are emitted.
    const text0 = await session.page.locator('body').ariaSnapshot({ mode: 'ai' }).catch(() => '');
    let text = text0;
    if (text.length > SNAPSHOT_MAX_CHARS) {
      text = text.slice(0, SNAPSHOT_MAX_CHARS) + '\n…[truncated]';
    }
    auditAction(userId, AUDIT_ACTION, 'snapshot: ok');
    const { url, title } = await currentUrlAndTitle(session.page);
    return { ok: true, message: 'Snapshot captured.', url, title: title || undefined, snapshot: text };
  } catch (err) {
    const message = `Browser snapshot failed: ${describeError(err)}`;
    auditAction(userId, AUDIT_ACTION, message);
    return { ok: false, message, snapshot: '' };
  }
}

/** The model sometimes pastes the element name along with the ref
 * (e.g. "_40:Acceptați tot" or "[ref=e40]"). Strip everything but the token. */
function cleanRef(raw: string): string {
  let s = String(raw || '').trim();
  const m = s.match(/\[ref=([^\]]+)\]/);
  if (m) s = m[1].trim();
  const t = s.match(/^[A-Za-z0-9_-]+/);
  return t ? t[0] : s;
}

export async function browserClick(userId: string, ref: string): Promise<BrowserActionResult> {
  return withPage(userId, 'click', async (page) => {
    // ref is a [ref=eN] token from browserSnapshot.
    const clean = cleanRef(ref);
    const urlBefore = page.url();
    await page.locator(`aria-ref=${clean}`).first().click({ timeout: 10000 });
    // Links often navigate — wait briefly for the URL to change or the page to settle.
    try {
      await page.waitForFunction(
        (before: string) => window.location.href !== before,
        urlBefore,
        { timeout: 5000 }
      );
      // Give the new page a moment to start loading.
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    } catch {
      // No navigation happened (same-page action) — that's fine.
    }
    const { url, title } = await currentUrlAndTitle(page);
    const navigated = url !== urlBefore;
    return { ok: true, message: `Clicked ${clean}.${navigated ? ` Navigated to ${url}` : ''}`, url, title: title || undefined };
  });
}

export async function browserType(
  userId: string,
  ref: string,
  text: string,
): Promise<BrowserActionResult> {
  return withPage(userId, 'type', async (page) => {
    const clean = cleanRef(ref);
    const locator = page.locator(`aria-ref=${clean}`).first();
    // Safety: refuse credential autofill on password inputs.
    const inputType = await locator
      .evaluate((el) => {
        const input = el as HTMLInputElement;
        return (input.getAttribute && input.getAttribute('type')) || '';
      })
      .catch(() => '');
    if (String(inputType).toLowerCase() === 'password') {
      return { ok: false, message: 'Refused: target is a password field (no credential autofill in v1).' };
    }
    await locator.fill(text, { timeout: 10000 });
    const { url, title } = await currentUrlAndTitle(page);
    return { ok: true, message: `Typed into ${clean}.`, url, title: title || undefined };
  });
}

export async function browserPress(userId: string, key: string): Promise<BrowserActionResult> {
  return withPage(userId, 'press', async (page) => {
    await page.keyboard.press(key, { delay: 0 });
    const { url, title } = await currentUrlAndTitle(page);
    return { ok: true, message: `Pressed ${key}.`, url, title: title || undefined };
  });
}

export interface VideoState {
  videoFound: boolean;
  readyState?: number;
  paused?: boolean;
  currentTime?: number;
  duration?: number;
}

async function readVideoState(page: Page): Promise<VideoState> {
  try {
    const s = await page.evaluate(() => {
      const v = document.querySelector('video') as HTMLVideoElement | null;
      if (!v) return { videoFound: false };
      return {
        videoFound: true,
        readyState: v.readyState,
        paused: v.paused,
        currentTime: v.currentTime,
        duration: Number.isFinite(v.duration) ? v.duration : 0,
      };
    });
    return s as VideoState;
  } catch {
    return { videoFound: false };
  }
}

/** Read the <video> playback state of the user's current page (diagnostics). */
export async function browserVideoState(
  userId: string
): Promise<{ ok: boolean; message?: string; title?: string; url?: string } & VideoState> {
  try {
    const session = await resolveSession(userId);
    const state = await readVideoState(session.page);
    const { url, title } = await currentUrlAndTitle(session.page);
    return { ok: true, url, title: title || undefined, ...state };
  } catch (err) {
    return { ok: false, message: `Could not read video state: ${describeError(err)}`, videoFound: false };
  }
}

export async function browserYoutube(
  userId: string,
  action: YoutubeAction,
): Promise<BrowserActionResult> {
  return withPage(userId, `youtube:${action}`, async (page) => {
    const url = page.url();
    let host = '';
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      host = '';
    }
    if (!host.endsWith('youtube.com') && !host.endsWith('youtu.be')) {
      return { ok: false, message: 'Not on YouTube — open a YouTube watch page first.' };
    }
    const before = await readVideoState(page);
    if (!before.videoFound) {
      const { url: finalUrl, title } = await currentUrlAndTitle(page);
      return { ok: false, message: 'No video element found on this YouTube page yet — the player may still be loading.', url: finalUrl, title: title || undefined };
    }
    const keys = youtubeActionToKeys(action);
    for (const key of keys) {
      await page.keyboard.press(key);
    }
    await page.waitForTimeout(1500);
    const after = await readVideoState(page);
    const { url: finalUrl, title } = await currentUrlAndTitle(page);
    // Report what ACTUALLY happened, not what was requested.
    let outcome: string;
    if (action === 'play' || action === 'pause') {
      const wantPlaying = action === 'play';
      const isPlaying = after.paused === false;
      outcome =
        isPlaying === wantPlaying
          ? `video is now ${isPlaying ? 'playing' : 'paused'} (t=${(after.currentTime || 0).toFixed(1)}s).`
          : `WARNING: asked to ${action} but video is still ${after.paused ? 'paused' : 'playing'} (t=${(after.currentTime || 0).toFixed(1)}s).`;
    } else if (action === 'stop') {
      outcome = after.paused ? 'video stopped.' : 'WARNING: video still playing after stop.';
    } else {
      const moved = (after.currentTime || 0) - (before.currentTime || 0);
      outcome = `seek ${action === 'seek_forward_10' ? '+10s' : '−10s'}: t=${(before.currentTime || 0).toFixed(1)}s → ${(after.currentTime || 0).toFixed(1)}s${Math.abs(moved) < 0.5 ? ' (WARNING: position barely moved)' : ''}.`;
    }
    const failed = /WARNING/.test(outcome);
    return {
      ok: !failed,
      message: `YouTube ${action}: ${outcome}`,
      url: finalUrl,
      title: title || undefined,
    };
  });
}

export async function browserScreenshot(userId: string): Promise<Buffer> {
  const session = sessions.get(userId);
  if (!session) {
    return Promise.reject(new Error('No browser session for this user. Call ensureBrowserSession first.'));
  }
  session.lastUsedAt = Date.now();
  try {
    const png = await session.page.screenshot({ type: 'png' });
    auditAction(userId, AUDIT_ACTION, 'screenshot: ok');
    return png;
  } catch (err) {
    const message = `Browser screenshot failed: ${describeError(err)}`;
    auditAction(userId, AUDIT_ACTION, message);
    return Promise.reject(new Error(message));
  }
}
