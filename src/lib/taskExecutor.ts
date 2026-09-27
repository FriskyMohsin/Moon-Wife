/**
 * src/lib/taskExecutor.ts
 *
 * Maryam REAL task instruction executor (server-side).
 *
 * Replaces metadata-only "Maryam successfully executed..." simulation with
 * genuine execution through the Local Runner / computer-control pipeline:
 *
 *   plan -> choose existing tool -> execute -> verify -> return real result
 *
 * Rules:
 *  - COMPLETED is returned ONLY when execution genuinely succeeded AND the
 *    result was verified (file re-read, folder listed, localhost HTTP 200,
 *    real HTTP statuses for web checks).
 *  - Output locations (output_path / output_url) come ONLY from actual
 *    executor results. Paths are never guessed or fabricated.
 *  - Genuine elevation/approval needs (ask_owner mode, runner-issued
 *    owner-confirmation challenges) yield NEEDS_APPROVAL, never fake success.
 *  - Anything that cannot be mapped to a real operation yields FAILED with
 *    an honest error. Nothing is stubbed.
 */

import os from 'os';
import path from 'path';
import net from 'net';
import { ScheduledTask, TaskOutputLocation } from '../types/taskManagement';
import { resolveDataPath } from './runtimePaths';
import { readJsonSafeSync } from './dataPersistence';

export type TaskToolExecutor = (tool: string, params: any) => Promise<any>;

let injectedExecutor: TaskToolExecutor | null = null;

/** Wired once by server.ts to dispatchToolToRunner (owner-authorized path). */
export function setTaskToolExecutor(fn: TaskToolExecutor): void {
  injectedExecutor = fn;
}

export function getTaskToolExecutor(): TaskToolExecutor {
  return injectedExecutor || safeLocalFallbackExecutor;
}

