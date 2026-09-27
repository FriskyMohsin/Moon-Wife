/**
 * Pari AI — shared browser-automation tool definitions + dispatcher.
 *
 * The same 8 `browser_*` Gemini function tools are used by BOTH the text-chat
 * path (`executeHoorviaUserChatWithFailover` in hoorviaServerRoutes.ts) and the
 * Live Voice path (`ai.live.connect` in hoorviaLiveWs.ts). They live here so
 * the two paths cannot drift apart: add/change a browser tool once, both
 * surfaces get it.
 *
 * Safety comes from the engine itself: `pariBrowser.ts` enforces per-user
 * isolated sessions, the URL blocklist, password-field refusal and the audit
 * log — the dispatcher below always passes the authenticated userId through.
 */
import fs from 'fs';
import { resolveDataPath } from './runtimePaths';
import {
  browserOpen,
  browserSnapshot,
  browserClick,
  browserType,
  browserPress,
  browserYoutube,
  browserScreenshot,
  closeBrowserSession,
  YoutubeAction,
} from './pariBrowser';

export const BROWSER_TOOL_NAMES = [
  'browser_open',
  'browser_snapshot',
  'browser_click',
  'browser_type',
  'browser_press',
  'browser_youtube',
  'browser_screenshot',
  'browser_close',
] as const;

/** The 8 browser tool declarations, shared by chat and Live Voice. */
export const BROWSER_TOOL_DECLARATIONS: any[] = [
  {
    name: 'browser_open',
    description: "Open a web page in the user's private server-side browser.",
    parameters: {
      type: 'OBJECT',
      properties: { url: { type: 'STRING', description: 'The full URL to open (https://...).' } },
      required: ['url'],
    },
  },
  {
    name: 'browser_snapshot',
    description: 'Get the accessibility tree of the current page so you can see clickable elements with refs.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'browser_click',
    description:
      'Click an element by its snapshot ref. Pass ONLY the ref token exactly as shown in brackets (e.g. e40) — never append the element name or text.',
    parameters: {
      type: 'OBJECT',
      properties: { ref: { type: 'STRING', description: 'The ref token from browser_snapshot, e.g. e40.' } },
      required: ['ref'],
    },
  },
  {
    name: 'browser_type',
    description:
      'Type text into an element by ref. Pass ONLY the ref token exactly as shown in brackets (e.g. e40) — never append the element name or text.',
    parameters: {
      type: 'OBJECT',
      properties: {
        ref: { type: 'STRING', description: 'The ref token from browser_snapshot, e.g. e40.' },
        text: { type: 'STRING', description: 'Text to type.' },
      },
      required: ['ref', 'text'],
    },
  },
  {
    name: 'browser_press',
    description: 'Press a keyboard key, e.g. k, j, l, Enter, Tab, Escape.',
    parameters: {
      type: 'OBJECT',
      properties: { key: { type: 'STRING', description: 'The key to press.' } },
      required: ['key'],
    },
  },
  {
    name: 'browser_youtube',
    description:
      'Control YouTube playback: play, pause, seek_forward_10, seek_back_10, stop. Page must already be a YouTube watch page.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          enum: ['play', 'pause', 'seek_forward_10', 'seek_back_10', 'stop'],
          description: 'The playback action.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'browser_screenshot',
    description: 'Capture a screenshot of the current page.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'browser_close',
    description: "Close the user's browser session.",
    parameters: { type: 'OBJECT', properties: {} },
  },
];

/** Engine surface the dispatcher needs. Injectable so tests can stub it. */
export interface BrowserEngine {
  browserOpen(userId: string, url: string): Promise<any>;
  browserSnapshot(userId: string): Promise<any>;
  browserClick(userId: string, ref: string): Promise<any>;
  browserType(userId: string, ref: string, text: string): Promise<any>;
  browserPress(userId: string, key: string): Promise<any>;
  browserYoutube(userId: string, action: YoutubeAction): Promise<any>;
  browserScreenshot(userId: string): Promise<Buffer>;
  closeBrowserSession(userId: string): Promise<any>;
}

const realEngine: BrowserEngine = {
  browserOpen,
  browserSnapshot,
  browserClick,
  browserType,
  browserPress,
  browserYoutube,
  browserScreenshot,
  closeBrowserSession,
};

