/**
 * Pari AI Browser Automation — Live Voice wiring tests.
 * Covers the shared browser-tools module (src/lib/pariBrowserTools.ts) used by
 * BOTH text chat and the Live Voice path (hoorviaLiveWs.ts).
 * Run: npx tsx tests/pari-browser-voice.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  BROWSER_TOOL_NAMES,
  BROWSER_TOOL_DECLARATIONS,
  executeBrowserTool,
  respondToLiveToolCalls,
  BrowserEngine,
} from '../src/lib/pariBrowserTools';

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`PASS ${passed}: ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${name}: ${msg}`);
    console.error(`FAIL: ${name}\n  ${msg}`);
  }
}

/** Recording stub engine — never touches real Chromium. */
function makeStubEngine() {
  const calls: Array<{ fn: string; args: any[] }> = [];
  const engine: BrowserEngine = {
    browserOpen: async (u, url) => { calls.push({ fn: 'browserOpen', args: [u, url] }); return { ok: true, message: 'opened', url, title: 'T' }; },
    browserSnapshot: async (u) => { calls.push({ fn: 'browserSnapshot', args: [u] }); return { ok: true, message: 'snap', snapshot: 'SNAP' }; },
    browserClick: async (u, ref) => { calls.push({ fn: 'browserClick', args: [u, ref] }); return { ok: true, message: 'clicked' }; },
    browserType: async (u, ref, text) => { calls.push({ fn: 'browserType', args: [u, ref, text] }); return { ok: true, message: 'typed' }; },
    browserPress: async (u, key) => { calls.push({ fn: 'browserPress', args: [u, key] }); return { ok: true, message: 'pressed' }; },
    browserYoutube: async (u, action) => { calls.push({ fn: 'browserYoutube', args: [u, action] }); return { ok: true, message: `YouTube ${action} sent.` }; },
    browserScreenshot: async (u) => { calls.push({ fn: 'browserScreenshot', args: [u] }); return Buffer.from('fakepng'); },
    closeBrowserSession: async (u) => { calls.push({ fn: 'closeBrowserSession', args: [u] }); return { ok: true }; },
  };
  return { engine, calls };
}

await test('declarations: exactly 8 browser tools', () => {
  assert.equal(BROWSER_TOOL_DECLARATIONS.length, 8);
  assert.equal(BROWSER_TOOL_NAMES.length, 8);
});

await test('declarations: names match BROWSER_TOOL_NAMES and have valid schemas', () => {
  const names = BROWSER_TOOL_DECLARATIONS.map((d) => d.name);
  assert.deepEqual(names, [...BROWSER_TOOL_NAMES]);
  for (const d of BROWSER_TOOL_DECLARATIONS) {
    assert.ok(d.name && d.description, `${d.name}: name/description required`);
    assert.equal(d.parameters?.type, 'OBJECT', `${d.name}: parameters.type must be OBJECT`);
  }
  const open = BROWSER_TOOL_DECLARATIONS.find((d) => d.name === 'browser_open');
  assert.deepEqual(open.parameters.required, ['url']);
  const yt = BROWSER_TOOL_DECLARATIONS.find((d) => d.name === 'browser_youtube');
  assert.deepEqual(yt.parameters.required, ['action']);
  assert.deepEqual(yt.parameters.properties.action.enum, ['play', 'pause', 'seek_forward_10', 'seek_back_10', 'stop']);
});

await test('dispatcher routes each tool to the right engine function with the right userId', async () => {
  const { engine, calls } = makeStubEngine();
  const uid = 'voice-user-1';
  await executeBrowserTool(uid, 'browser_open', { url: 'https://example.com' }, engine);
  await executeBrowserTool(uid, 'browser_snapshot', {}, engine);
  await executeBrowserTool(uid, 'browser_click', { ref: 'e5' }, engine);
  await executeBrowserTool(uid, 'browser_type', { ref: 'e6', text: 'hello' }, engine);
  await executeBrowserTool(uid, 'browser_press', { key: 'k' }, engine);
  await executeBrowserTool(uid, 'browser_youtube', { action: 'pause' }, engine);
  await executeBrowserTool(uid, 'browser_close', {}, engine);
  const fns = calls.map((c) => c.fn);
  assert.deepEqual(fns, ['browserOpen', 'browserSnapshot', 'browserClick', 'browserType', 'browserPress', 'browserYoutube', 'closeBrowserSession']);
  for (const c of calls) assert.equal(c.args[0], uid, `${c.fn} must receive the voice userId`);
  assert.equal(calls[0].args[1], 'https://example.com');
  assert.equal(calls[3].args[2], 'hello');
  assert.equal(calls[5].args[1], 'pause');
});

await test('dispatcher: browser_open requires url', async () => {
  const { engine, calls } = makeStubEngine();
  const r = await executeBrowserTool('u1', 'browser_open', {}, engine);
  assert.equal(r.ok, false);
  assert.equal(calls.length, 0);
});

await test('dispatcher: browser_youtube rejects invalid action without touching engine', async () => {
  const { engine, calls } = makeStubEngine();
  const r = await executeBrowserTool('u1', 'browser_youtube', { action: 'rewind' }, engine);
  assert.equal(r.ok, false);
  assert.match(r.message, /Invalid YouTube action/);
  assert.equal(calls.length, 0);
});

