/**
 * Pari AI — Live Voice productivity tools (tasks + files).
 *
 * The Live Voice session originally only had the 8 `browser_*` tools, so a
 * voice call could not do what the chat/Files UI does (create a task, save a
 * prompt file, generate a PPTX/DOCX/PDF). These 4 tools close that gap and are
 * wired into the Live WS alongside the browser tools in hoorviaLiveWs.ts.
 *
 * The module follows the pariBrowserTools.ts pattern exactly: a NAMES const, a
 * declarations array, an execute fn with an injectable deps surface, and a
 * respondToLive*ToolCalls fn for the Live API. Everything is per-user
 * isolated, quota-gated (the shared Files 10/day + 50/week quota) and never
 * throws — a failed tool becomes an error result so the voice call keeps
 * going. API keys are resolved the same way as the HTTP routes and their
 * values are never logged.
 */
import { voiceBrowserDebugLog, LiveFunctionCall, LiveSessionLike } from './pariBrowserTools';
import { createClientTask } from './pariTasks';
import {
  saveUserFile,
  slugifyFilenameStem,
  buildPptx,
  buildDocx,
  buildPdf,
  PariFileKind,
} from './pariFiles';
import { resolveModelKeyForUser } from './pariRouter';
import { checkPariUsage, recordPariUsage } from './pariUsage';

export const PRODUCTIVITY_TOOL_NAMES = [
  'create_task',
  'save_text_file',
  'generate_presentation',
  'generate_document',
] as const;

/** The 4 voice productivity tool declarations, registered on the Live WS. */
export const PRODUCTIVITY_TOOL_DECLARATIONS: any[] = [
  {
    name: 'create_task',
    description:
      "Create a task in the user's Tasks list (e.g. when they say 'make a task' or 'remind me').",
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Short task title.' },
        detail: { type: 'STRING', description: 'Optional longer detail/notes.' },
        dueAt: { type: 'STRING', description: 'Optional due date/time as an ISO string.' },
        priority: { type: 'STRING', enum: ['high', 'med', 'low'], description: 'Priority (default med).' },
      },
      required: ['title'],
    },
  },
  {
    name: 'save_text_file',
    description:
      "Save a prompt, note, any text the user dictated, or a complete single-page HTML website as a .txt, .md or .html file in the user's Files & Studio tab. For websites, write the FULL standalone HTML (with inline CSS/JS) as the text content.",
    parameters: {
      type: 'OBJECT',
      properties: {
        filename: { type: 'STRING', description: 'Desired filename, e.g. "pitch-prompt", "notes.md" or "my-website.html".' },
        text: { type: 'STRING', description: 'The full text content to save. For .html files, the complete standalone HTML page.' },
      },
      required: ['filename', 'text'],
    },
  },
  {
    name: 'generate_presentation',
    description:
      'Generate a real PPTX presentation file from a topic and save it to the user\'s Files & Studio tab.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Presentation title.' },
        topic: { type: 'STRING', description: 'What the presentation is about.' },
        slideCount: { type: 'INTEGER', description: 'Number of slides (default 8, max 20).' },
      },
      required: ['title', 'topic'],
    },
  },
  {
    name: 'generate_document',
    description:
      "Generate a real Word (DOCX) or PDF document from the user's text and save it to Files & Studio.",
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Document title.' },
        text: { type: 'STRING', description: 'The document body text.' },
        format: { type: 'STRING', enum: ['docx', 'pdf'], description: 'Output format (default docx).' },
      },
      required: ['title', 'text'],
    },
  },
];

