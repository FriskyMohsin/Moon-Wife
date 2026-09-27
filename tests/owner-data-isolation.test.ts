/**
 * tests/owner-data-isolation.test.ts
 *
 * P0 regression guard: Mohsin's private owner data (canonical conversation and
 * the shared memory bank) must never be reachable without a validated owner
 * server session.
 *
 * The proven defect was an OMISSION: server.ts keeps an explicit allow-list of
 * owner-only path prefixes in front of the strict isolation guard, and
 * '/api/memory' was missing from it. Every anonymous visitor could therefore
 * GET the full memory bank, and the client then POSTed it straight back,
 * poisoning Mohsin's real memory.
 *
 * These assertions fail loudly if that allow-list entry is ever removed again.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverSrc = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
const appSrc = fs.readFileSync(path.join(root, 'src', 'App.tsx'), 'utf8');
const memSrc = fs.readFileSync(path.join(root, 'src', 'lib', 'memoryManager.ts'), 'utf8');

let failures = 0;
function check(label: string, cond: boolean): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) failures++;
}

console.log('=== OWNER DATA ISOLATION (P0) ===\n');

// --- 1. Extract the strict isolation guard allow-list -----------------------
const guardMatch = serverSrc.match(
  /app\.use\(\[\s*([\s\S]*?)\]\s*,\s*\(\s*req\s*,\s*res\s*,\s*next\s*\)\s*=>\s*\{\s*const fullPath/
);
assert.ok(guardMatch, 'could not locate the strict isolation guard in server.ts');
const guardList = guardMatch[1];

console.log('--- guard allow-list coverage ---');
for (const p of ['/api/owner/conversation', '/api/memory', '/api/runner', '/api/hoorvia/tasks']) {
  check(`guard protects ${p}`, guardList.includes(`'${p}'`));
}

// --- 2. The guard must actually enforce a validated owner session ----------
check('guard requires a session token (401 when missing)', /if\s*\(!token\)\s*\{\s*return res\.status\(401\)/.test(serverSrc));
check('guard requires role === owner (403 otherwise)', /!session\s*\|\|\s*session\.role\s*!==\s*'owner'/.test(serverSrc));
check('guard validates server-side via validateSessionToken', /validateSessionToken\(token\)/.test(guardMatch[0] + serverSrc));

// --- 3. No owner fallback identity anywhere in the auth path ---------------
check('no hard-coded owner fallback into the guarded memory route',
  !/app\.get\('\/api\/memory'[\s\S]{0,200}usr_mohsin_owner/.test(serverSrc));

// --- 4. /api/chat must gate owner memory on a validated session ------------
const chatIdx = serverSrc.indexOf("app.post('/api/chat'");
assert.ok(chatIdx > -1, 'chat route not found');
const chatBody = serverSrc.slice(chatIdx, chatIdx + 4000);
check('chat derives owner status from validateSessionToken, not the request body',
  /ownerSession\s*=\s*requestToken\s*\?\s*validateSessionToken\(requestToken\)\s*:\s*null/.test(chatBody));
check('chat owner memory retrieval requires isOwnerChat',
  /isOwnerChat\s*\?\s*getRelevantMemoriesWithTiming/.test(chatBody));
check('chat writes deterministic memory only for owner chats',
  /isOwnerChat\s*\?\s*extractDeterministicMemory/.test(chatBody));
check('guest mode is not sufficient to become owner',
  /isOwnerChat\s*=\s*!isGuestModeActive\s*&&\s*ownerSession\?\.role\s*===\s*'owner'/.test(chatBody));

// --- 5. Client must not hydrate owner memory without a session ------------
const memFetchIdx = appSrc.indexOf("fetch('/api/memory'");
assert.ok(memFetchIdx > -1, 'client memory fetch not found');
const memFetchCtx = appSrc.slice(Math.max(0, memFetchIdx - 260), memFetchIdx + 260);
check('client only fetches /api/memory when an owner token exists', /if\s*\(token\)\s*\{/.test(memFetchCtx));
check('client ignores non-OK memory responses', /res\.ok\s*\?\s*res\.json\(\)\s*:\s*null/.test(memFetchCtx));

// --- 6. Client memory write-back must be owner-scoped ----------------------
const saveIdx = memSrc.indexOf('export function saveMemoryBank');
assert.ok(saveIdx > -1, 'saveMemoryBank not found');
const saveBody = memSrc.slice(saveIdx, saveIdx + 2000);
check('memory write-back requires an owner token', /getOwnerToken\(\)/.test(saveBody));
check('memory write-back sends owner auth headers', /getOwnerAuthHeaders\(/.test(saveBody));

console.log(`\n${failures === 0 ? 'ALL OWNER DATA ISOLATION TESTS PASSED' : failures + ' CHECK(S) FAILED'}`);
if (failures > 0) process.exit(1);