await test('dispatcher: browser_screenshot saves file and returns rel path', async () => {
  const { engine } = makeStubEngine();
  const r = await executeBrowserTool('voice-user-9', 'browser_screenshot', {}, engine);
  assert.equal(r.ok, true);
  assert.match(r.file, /^browser-shots\/voice-user-9\/shot-\d+\.png$/);
  // cleanup the proof file
  const p = `data/hoorvia_platform/${r.file}`;
  if (fs.existsSync(p)) fs.unlinkSync(p);
});

await test('dispatcher: unknown tool name returns error, never throws', async () => {
  const { engine } = makeStubEngine();
  const r = await executeBrowserTool('u1', 'browser_hack', {}, engine);
  assert.equal(r.ok, false);
  assert.match(r.message, /Unknown tool/);
});

await test('dispatcher: engine throw becomes error result', async () => {
  const { engine } = makeStubEngine();
  (engine as any).browserOpen = async () => { throw new Error('boom'); };
  const r = await executeBrowserTool('u1', 'browser_open', { url: 'https://example.com' }, engine);
  assert.equal(r.ok, false);
  assert.equal(r.message, 'boom');
});

await test('isolation: user A calls never touch user B session', async () => {
  const { engine, calls } = makeStubEngine();
  await executeBrowserTool('user-A', 'browser_open', { url: 'https://example.com' }, engine);
  await executeBrowserTool('user-B', 'browser_snapshot', {}, engine);
  await executeBrowserTool('user-A', 'browser_youtube', { action: 'play' }, engine);
  assert.deepEqual(calls.map((c) => c.args[0]), ['user-A', 'user-B', 'user-A']);
});

await test('respondToLiveToolCalls: toolCall in -> toolResponse out with matching ids', async () => {
  const { engine, calls } = makeStubEngine();
  const sent: any[] = [];
  const fakeSession = { sendToolResponse: (p: any) => { sent.push(p); } };
  await respondToLiveToolCalls(
    fakeSession,
    'voice-u',
    [
      { id: 'call-1', name: 'browser_open', args: { url: 'https://example.com' } },
      { id: 'call-2', name: 'browser_youtube', args: { action: 'play' } },
    ],
    engine
  );
  assert.equal(sent.length, 1, 'sendToolResponse called exactly once');
  assert.equal(sent[0].functionResponses.length, 2);
  assert.equal(sent[0].functionResponses[0].id, 'call-1');
  assert.equal(sent[0].functionResponses[0].name, 'browser_open');
  assert.equal(sent[0].functionResponses[0].response.ok, true);
  assert.equal(sent[0].functionResponses[1].id, 'call-2');
  assert.equal(sent[0].functionResponses[1].response.message, 'YouTube play sent.');
  assert.deepEqual(calls.map((c) => c.args[0]), ['voice-u', 'voice-u']);
});

await test('respondToLiveToolCalls: empty calls -> no sendToolResponse', async () => {
  const { engine } = makeStubEngine();
  let sent = 0;
  const fakeSession = { sendToolResponse: () => { sent++; } };
  await respondToLiveToolCalls(fakeSession, 'u1', [], engine);
  assert.equal(sent, 0);
});

await test('respondToLiveToolCalls: engine failure becomes error response, no throw', async () => {
  const { engine } = makeStubEngine();
  (engine as any).browserSnapshot = async () => { throw new Error('engine down'); };
  const sent: any[] = [];
  const fakeSession = { sendToolResponse: (p: any) => { sent.push(p); } };
  await respondToLiveToolCalls(
    fakeSession,
    'u1',
    [{ id: 'x', name: 'browser_snapshot', args: {} }],
    engine
  );
  assert.equal(sent.length, 1);
  assert.equal(sent[0].functionResponses[0].id, 'x');
  assert.equal(sent[0].functionResponses[0].response.ok, false);
  assert.equal(sent[0].functionResponses[0].response.message, 'engine down');
});

await test('respondToLiveToolCalls: unknown tool from model -> error response, session survives', async () => {
  const { engine } = makeStubEngine();
  const sent: any[] = [];
  const fakeSession = { sendToolResponse: (p: any) => { sent.push(p); } };
  await respondToLiveToolCalls(
    fakeSession,
    'u1',
    [{ id: 'z', name: 'browser_delete_everything', args: {} }],
    engine
  );
  assert.equal(sent[0].functionResponses[0].response.ok, false);
  assert.match(sent[0].functionResponses[0].response.message, /Unknown tool/);
});

await test('no drift: chat route and voice WS both import the shared module', () => {
  const routes = fs.readFileSync('src/lib/hoorviaServerRoutes.ts', 'utf8');
  const live = fs.readFileSync('src/lib/hoorviaLiveWs.ts', 'utf8');
  assert.match(routes, /from '\.\/pariBrowserTools'/);
  assert.match(routes, /BROWSER_TOOL_DECLARATIONS/);
  assert.match(live, /from '\.\/pariBrowserTools'/);
  assert.match(live, /BROWSER_TOOL_DECLARATIONS/);
  assert.match(live, /respondToLiveToolCalls/);
  assert.match(live, /message.*toolCall|toolCall\?\.functionCalls/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('FAILURES:\n' + failures.join('\n'));
  process.exit(1);
}