/** Injectable surface the dispatcher needs. Stubbed in tests; real in production. */
export interface ProductivityDeps {
  resolveKey(userId: string, isOwner: boolean): { apiKey: string; model: string } | null;
  checkUsage(userId: string): { ok: boolean; message?: string };
  recordUsage(userId: string): void;
  createTask(
    userId: string,
    input: { title: string; detail?: string; dueAt?: string | null; priority?: 'high' | 'med' | 'low'; source?: 'voice' }
  ): { id: string; title: string };
  saveFile(
    userId: string,
    filename: string,
    buffer: Buffer,
    mimeType: string,
    kind: PariFileKind
  ): { id: string; filename: string };
  buildPptx(
    apiKey: string,
    model: string,
    input: { title: string; topic: string; slideCount: number }
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }>;
  buildDocx(
    apiKey: string,
    model: string,
    input: { title: string; kind: 'document'; text: string }
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }>;
  buildPdf(
    apiKey: string,
    model: string,
    input: { title: string; kind: 'document'; text: string }
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }>;
}

/** Same key logic as resolvePariKey in hoorviaServerRoutes.ts: per-user key, owner env fallback. */
function defaultResolveKey(userId: string, isOwner: boolean): { apiKey: string; model: string } | null {
  const resolved = resolveModelKeyForUser(userId);
  if (!isOwner && !resolved) return null;
  const apiKey = isOwner ? resolved?.apiKey || process.env.GEMINI_API_KEY || '' : resolved!.apiKey;
  if (!apiKey) return null;
  return { apiKey, model: resolved?.model || 'gemini-2.0-flash' };
}

const realDeps: ProductivityDeps = {
  resolveKey: defaultResolveKey,
  checkUsage: (userId) => checkPariUsage(userId, 'file'),
  recordUsage: (userId) => recordPariUsage(userId, 'file'),
  createTask: (userId, input) => createClientTask(userId, { ...input, source: 'voice' }),
  saveFile: (userId, filename, buffer, mimeType, kind) => saveUserFile(userId, filename, buffer, mimeType, kind),
  buildPptx,
  buildDocx,
  buildPdf,
};

const NO_KEY_MESSAGE =
  'I need your Google Gemini API key for that — please connect it in Settings first, then ask me again.';

/** Quota gate for everything that writes to Files (uploads + generations share the Files quota). */
function quotaGate(userId: string, deps: ProductivityDeps): { ok: false; message: string } | null {
  const check = deps.checkUsage(userId);
  if (!check.ok) return { ok: false, message: check.message || 'File limit reached. Please try again later.' };
  return null;
}

/**
 * Execute one productivity tool for the given user. Always returns a plain
 * JSON-able result — never throws, never leaks another user's data, and never
 * logs key material.
 */