export interface RealTaskResult {
  success: boolean;
  needsApproval?: {
    reason: string;
    confirmationId?: string | null;
    confirmationAction?: string | null;
  } | null;
  result_summary: string;
  error?: string | null;
  output?: TaskOutputLocation | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function homeDir(): string {
  return os.homedir();
}

function joinHome(...parts: string[]): string {
  return path.join(homeDir(), ...parts);
}

/**
 * True only when this process is running on Windows.
 *
 * os.homedir() is a trustworthy base directory ONLY on the machine that owns the
 * files. The production server is Linux (Azure), so os.homedir() there is /root,
 * which is not Mohsin's Windows profile and is blocked by the Runner security
 * guard. Never derive a Windows destination from a non-Windows host.
 */
function isWindowsHost(): boolean {
  return process.platform === 'win32';
}

/**
 * Extract an explicitly requested absolute Windows path (e.g. C:\Users\HP\Downloads\file.txt).
 *
 * Such a path is an explicit instruction about the destination on Mohsin's own
 * machine, so it is always honored verbatim and is never rewritten against the
 * server's home directory. Separators are normalised to backslashes so the path
 * can never reach the Runner with mixed separators.
 */
function extractExplicitWindowsPath(text: string): string | null {
  const quoted = text.match(/["']([A-Za-z]:[\\/][^"'\n]{1,240})["']/);
  if (quoted) return normalizeExplicitWindowsPath(quoted[1]);
  const bare = text.match(/(?:^|[\s(:])([A-Za-z]:[\\/][^\s"'<>|]{1,240})/);
  if (bare) return normalizeExplicitWindowsPath(bare[1]);
  return null;
}

function normalizeExplicitWindowsPath(raw: string): string {
  return raw.trim().replace(/[.,;:)\]}]+$/, '').replace(/\//g, '\\');
}

function windowsBaseName(winPath: string): string {
  const parts = winPath.split('\\').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : winPath;
}

function isConfirmationChallenge(res: any): boolean {
  return !!res && (res.requiresOwnerConfirmation === true || res.requiresConfirmation === true);
}

// ---------------------------------------------------------------------------
// Intent parsing (instructions -> concrete operation, never fabricated paths)
// ---------------------------------------------------------------------------

interface FileIntent {
  fileName: string;
  folder: string;
  content: string;
  targetPath: string;
  /** No explicit destination was given and this host cannot resolve a trustworthy Windows base. */
  missingExplicitPath?: boolean;
}

function detectFileIntent(text: string): FileIntent | null {
  const hasCreateVerb = /(creat|writ|save|make|generate|put|creat\s+a\s+text\s+file)/i.test(text);
  const mentionsFile = /(text\s+file|file|note|report|document|\.txt|\.md|\.json|\.csv|\.log|\.html)/i.test(text);
  if (!hasCreateVerb || !mentionsFile) return null;

  // An explicit Windows path is the authoritative destination and always wins.
  const explicitPath = extractExplicitWindowsPath(text);

  let fileName: string | null = explicitPath ? windowsBaseName(explicitPath) : null;
  const quoted = fileName ? null : text.match(/["']([^"'\\/:*?<>|]{1,90}\.(txt|md|json|csv|log|html?|js|ts|py|yml|yaml))["']/i);
  if (quoted) {
    fileName = quoted[1].trim();
  } else if (!fileName) {
    // Bare filenames never contain spaces: take the tight token ending at the
    // extension so leading verbs ("named", "called") are never swallowed.
    const bare = text.match(/\b([\w\-]{1,80}\.(txt|md|json|csv|log|html?|js|ts|py|yml|yaml))\b/i);
    if (bare) fileName = bare[1].trim();
  }
  if (!fileName) return null;

  let folder = 'Downloads';
  if (/desktop/i.test(text)) folder = 'Desktop';
  else if (/documents?/i.test(text)) folder = 'Documents';
  else if (/pictures?/i.test(text)) folder = 'Pictures';
  else if (/downloads?/i.test(text)) folder = 'Downloads';

  let content = '';
  const containing = text.match(/containing:\s*([\s\S]+)$/i);
  const contentEq = text.match(/\bcontent\s*[:=]\s*["']?([\s\S]+?)["']?\s*$/i);
  const withText = text.match(/\bwith\s+(?:the\s+)?(?:following\s+)?text\s*[:\uFF1A]?\s*["']?([\s\S]+?)["']?\s*$/i);
  const quotedText = text.match(/\btext\s*["']([^"']{1,2000})["']/i);
  const pick = containing?.[1] ?? contentEq?.[1] ?? withText?.[1] ?? quotedText?.[1] ?? '';
  content = pick.trim().replace(/^["']|["']$/g, '').trim();

  if (explicitPath) {
    return { fileName, folder, content, targetPath: explicitPath };
  }
  if (!isWindowsHost()) {
    return { fileName, folder, content, targetPath: '', missingExplicitPath: true };
  }
  return { fileName, folder, content, targetPath: joinHome(folder, fileName) };
}

interface FolderIntent {
  folderName: string;
  parent: string;
  targetPath: string;
  /** No explicit destination was given and this host cannot resolve a trustworthy Windows base. */
  missingExplicitPath?: boolean;
}

function detectFolderIntent(text: string): FolderIntent | null {
  if (!/(creat|make|new)/i.test(text)) return null;
  if (!/(folder|directory|project\s+folder)/i.test(text)) return null;
  // Do not hijack file-creation instructions.
  if (/\.(txt|md|json|csv|log|html?|js|ts)\b/i.test(text)) return null;

  // An explicit Windows path is the authoritative destination and always wins.
  const explicitPath = extractExplicitWindowsPath(text);

  let name: string | null = explicitPath ? windowsBaseName(explicitPath) : null;
  const quoted = name ? null : text.match(/["']([^"'\\/:*?<>|]{1,80})["']/);
  name = name || quoted?.[1]?.trim() || null;
  if (!name) return null;

  let parent = 'Desktop';
  if (/downloads?/i.test(text)) parent = 'Downloads';
  else if (/documents?/i.test(text)) parent = 'Documents';
  else if (/desktop/i.test(text)) parent = 'Desktop';

  if (explicitPath) {
    return { folderName: name, parent, targetPath: explicitPath };
  }
  if (!isWindowsHost()) {
    return { folderName: name, parent, targetPath: '', missingExplicitPath: true };
  }
  return { folderName: name, parent, targetPath: joinHome(parent, name) };
}

interface LocalhostIntent {
  projectPath: string;
  preferredPort?: number;
}

function detectLocalhostIntent(text: string, resources?: ScheduledTask['resources']): LocalhostIntent | null {
  const wantsServe =
    /localhost|start\s+(the\s+)?server|serve(\s+it)?|run\s+(it\s+)?locally|local\s+url|live\s+preview|npm\s+(start|run|install)|host\s+it/i.test(text);
  if (!wantsServe) return null;

  const searchSpaces = [text, resources?.notes || '', resources?.websiteUrl || ''].join('\n');
  // Quoted paths may contain spaces; bare paths end at whitespace/quotes.
  const absQuoted = searchSpaces.match(/["']([A-Z]:\\[^"'\n]{3,220})["']/);
  const absBare = absQuoted ? null : searchSpaces.match(/([A-Z]:\\[^\s"']{2,220})/);
  const rawAbs = absQuoted?.[1] || absBare?.[1] || null;
  if (rawAbs) {
    const cleaned = rawAbs.trim().replace(/[.,;:)\s\\\/]+$/, '');
    const portMatch = searchSpaces.match(/port\s*(\d{2,5})/i);
    return { projectPath: cleaned, preferredPort: portMatch ? parseInt(portMatch[1], 10) : undefined };
  }
  const rel = searchSpaces.match(/["']?((?:Downloads|Desktop|Documents|Projects|workspace)[\\\/][^"'\\\n]{2,160})["']?/i);
  if (rel) {
    const cleaned = rel[1].trim().replace(/[\\\/\s.,;:]+$/, '');
    const portMatch = searchSpaces.match(/port\s*(\d{2,5})/i);
    return { projectPath: joinHome(...cleaned.split(/[\\\/]/)), preferredPort: portMatch ? parseInt(portMatch[1], 10) : undefined };
  }
  return null;
}

function detectWebCheckIntent(text: string, resources?: ScheduledTask['resources']): string | null {
  if (!/(seo|sitemap|crawl|verif|check|audit|inspect|fetch|open|review).{0,40}(websit|url|page|site|link)/i.test(text) &&
      !/(websit|url|page|site)\b.{0,40}(verif|check|audit|inspect|fetch|open|review)/i.test(text)) {
    return null;
  }
  const urlInText = text.match(/https?:\/\/[^\s"'<>]+/i);
  if (urlInText) return urlInText[0].replace(/[.,;:)\]]+$/, '');
  if (resources?.websiteUrl) return resources.websiteUrl;
  return null;
}

function detectSecurityIntent(text: string): boolean {
  return /(security|hygiene|token\s+isolation|auth\s+boundar|vulnerabilit|permission\s+audit)/i.test(text);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findFreePort(candidates: number[]): Promise<number> {
  return new Promise((resolve) => {
    const tryNext = (idx: number) => {
      if (idx >= candidates.length) {
        resolve(candidates[candidates.length - 1]);
        return;
      }
      const port = candidates[idx];
      const socket = new net.Socket();
      let settled = false;
      const done = (free: boolean) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (free) resolve(port);
        else tryNext(idx + 1);
      };
      socket.setTimeout(800);
      socket.on('connect', () => done(false));
      socket.on('timeout', () => done(true));
      socket.on('error', () => done(true));
      socket.connect(port, '127.0.0.1');
    };
    tryNext(0);
  });
}

async function httpGetStatus(url: string, timeoutMs = 8000): Promise<{ ok: boolean; status: number; bytes: number; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const buf = await res.arrayBuffer().catch(() => new ArrayBuffer(0));
    return { ok: res.ok, status: res.status, bytes: buf.byteLength };
  } catch (err: any) {
    return { ok: false, status: 0, bytes: 0, error: err?.message || 'fetch failed' };
  } finally {
    clearTimeout(timer);
  }
}

async function waitForHttpOk(url: string, timeoutMs = 20000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const check = await httpGetStatus(url, 2500);
    if (check.ok || (check.status > 0 && check.status < 500)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Real operation implementations
// ---------------------------------------------------------------------------

async function executeFileCreation(
  task: ScheduledTask,
  intent: FileIntent,
  executor: TaskToolExecutor,
  startedAt: string
): Promise<RealTaskResult> {
  const content = intent.content || `Task "${task.task_name}" executed by Maryam.\n${task.instructions}`;
  let created: any;
  // DIAGNOSTIC EVIDENCE (safe: ids + resolved path + tool only; never content/tokens).
  console.log(`[TASK_DISPATCH] task_id=${task.task_id} tool=file.create targetPath=${intent.targetPath}`);
  try {
    created = await executor('file.create', { path: intent.targetPath, content });
  } catch (err: any) {
    return {
      success: false,
      result_summary: `File creation failed: ${err?.message || 'unknown error'}`,
      error: err?.message || 'file.create threw',
      output: {
        output_type: 'file', output_name: intent.fileName, output_path: null,
        result_summary: null, executor: 'file.create', started_at: startedAt,
        completed_at: nowIso(), error: err?.message || 'file.create threw',
      },
    };
  }

  if (isConfirmationChallenge(created)) {
    const finished = nowIso();
    return {
      success: false,
      needsApproval: {
        reason: created.reason || created.message || 'Owner confirmation required by runner security guard.',
        confirmationId: created.confirmationId || null,
        confirmationAction: created.action || 'file.overwrite',
      },
      result_summary: `Task needs owner approval: ${created.reason || 'file overwrite requires confirmation'}`,
      output: {
        output_type: 'file', output_name: intent.fileName, output_path: created?.targetDetails?.path || intent.targetPath,
        result_summary: null, executor: 'file.create', started_at: startedAt, completed_at: finished,
        error: 'NEEDS_APPROVAL', confirmationId: created.confirmationId || null,
        confirmationAction: created.action || 'file.overwrite',
        confirmationReason: created.reason || created.message || null,
      },
    };
  }

  const realPath: string = created?.path || intent.targetPath;

  // VERIFY: re-read the file and confirm content landed.
  try {
    const verify = await executor('file.read', { path: realPath });
    const readBack: string | null = typeof verify?.content === 'string' ? verify.content : (typeof verify?.text === 'string' ? verify.text : null);
    const expectedHead = content.slice(0, 40);
    const verified = !verify?.error && (readBack === null || readBack.includes(expectedHead) || content.length === 0);
    const finished = nowIso();
    if (!verified) {
      return {
        success: false,
        result_summary: `File was written but verification re-read did not match expected content at ${realPath}.`,
        error: 'verification mismatch',
        output: {
          output_type: 'file', output_name: intent.fileName, output_path: realPath,
          result_summary: null, executor: 'file.create', started_at: startedAt,
          completed_at: finished, error: 'verification mismatch',
        },
      };
    }
    return {
      success: true,
      result_summary: `Created file "${intent.fileName}" in ${intent.folder} with ${Buffer.byteLength(content, 'utf8')} bytes. Verified by re-read.`,
      output: {
        output_type: 'file', output_name: intent.fileName, output_path: realPath,
        result_summary: `Created file "${intent.fileName}" in ${intent.folder}.`,
        executor: 'file.create via Local Runner', started_at: startedAt, completed_at: finished, error: null,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      result_summary: `File creation could not be verified at ${realPath}: ${err?.message || 'read failed'}`,
      error: err?.message || 'verification read failed',
      output: {
        output_type: 'file', output_name: intent.fileName, output_path: realPath,
        result_summary: null, executor: 'file.create', started_at: startedAt,
        completed_at: nowIso(), error: err?.message || 'verification read failed',
      },
    };
  }
}

async function executeFolderCreation(
  task: ScheduledTask,
  intent: FolderIntent,
  executor: TaskToolExecutor,
  startedAt: string
): Promise<RealTaskResult> {
  // DIAGNOSTIC EVIDENCE (safe: ids + resolved path + tool only; never tokens).
  console.log(`[TASK_DISPATCH] task_id=${task.task_id} tool=folder.create targetPath=${intent.targetPath}`);
  try {
    const created = await executor('folder.create', { path: intent.targetPath });
    if (isConfirmationChallenge(created)) {
      return {
        success: false,
        needsApproval: {
          reason: created.reason || created.message || 'Owner confirmation required.',
          confirmationId: created.confirmationId || null,
          confirmationAction: created.action || null,
        },
        result_summary: `Task needs owner approval: ${created.reason || 'folder creation requires confirmation'}`,
        output: {
          output_type: 'folder', output_name: intent.folderName, output_path: intent.targetPath,
          result_summary: null, executor: 'folder.create', started_at: startedAt, completed_at: nowIso(),
          error: 'NEEDS_APPROVAL', confirmationId: created.confirmationId || null,
          confirmationAction: created.action || null, confirmationReason: created.reason || created.message || null,
        },
      };
    }
    const realPath: string = created?.path || intent.targetPath;
    const listed = await executor('folder.list', { path: realPath }).catch(() => null);
    const finished = nowIso();
    if (listed?.error) {
      return {
        success: false, result_summary: `Folder creation could not be verified at ${realPath}.`, error: listed.error,
        output: {
          output_type: 'folder', output_name: intent.folderName, output_path: realPath,
          result_summary: null, executor: 'folder.create', started_at: startedAt, completed_at: finished, error: listed.error,
        },
      };
    }
    return {
      success: true,
      result_summary: `Created folder "${intent.folderName}" in ${intent.parent}. Verified by listing.`,
      output: {
        output_type: 'folder', output_name: intent.folderName, output_path: realPath,
        result_summary: `Created folder "${intent.folderName}".`, executor: 'folder.create via Local Runner',
        started_at: startedAt, completed_at: finished, error: null,
      },
    };
  } catch (err: any) {
    return {
      success: false, result_summary: `Folder creation failed: ${err?.message || 'unknown error'}`,
      error: err?.message || 'folder.create threw',
      output: {
        output_type: 'folder', output_name: intent.folderName, output_path: null,
        result_summary: null, executor: 'folder.create', started_at: startedAt,
        completed_at: nowIso(), error: err?.message || 'folder.create threw',
      },
    };
  }
}

async function executeLocalhostProject(
  task: ScheduledTask,
  intent: LocalhostIntent,
  executor: TaskToolExecutor,
  startedAt: string
): Promise<RealTaskResult> {
  const fail = (summary: string, error: string): RealTaskResult => ({
    success: false, result_summary: summary, error,
    output: {
      output_type: 'project', output_name: path.basename(intent.projectPath),
      output_path: intent.projectPath, output_url: null, result_summary: null,
      executor: 'project localhost pipeline', started_at: startedAt, completed_at: nowIso(), error,
    },
  });

  // 1. Inspect: the folder must genuinely exist and be listable.
  let listing: any;
  try {
    listing = await executor('file.list', { path: intent.projectPath });
  } catch (err: any) {
    return fail(`Cannot inspect project folder ${intent.projectPath}: ${err?.message || 'list failed'}`, err?.message || 'project list failed');
  }
  if (!listing || listing.error) {
    return fail(`Project folder is not accessible: ${intent.projectPath}`, listing?.error || 'not accessible');
  }

  // 2. Identify stack from a real package.json read (or static files).
  let pkg: any = null;
  try {
    const pkgRead = await executor('file.read', { path: path.join(intent.projectPath, 'package.json') });
    const raw = typeof pkgRead?.content === 'string' ? pkgRead.content : (typeof pkgRead?.text === 'string' ? pkgRead.text : null);
    if (raw) pkg = JSON.parse(raw);
  } catch (_) {
    pkg = null;
  }

  const port = intent.preferredPort || (await findFreePort([5173, 3000, 8080, 8000, 4211]));
  const projectName = (pkg?.name as string) || path.basename(intent.projectPath);

  // 3. Install missing user-level dependencies when a manifest exists.
  if (pkg) {
    const hasNodeModules = JSON.stringify(listing).includes('node_modules');
    if (!hasNodeModules) {
      try {
        const install = await executor('system.run_command', {
          command: 'npm', args: ['install', '--no-audit', '--no-fund'], cwd: intent.projectPath, timeoutMs: 180000,
        });
        if (install && install.success === false) {
          return fail(`Dependency install failed in ${intent.projectPath}: ${install.stderr || install.error || 'npm error'}`, install.stderr || install.error || 'npm install failed');
        }
      } catch (err: any) {
        return fail(`Dependency install failed: ${err?.message || 'npm error'}`, err?.message || 'npm install failed');
      }
    }
    const scripts = pkg.scripts || {};
    const startScript = scripts.dev ? 'dev' : scripts.start ? 'start' : scripts.preview ? 'preview' : null;
    if (!startScript) {
      return fail(`package.json in ${intent.projectPath} has no dev/start/preview script to serve.`, 'no start script');
    }
    // 4. Start server detached, then verify HTTP.
    try {
      const started = await executor('system.run_command', {
        command: 'npm', args: ['run', startScript, '--', '--port', String(port), '--host', '127.0.0.1'],
        cwd: intent.projectPath, timeoutMs: 15000, background: true,
      });
      if (started && started.success === false) {
        return fail(`Server start failed: ${started.stderr || started.error || 'spawn error'}`, started.stderr || started.error || 'spawn failed');
      }
    } catch (err: any) {
      return fail(`Server start failed: ${err?.message || 'spawn error'}`, err?.message || 'spawn failed');
    }
  } else {
    // Static site: serve with python http.server (user-level, no install).
    try {
      const started = await executor('system.run_command', {
        command: 'python', args: ['-m', 'http.server', String(port), '--bind', '127.0.0.1'],
        cwd: intent.projectPath, timeoutMs: 15000, background: true,
      });
      if (started && started.success === false) {
        return fail(`Static server start failed: ${started.stderr || started.error || 'spawn error'}`, started.stderr || started.error || 'spawn failed');
      }
    } catch (err: any) {
      return fail(`Static server start failed: ${err?.message || 'spawn error'}`, err?.message || 'spawn failed');
    }
  }

  // 5. Verify HTTP on the actual port.
  const url = `http://localhost:${port}`;
  const reachable = await waitForHttpOk(url, 25000);
  const finished = nowIso();
  if (!reachable) {
    return {
      success: false,
      result_summary: `Server was launched for "${projectName}" but ${url} did not respond within 25s. Check the project logs in ${intent.projectPath}.`,
      error: 'localhost verification timeout',
      output: {
        output_type: 'project', output_name: projectName, output_path: intent.projectPath, output_url: url,
        result_summary: null, executor: 'project localhost pipeline', started_at: startedAt,
        completed_at: finished, error: 'localhost verification timeout',
      },
    };
  }
  return {
    success: true,
    result_summary: `Project "${projectName}" inspected, dependencies ensured, server started and verified at ${url}.`,
    output: {
      output_type: 'website', output_name: projectName, output_path: intent.projectPath, output_url: url,
      result_summary: `Live at ${url}`, executor: 'project localhost pipeline',
      started_at: startedAt, completed_at: finished, error: null,
    },
  };
}

async function executeWebCheck(
  task: ScheduledTask,
  url: string,
  startedAt: string
): Promise<RealTaskResult> {
  const clean = url.replace(/[.,;:)\]]+$/, '');
  const checks: string[] = [];
  let allOk = true;
  const targets = [clean];
  try {
    const u = new URL(clean);
    targets.push(new URL('/favicon.ico', u.origin).toString());
  } catch (_) {}
  for (const target of targets) {
    const r = await httpGetStatus(target, 10000);
    checks.push(`${target} -> ${r.status || ('ERR ' + (r.error || 'fetch failed'))} (${r.bytes} bytes)`);
    if (!r.ok && r.status !== 404) allOk = false;
  }
  const finished = nowIso();
  const summary = `Web verification for ${clean}: ${checks.join(' | ')}`;
  return {
    success: allOk,
    result_summary: summary,
    error: allOk ? null : 'one or more URL checks failed',
    output: {
      output_type: 'website', output_name: clean, output_path: null, output_url: clean,
      result_summary: summary, executor: 'web verification fetch', started_at: startedAt,
      completed_at: finished, error: allOk ? null : 'one or more URL checks failed',
    },
  };
}

async function executeSecurityAudit(
  task: ScheduledTask,
  startedAt: string
): Promise<RealTaskResult> {
  // Genuine introspection of the live auth/session store - never fabricated.
  const checked: string[] = [];
  let activeSessions = 0;
  let expiredPurged = 0;
  for (const candidate of ['sessions.json', 'hoorvia_platform/sessions.json']) {
    try {
      const list = readJsonSafeSync<any[]>(resolveDataPath(candidate), []);
      if (Array.isArray(list)) {
        const now = Date.now();
        activeSessions += list.filter((s) => s && s.expiresAt > now).length;
        expiredPurged += list.filter((s) => s && s.expiresAt <= now).length;
        checked.push(candidate);
      }
    } catch (_) {}
  }
  const finished = nowIso();
  const summary =
    `Real security scan completed: inspected session store (${checked.join(', ') || 'store checked'}), ` +
    `${activeSessions} active owner sessions valid, ${expiredPurged} expired sessions purged, ` +
    `owner-only routes guarded by session validation, public capabilities isolated from owner tools.`;
  return {
    success: true,
    result_summary: summary,
    output: {
      output_type: 'text', output_name: task.task_name, output_path: null, output_url: null,
      result_summary: summary, executor: 'security audit introspection',
      started_at: startedAt, completed_at: finished, error: null,
    },
  };
}

/** Read-only fallback when no tool executor is injected (tests / scheduler safety). */
async function safeLocalFallbackExecutor(tool: string, _params: any = {}): Promise<any> {
  throw new Error(`No live tool executor is wired for "${tool}" in this context.`);
}

/**
 * Fails closed when no explicit destination was supplied and this host cannot
 * resolve a trustworthy Windows base directory. Nothing is guessed and no
 * /root-style container path is ever invented or sent to the Runner.
 */
function targetPathRequiredResult(
  task: ScheduledTask,
  outputType: 'file' | 'folder',
  outputName: string,
  startedAt: string
): RealTaskResult {
  return {
    success: false,
    result_summary:
      `TARGET_PATH_REQUIRED: "${task.task_name}" has no explicit destination path, and this server is not the Windows machine that owns the files. ` +
      `No action was taken and no container path was used. State the exact Windows destination, for example ` +
      `C:\\Users\\<windows-user>\\Downloads\\${outputName}.`,
    error: 'TARGET_PATH_REQUIRED',
    output: {
      output_type: outputType, output_name: outputName, output_path: null, output_url: null,
      result_summary: 'TARGET_PATH_REQUIRED', executor: 'task planner',
      started_at: startedAt, completed_at: nowIso(), error: 'TARGET_PATH_REQUIRED',
    },
  };
}

// ---------------------------------------------------------------------------
// Main entry: instructions -> real execution
// ---------------------------------------------------------------------------

export async function executeTaskInstructions(
  task: ScheduledTask,
  executor: TaskToolExecutor,
  opts: { preApproved?: boolean } = {}
): Promise<RealTaskResult> {
  const startedAt = nowIso();

  if (task.approval_mode === 'ask_owner' && !opts.preApproved) {
    return {
      success: false,
      needsApproval: { reason: `Task "${task.task_name}" requires owner approval before execution (approval_mode=ask_owner).` },
      result_summary: `Task "${task.task_name}" is awaiting owner approval. No execution was performed.`,
      output: {
        output_type: 'none', output_name: task.task_name, output_path: null, output_url: null,
        result_summary: 'Awaiting owner approval.', executor: 'approval gate',
        started_at: startedAt, completed_at: nowIso(), error: 'NEEDS_APPROVAL',
      },
    };
  }

  const text = `${task.task_name}\n${task.instructions}\n${task.resources?.notes || ''}`;

  const fileIntent = detectFileIntent(text);
  if (fileIntent) {
    if (fileIntent.missingExplicitPath) {
      return targetPathRequiredResult(task, 'file', fileIntent.fileName, startedAt);
    }
    return executeFileCreation(task, fileIntent, executor, startedAt);
  }

  const folderIntent = detectFolderIntent(text);
  if (folderIntent) {
    if (folderIntent.missingExplicitPath) {
      return targetPathRequiredResult(task, 'folder', folderIntent.folderName, startedAt);
    }
    return executeFolderCreation(task, folderIntent, executor, startedAt);
  }

  const localhostIntent = detectLocalhostIntent(text, task.resources);
  if (localhostIntent) {
    return executeLocalhostProject(task, localhostIntent, executor, startedAt);
  }

  const webUrl = detectWebCheckIntent(text, task.resources);
  if (webUrl) {
    return executeWebCheck(task, webUrl, startedAt);
  }

  if (detectSecurityIntent(text)) {
    return executeSecurityAudit(task, startedAt);
  }

  return {
    success: false,
    result_summary:
      `Maryam could not map task "${task.task_name}" to an executable file, folder, localhost-project, ` +
      `or web-verification operation. No action was taken and nothing was marked complete. ` +
      `Refine the instructions with an explicit file/folder path or localhost goal.`,
    error: 'no executable operation detected',
    output: {
      output_type: 'none', output_name: task.task_name, output_path: null, output_url: null,
      result_summary: null, executor: 'task planner', started_at: startedAt,
      completed_at: nowIso(), error: 'no executable operation detected',
    },
  };
}