function safeUserDirPart(userId: string): string {
  return (userId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'unknown';
}

/**
 * Execute one browser_* tool for the given user. Always returns a plain
 * JSON-able result — never throws, never leaks another user's session.
 */
export async function executeBrowserTool(
  userId: string,
  name: string,
  args: any,
  engine: BrowserEngine = realEngine
): Promise<any> {
  try {
    switch (name) {
      case 'browser_open': {
        const url = String(args?.url || '');
        if (!url) return { ok: false, message: 'url is required.' };
        const r = await engine.browserOpen(userId, url);
        return { ok: r.ok, message: r.message, url: r.url || undefined, title: r.title || undefined };
      }
      case 'browser_snapshot': {
        const r = await engine.browserSnapshot(userId);
        return { ok: r.ok, message: r.message, snapshot: (r as any).snapshot };
      }
      case 'browser_click': {
        const r = await engine.browserClick(userId, String(args?.ref || ''));
        return { ok: r.ok, message: r.message };
      }
      case 'browser_type': {
        // The pariBrowser engine refuses password fields itself;
        // surface its refusal message to the model unchanged.
        const r = await engine.browserType(userId, String(args?.ref || ''), String(args?.text || ''));
        return { ok: r.ok, message: r.message };
      }
      case 'browser_press': {
        const r = await engine.browserPress(userId, String(args?.key || ''));
        return { ok: r.ok, message: r.message };
      }
      case 'browser_youtube': {
        const action = String(args?.action || '');
        const valid = ['play', 'pause', 'seek_forward_10', 'seek_back_10', 'stop'] as const;
        if (!(valid as readonly string[]).includes(action)) {
          return { ok: false, message: 'Invalid YouTube action. Use play, pause, seek_forward_10, seek_back_10, or stop.' };
        }
        const r = await engine.browserYoutube(userId, action as YoutubeAction);
        return { ok: r.ok, message: r.message };
      }
      case 'browser_screenshot': {
        const png = await engine.browserScreenshot(userId);
        const relFile = ['browser-shots', safeUserDirPart(userId), `shot-${Date.now()}.png`].join('/');
        fs.writeFileSync(resolveDataPath('hoorvia_platform', ...relFile.split('/')), png);
        return { ok: true, message: 'Screenshot saved', file: relFile };
      }
      case 'browser_close': {
        const r = await engine.closeBrowserSession(userId);
        return { ok: r.ok, message: r.ok ? 'Browser session closed.' : 'No active browser session.' };
      }
      default:
        return { ok: false, message: `Unknown tool: ${name}` };
    }
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Browser action failed.' };
  }
}

/** Minimal shape of a Gemini Live function call (from message.toolCall). */
export interface LiveFunctionCall {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
}

/** Minimal shape the dispatcher needs from a Live session. */
export interface LiveSessionLike {
  sendToolResponse(params: {
    functionResponses: Array<{ id?: string; name?: string; response: unknown }>;
  }): void;
}

/** Append-only debug log for the voice→browser path (data/voice-browser-debug.log). */
export function voiceBrowserDebugLog(line: string): void {
  try {
    const p = resolveDataPath('voice-browser-debug.log');
    fs.appendFileSync(p, `[${new Date().toISOString()}] ${line}\n`);
  } catch {
    /* debug logging must never break the call */
  }
}

/**
 * Handle Live API tool calls: execute each one against the pariBrowser engine
 * for THIS user, then send the results back with matching ids. Never throws —
 * a failed tool becomes an error result so the voice call keeps going.
 * The engine is injectable for tests; production uses the real engine.
 */
export async function respondToLiveToolCalls(
  liveSession: LiveSessionLike,
  userId: string,
  functionCalls: LiveFunctionCall[],
  engine?: BrowserEngine
): Promise<void> {
  const calls = Array.isArray(functionCalls) ? functionCalls : [];
  const functionResponses: Array<{ id?: string; name?: string; response: unknown }> = [];
  for (const call of calls) {
    const name = String(call?.name || '');
    let result: unknown;
    try {
      result = await executeBrowserTool(userId, name, call?.args || {}, engine);
    } catch (err: any) {
      result = { ok: false, message: err?.message || 'Browser action failed.' };
    }
    const r = result as any;
    voiceBrowserDebugLog(
      `EXEC user=${userId} tool=${name} args=${JSON.stringify(call?.args || {}).slice(0, 200)} => ok=${r?.ok} msg=${String(r?.message || r?.error || '').slice(0, 200)}`
    );
    functionResponses.push({ id: call?.id, name, response: result });
  }
  if (functionResponses.length === 0) return;
  liveSession.sendToolResponse({ functionResponses });
}
