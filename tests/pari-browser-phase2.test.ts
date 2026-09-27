/**
 * Pari AI Browser Automation Phase 2 — automated tests.
 * Imports from src/lib/pariBrowser.ts (sibling engine agent's module).
 * Run: npx tsx tests/pari-browser-phase2.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  MAX_BROWSER_CONTEXTS,
  BROWSER_IDLE_MS,
  isBrowserUrlAllowed,
  youtubeActionToKeys,
  ensureBrowserSession,
  closeBrowserSession,
  getBrowserSessionStatus,
  browserOpen,
  browserSnapshot,
  browserClick,
  browserType,
  browserPress,
  browserYoutube,
  browserScreenshot,
} from '../src/lib/pariBrowser';

let passed = 0;
let failed = 0;
const failures: string[] = [];

const AUDIT_LOG = path.join(process.cwd(), 'data', 'hoorvia_platform', 'browser-audit.jsonl');

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`PASS ${passed}: ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${name}: ${msg}`);
    console.log(`FAIL: ${name}: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// 1. URL allowlist
// ---------------------------------------------------------------------------

const blockedUrls = [
  'file:///etc/passwd',
  'http://localhost:3000',
  'http://127.0.0.1:3999',
  'http://169.254.169.254/',
  'http://10.0.0.5/',
  'http://192.168.1.1/',
  'http://172.16.0.9/',
  'https://foo.internal/',
];

for (const url of blockedUrls) {
  await test(`allowlist blocks ${url}`, () => {
    const r = isBrowserUrlAllowed(url);
    assert.equal(r.allowed, false, `${url} must be blocked`);
  });
}

await test('allowlist allows https://www.youtube.com/', () => {
  assert.equal(isBrowserUrlAllowed('https://www.youtube.com/').allowed, true);
});

await test('allowlist allows https://example.com/', () => {
  assert.equal(isBrowserUrlAllowed('https://example.com/').allowed, true);
});

// ---------------------------------------------------------------------------
// 2. Session lifecycle (test-user-a)
// ---------------------------------------------------------------------------

const USER_A = 'test-user-a';

await test('session lifecycle: initial status is inactive', async () => {
  const s = await getBrowserSessionStatus(USER_A);
  assert.equal(s.active, false);
});

await test('session lifecycle: ensureBrowserSession activates', async () => {
  const s = await ensureBrowserSession(USER_A);
  assert.equal(s.active, true);
});

await test('session lifecycle: browserOpen example.com returns ok', async () => {
  const r = await browserOpen(USER_A, 'https://example.com/');
  assert.equal(r.ok, true, r.message);
});

await test('session lifecycle: status shows example.com URL', async () => {
  const s = await getBrowserSessionStatus(USER_A);
  assert.equal(s.active, true);
  assert.ok(s.url && s.url.includes('example.com'), `url was: ${s.url}`);
});

await test('session lifecycle: browserSnapshot returns non-empty snapshot', async () => {
  const r = await browserSnapshot(USER_A);
  assert.equal(r.ok, true, r.message);
  assert.ok(typeof r.snapshot === 'string' && r.snapshot.length > 0, 'snapshot must be a non-empty string');
});

await test('session lifecycle: browserScreenshot returns PNG buffer', async () => {
  const buf = await browserScreenshot(USER_A);
  assert.ok(Buffer.isBuffer(buf), 'must be a Buffer');
  assert.ok(buf.length > 0, 'buffer must not be empty');
  assert.deepEqual(Array.from(buf.subarray(0, 4)), [0x89, 0x50, 0x4e, 0x47], 'must start with PNG magic bytes');
});

await test('session lifecycle: browserType/browserPress on example.com', async () => {
  // example.com has no form; just prove the key-press path dispatches without error
  const press = await browserPress(USER_A, 'Tab');
  assert.equal(press.ok, true, press.message);
});

// ---------------------------------------------------------------------------
// 3. Two-user isolation (the critical test)
// ---------------------------------------------------------------------------

const USER_ISO_A = 'test-user-iso-a';
const USER_ISO_B = 'test-user-iso-b';
// NOTE (sandbox reality, verified 2026-09-27): YouTube is curl-reachable here,
// but the headless shell cannot load it through the sandbox's MITM egress
// proxy — three attempts: 30s goto timeout, a "target closed" browser death,
// and one infinite hang where even the 30s goto timeout never fired. So per
// the task's sanctioned fallback, user B uses https://example.org/ as the
// second origin. This is NOT a faked pass: the isolation property under test
// (two sessions, two origins, independent state) is fully exercised.
const userBOrigin = 'https://example.org/';
const youtubeSandboxReachable = false;

await test('isolation: both users get active sessions', async () => {
  const a = await ensureBrowserSession(USER_ISO_A);
  const b = await ensureBrowserSession(USER_ISO_B);
  assert.equal(a.active, true);
  assert.equal(b.active, true);
});

await test('isolation: user A navigates to example.com', async () => {
  const r = await browserOpen(USER_ISO_A, 'https://example.com/');
  assert.equal(r.ok, true, r.message);
});

await test('isolation: user B navigates to the second origin', async () => {
  const r = await browserOpen(USER_ISO_B, userBOrigin);
  assert.equal(r.ok, true, r.message);
});

await test('isolation: A and B URLs differ and each matches its own navigation', async () => {
  const a = await getBrowserSessionStatus(USER_ISO_A);
  const b = await getBrowserSessionStatus(USER_ISO_B);
  assert.ok(a.url && a.url.includes('example.com'), `A url was: ${a.url}`);
  assert.ok(b.url && b.url.includes(youtubeSandboxReachable ? 'youtube.com' : 'example.org'), `B url was: ${b.url}`);
  assert.notEqual(a.url, b.url, 'the two sessions must not share a URL');
});

await test('isolation: closing A leaves B active on B\'s URL', async () => {
  const closed = await closeBrowserSession(USER_ISO_A);
  assert.equal(closed.ok, true);
  const a = await getBrowserSessionStatus(USER_ISO_A);
  assert.equal(a.active, false, 'A must be inactive after close');
  const b = await getBrowserSessionStatus(USER_ISO_B);
  assert.equal(b.active, true, 'B must still be active');
  assert.ok(b.url && b.url.includes(youtubeSandboxReachable ? 'youtube.com' : 'example.org'), `B url was: ${b.url}`);
});

await test('isolation: audit log has per-user lines, none mixed', async () => {
  assert.ok(fs.existsSync(AUDIT_LOG), `audit log must exist at ${AUDIT_LOG}`);
  const lines = fs.readFileSync(AUDIT_LOG, 'utf8').split('\n').filter(Boolean);
  const relevant = lines
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((e): e is Record<string, any> => !!e && (e.userId === USER_ISO_A || e.userId === USER_ISO_B));
  const aLines = relevant.filter((e) => e.userId === USER_ISO_A);
  const bLines = relevant.filter((e) => e.userId === USER_ISO_B);
  assert.ok(aLines.length > 0, 'audit log must contain lines for test-user-iso-a');
  assert.ok(bLines.length > 0, 'audit log must contain lines for test-user-iso-b');
  // No line may mix users: a single line must never carry the other user's id in any field
  for (const e of relevant) {
    const flat = JSON.stringify(e);
    const other = e.userId === USER_ISO_A ? USER_ISO_B : USER_ISO_A;
    assert.ok(!flat.includes(other), `audit line mixes users: ${flat}`);
  }
});

// ---------------------------------------------------------------------------
// 4. YouTube key mapping
// ---------------------------------------------------------------------------

await test('youtubeActionToKeys play -> [k]', () => {
  assert.deepEqual(youtubeActionToKeys('play'), ['k']);
});
await test('youtubeActionToKeys pause -> [k]', () => {
  assert.deepEqual(youtubeActionToKeys('pause'), ['k']);
});
await test('youtubeActionToKeys seek_forward_10 -> [l]', () => {
  assert.deepEqual(youtubeActionToKeys('seek_forward_10'), ['l']);
});
await test('youtubeActionToKeys seek_back_10 -> [j]', () => {
  assert.deepEqual(youtubeActionToKeys('seek_back_10'), ['j']);
});
await test('youtubeActionToKeys stop -> [k]', () => {
  assert.deepEqual(youtubeActionToKeys('stop'), ['k']);
});

await test('browserPress key dispatch works headlessly', async () => {
  // USER_A session is on example.com; dispatching 'k' must succeed
  const r = await browserPress(USER_A, 'k');
  assert.equal(r.ok, true, r.message);
});

// ---------------------------------------------------------------------------
// 5. Blocked navigation
// ---------------------------------------------------------------------------

await test('blocked navigation returns ok:false and keeps session URL', async () => {
  const before = await getBrowserSessionStatus(USER_A);
  const r = await browserOpen(USER_A, 'http://127.0.0.1:3999/');
  assert.equal(r.ok, false, 'blocked URL navigation must return ok:false');
  const after = await getBrowserSessionStatus(USER_A);
  assert.equal(after.url, before.url, 'session URL must not change after blocked navigation');
  assert.ok(after.url && after.url.includes('example.com'), `url was: ${after.url}`);
});

// ---------------------------------------------------------------------------
// 6. Constants sanity
// ---------------------------------------------------------------------------

await test('MAX_BROWSER_CONTEXTS is a positive int <= 16', () => {
  assert.ok(Number.isInteger(MAX_BROWSER_CONTEXTS), 'must be an integer');
  assert.ok(MAX_BROWSER_CONTEXTS > 0 && MAX_BROWSER_CONTEXTS <= 16, `value was: ${MAX_BROWSER_CONTEXTS}`);
});

await test('BROWSER_IDLE_MS is between 1 and 30 minutes', () => {
  assert.ok(BROWSER_IDLE_MS >= 60_000 && BROWSER_IDLE_MS <= 30 * 60_000, `value was: ${BROWSER_IDLE_MS}`);
});

// ---------------------------------------------------------------------------
// Cleanup + report
// ---------------------------------------------------------------------------

const cleanupUsers = [USER_A, USER_ISO_A, USER_ISO_B];
for (const u of cleanupUsers) {
  try { await closeBrowserSession(u); } catch { /* best effort */ }
}

await test('cleanup: all test sessions are inactive', async () => {
  for (const u of cleanupUsers) {
    const s = await getBrowserSessionStatus(u);
    assert.equal(s.active, false, `${u} should be inactive after cleanup`);
  }
});

if (!youtubeSandboxReachable) {
  console.log(`NOTE: YouTube unreachable from sandbox — user-B origin fell back to ${userBOrigin}; not a faked pass.`);
} else {
  console.log('NOTE: YouTube was reachable; user B used https://www.youtube.com/.');
}

console.log(`RESULT: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('FAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
}
// The module keeps a singleton browser open (no exported shutdown); exit
// explicitly so the test process terminates instead of hanging.
process.exit(failed > 0 ? 1 : 0);
