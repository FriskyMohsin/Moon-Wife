/**
 * Pari AI file upload — endpoint tests (real HTTP against the Express app).
 * Covers: valid upload lands in the user's own folder + file list,
 * unauth 401, oversized 413, disallowed type 400, user isolation,
 * and shared file-quota (uploads + generations) enforcement.
 *
 * Run: npx tsx tests/file-upload.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate ALL platform data (users, files, usage) into a temp dir.
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pari-upload-test-'));
process.env.MARYAM_DATA_DIR = DATA_DIR;

async function main() {
  const express = (await import('express')).default;
  const { registerHoorviaRoutes } = await import('../src/lib/hoorviaServerRoutes');
  const { registerUser, createSessionToken } = await import('../src/lib/hoorviaPlatform');
  const { recordPariUsage } = await import('../src/lib/pariUsage');

  const app = express();
  app.use(express.json({ limit: '20mb' }));
  registerHoorviaRoutes(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;

  const mkUser = (email: string) => {
    const { user, error } = registerUser(email, 'TestPass123!', 'Upload Tester');
    assert.ok(user, `registerUser failed: ${error}`);
    return { user: user!, token: createSessionToken(user!) };
  };
  const A = mkUser('upload-a@test.dev');
  const B = mkUser('upload-b@test.dev');

  const upload = (token: string | undefined, filename: string, content: Buffer, mime: string) => {
    const fd = new FormData();
    fd.append('file', new Blob([new Uint8Array(content)], { type: mime }), filename);
    const headers: Record<string, string> = {};
    if (token) headers['X-Hoorvia-Token'] = token;
    return fetch(`${base}/api/hoorvia/client/files/upload`, { method: 'POST', headers, body: fd });
  };
  const listFiles = (token: string) =>
    fetch(`${base}/api/hoorvia/client/files`, { headers: { 'X-Hoorvia-Token': token } });

  try {
    // 1. Valid upload → 200, on disk under the user's own folder, in the list.
    {
      const res = await upload(A.token, 'My Reference Notes (v2).TXT', Buffer.from('hello reference'), 'text/plain');
      assert.equal(res.status, 200, `expected 200, got ${res.status}`);
      const body: any = await res.json();
      assert.equal(body.status, 'ok');
      assert.ok(body.id, 'missing file id');
      assert.equal(body.filename, 'my-reference-notes-v2.txt', `filename not sanitized: ${body.filename}`);
      assert.ok(body.downloadUrl.includes(body.id), 'downloadUrl missing id');

      const userDir = path.join(DATA_DIR, 'hoorvia_platform', 'pari_user_files', A.user.id);
      const onDisk = path.join(userDir, 'my-reference-notes-v2.txt');
      assert.ok(fs.existsSync(onDisk), `file not on disk: ${onDisk}`);
      assert.equal(fs.readFileSync(onDisk, 'utf8'), 'hello reference');

      const listRes = await listFiles(A.token);
      assert.equal(listRes.status, 200);
      const list: any = await listRes.json();
      assert.ok(Array.isArray(list.files), 'files list missing');
      const found = list.files.find((f: any) => f.id === body.id);
      assert.ok(found, 'uploaded file not in file list');
      assert.equal(found.filename, 'my-reference-notes-v2.txt');
      console.log('PASS 1: valid upload stored per-user, sanitized, listed');
    }

    // 2. Unauthenticated upload → 401.
    {
      const res = await upload(undefined, 'nope.txt', Buffer.from('x'), 'text/plain');
      assert.equal(res.status, 401, `expected 401, got ${res.status}`);
      console.log('PASS 2: unauth upload rejected (401)');
    }

    // 3. Oversized file (>25MB) → 413.
    {
      const big = Buffer.alloc(26 * 1024 * 1024, 'a');
      const res = await upload(B.token, 'huge.pdf', big, 'application/pdf');
      assert.equal(res.status, 413, `expected 413, got ${res.status}`);
      const body: any = await res.json().catch(() => ({}));
      assert.match(String(body.error || ''), /25MB/i, 'error should mention 25MB');
      console.log('PASS 3: oversized upload rejected (413)');
    }

    // 4. Disallowed type (.exe) → 400; nothing stored.
    {
      const before = fs.existsSync(path.join(DATA_DIR, 'hoorvia_platform', 'pari_user_files', B.user.id));
      const res = await upload(B.token, 'evil.exe', Buffer.from('MZ...'), 'application/octet-stream');
      assert.equal(res.status, 400, `expected 400, got ${res.status}`);
      const list: any = await (await listFiles(B.token)).json();
      assert.equal(list.files.length, 0, 'exe must not appear in file list');
      assert.equal(before, false, 'no user dir should be created for rejected upload');
      console.log('PASS 4: disallowed type rejected (400)');
    }

    // 5. Isolation: B cannot see or download A's file.
    {
      const listB: any = await (await listFiles(B.token)).json();
      assert.equal(listB.files.length, 0, 'B must not see A files');
      const listA: any = await (await listFiles(A.token)).json();
      const aFileId = listA.files[0].id;
      const dl = await fetch(`${base}/api/hoorvia/client/files/${aFileId}`, {
        headers: { 'X-Hoorvia-Token': B.token },
      });
      assert.equal(dl.status, 404, `expected 404 for cross-user download, got ${dl.status}`);
      // …but A can download their own.
      const dlA = await fetch(`${base}/api/hoorvia/client/files/${aFileId}`, {
        headers: { 'X-Hoorvia-Token': A.token },
      });
      assert.equal(dlA.status, 200, `A should download own file, got ${dlA.status}`);
      assert.equal(await dlA.text(), 'hello reference');
      console.log('PASS 5: per-user isolation enforced');
    }

    // 6. Quota: 10 file-uses/day → next upload 429 (uploads share the Files quota).
    {
      const C = mkUser('upload-c@test.dev');
      for (let i = 0; i < 10; i++) recordPariUsage(C.user.id, 'file');
      const res = await upload(C.token, 'over-quota.txt', Buffer.from('x'), 'text/plain');
      assert.equal(res.status, 429, `expected 429, got ${res.status}`);
      console.log('PASS 6: file quota enforced (429) — uploads share quota with generations');
    }

    console.log('\nAll file-upload tests passed.');
  } finally {
    server.close();
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