export async function executeProductivityTool(
  userId: string,
  name: string,
  args: any,
  opts: { isOwner?: boolean; deps?: ProductivityDeps } = {}
): Promise<any> {
  const deps = opts.deps || realDeps;
  const isOwner = !!opts.isOwner;
  try {
    switch (name) {
      case 'create_task': {
        const title = String(args?.title || '').trim();
        if (!title) return { ok: false, message: 'title is required.' };
        const priority = args?.priority === 'high' || args?.priority === 'low' ? args.priority : 'med';
        const task = await deps.createTask(userId, {
          title,
          detail: typeof args?.detail === 'string' ? args.detail : undefined,
          dueAt: typeof args?.dueAt === 'string' && args.dueAt ? args.dueAt : undefined,
          priority,
          source: 'voice',
        });
        return { ok: true, message: `Task created: ${task.title}.`, taskId: task.id };
      }
      case 'save_text_file': {
        const gate = quotaGate(userId, deps);
        if (gate) return gate;
        const rawName = String(args?.filename || 'note');
        const text = String(args?.text || '');
        if (!text) return { ok: false, message: 'text is required.' };
        const lowerName = rawName.toLowerCase();
        const ext = lowerName.endsWith('.html') ? '.html' : lowerName.endsWith('.md') ? '.md' : '.txt';
        const stem = slugifyFilenameStem(rawName.replace(/\.[a-z0-9]+$/i, '')) || 'note';
        const filename = `${stem}${ext}`;
        const kind: PariFileKind = ext === '.html' ? 'html' : ext === '.md' ? 'md' : 'txt';
        const mime = ext === '.html' ? 'text/html' : ext === '.md' ? 'text/markdown' : 'text/plain';
        const meta = await deps.saveFile(userId, filename, Buffer.from(text, 'utf-8'), mime, kind);
        deps.recordUsage(userId);
        return { ok: true, message: `Saved ${meta.filename} — find it in Files & Studio.`, filename: meta.filename, fileId: meta.id };
      }
      case 'generate_presentation': {
        const gate = quotaGate(userId, deps);
        if (gate) return gate;
        const title = String(args?.title || '').trim();
        const topic = String(args?.topic || '').trim();
        if (!title) return { ok: false, message: 'title is required.' };
        if (!topic) return { ok: false, message: 'topic is required.' };
        const keyInfo = deps.resolveKey(userId, isOwner);
        if (!keyInfo) return { ok: false, message: NO_KEY_MESSAGE };
        const n = parseInt(String(args?.slideCount || '8'), 10);
        const slideCount = Number.isFinite(n) ? Math.min(Math.max(n, 1), 20) : 8;
        const built = await deps.buildPptx(keyInfo.apiKey, keyInfo.model, { title, topic, slideCount });
        const meta = await deps.saveFile(userId, built.filename, built.buffer, built.mimeType, 'pptx');
        deps.recordUsage(userId);
        return { ok: true, message: `Presentation "${title}" is ready in Files & Studio.`, filename: meta.filename, fileId: meta.id };
      }
      case 'generate_document': {
        const gate = quotaGate(userId, deps);
        if (gate) return gate;
        const title = String(args?.title || '').trim();
        const text = String(args?.text || '');
        if (!title) return { ok: false, message: 'title is required.' };
        if (!text) return { ok: false, message: 'text is required.' };
        const keyInfo = deps.resolveKey(userId, isOwner);
        if (!keyInfo) return { ok: false, message: NO_KEY_MESSAGE };
        const format = args?.format === 'pdf' ? 'pdf' : 'docx';
        const built =
          format === 'pdf'
            ? await deps.buildPdf(keyInfo.apiKey, keyInfo.model, { title, kind: 'document', text })
            : await deps.buildDocx(keyInfo.apiKey, keyInfo.model, { title, kind: 'document', text });
        const meta = await deps.saveFile(userId, built.filename, built.buffer, built.mimeType, format);
        deps.recordUsage(userId);
        return { ok: true, message: `Document "${title}" is ready in Files & Studio.`, filename: meta.filename, fileId: meta.id };
      }
      default:
        return { ok: false, message: `Unknown tool: ${name}` };
    }
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Action failed.' };
  }
}

/**
 * Handle Live API productivity tool calls: execute each one for THIS user,
 * then send the results back with matching ids. Never throws — a failed tool
 * becomes an error result so the voice call keeps going. Mirrors
 * respondToLiveToolCalls in pariBrowserTools.ts.
 */
export async function respondToLiveProductivityToolCalls(
  liveSession: LiveSessionLike,
  userId: string,
  functionCalls: LiveFunctionCall[],
  opts: { isOwner?: boolean; deps?: ProductivityDeps } = {}
): Promise<void> {
  const calls = Array.isArray(functionCalls) ? functionCalls : [];
  const functionResponses: Array<{ id?: string; name?: string; response: unknown }> = [];
  for (const call of calls) {
    const name = String(call?.name || '');
    let result: unknown;
    try {
      result = await executeProductivityTool(userId, name, call?.args || {}, opts);
    } catch (err: any) {
      result = { ok: false, message: err?.message || 'Action failed.' };
    }
    const r = result as any;
    voiceBrowserDebugLog(
      `EXEC user=${userId} tool=${name} args=${JSON.stringify(call?.args || {}).slice(0, 200)} => ok=${r?.ok} msg=${String(r?.message || '').slice(0, 200)}`
    );
    functionResponses.push({ id: call?.id, name, response: result });
  }
  if (functionResponses.length === 0) return;
  liveSession.sendToolResponse({ functionResponses });
}
