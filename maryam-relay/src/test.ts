process.env.NODE_ENV = 'test';
import assert from 'assert';
import { app, taskStore, ALLOWED_TOOLS } from './index.js';
import http from 'http';

const TEST_TOKEN = 'test_runner_token_32_chars_long_secret_123';
process.env.RUNNER_TOKEN = TEST_TOKEN;

let server: http.Server;
let port: number;

function request(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; body: any; raw: string }> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (body) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(raw);
          } catch (_) {}
          resolve({ status: res.statusCode || 500, body: parsed, raw });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('--- RUNNING MARYAM RELAY SECURITY & UNIT TESTS ---');

  // Start server on random free port
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const addr = server.address() as any;
  port = addr.port;

  try {
    // TEST 1: Health endpoint does not expose secrets
    console.log('[Test 1] GET /health (Unauthenticated)');
    const healthRes = await request('GET', '/health');
    assert.strictEqual(healthRes.status, 200, 'Health endpoint must be 200 OK');
    assert.strictEqual(healthRes.body.status, 'ok');
    assert.strictEqual(healthRes.body.service, 'maryam-relay');
    assert.strictEqual(healthRes.raw.includes(TEST_TOKEN), false, 'Health must NOT expose secrets');

    // TEST 2: Missing auth token -> 401
    console.log('[Test 2] Missing token -> 401');
    const noAuthRes = await request('POST', '/api/runner/relay/poll', {}, { isWindows: true });
    assert.strictEqual(noAuthRes.status, 401, 'Missing token must yield 401');

    // TEST 3: Wrong token -> 401
    console.log('[Test 3] Wrong token -> 401');
    const wrongAuthRes = await request('POST', '/api/runner/relay/poll', { 'x-runner-token': 'wrong_token' }, { isWindows: true });
    assert.strictEqual(wrongAuthRes.status, 401, 'Wrong token must yield 401');

    // TEST 4: Valid token -> accepted (204 No Content when queue is empty)
    console.log('[Test 4] Valid token -> accepted (204 No Content)');
    const validPollRes = await request('POST', '/api/runner/relay/poll', { 'x-runner-token': TEST_TOKEN }, { isWindows: true });
    assert.strictEqual(validPollRes.status, 204, 'Valid auth with empty queue must yield 204');

    // TEST 5: Non-allowlisted tool rejected -> 400
    console.log('[Test 5] Non-allowlisted tool -> 400');
    const badToolRes = await request(
      'POST',
      '/api/runner/relay/task',
      { 'x-runner-token': TEST_TOKEN },
      { tool: 'malicious_shell_exec', params: { cmd: 'rm -rf /' } }
    );
    assert.strictEqual(badToolRes.status, 400, 'Non-allowlisted tool must yield 400');
    assert.strictEqual(badToolRes.body.error.includes('approved safety allowlist'), true);

    // TEST 5.5: Published media tools are accepted by the actual relay enqueue endpoint.
    console.log('[Test 5.5] Media tool exposure through relay allowlist');
    for (const tool of ['browser.media_play', 'browser.media_pause', 'browser.media_toggle', 'browser.media_seek', 'browser.media_get_state']) {
      assert.strictEqual(ALLOWED_TOOLS.has(tool), true, `${tool} must be published to Maryam`);
      const mediaEnqueue = await request(
        'POST',
        '/api/runner/relay/task',
        { 'x-runner-token': TEST_TOKEN },
        { tool, params: tool === 'browser.media_seek' ? { seconds: 10 } : {} }
      );
      assert.strictEqual(mediaEnqueue.status, 201, `${tool} must reach the relay queue`);
      taskStore.delete(mediaEnqueue.body.taskId);
    }

    // TEST 6: Enqueue valid task & Poll
    console.log('[Test 6] Enqueue valid task & Poll round-trip');
    const enqueueRes = await request(
      'POST',
      '/api/runner/relay/task',
      { 'x-runner-token': TEST_TOKEN },
      { tool: 'browser.get_title', params: {} }
    );
    assert.strictEqual(enqueueRes.status, 201, 'Enqueue valid task must yield 201');
    const taskId = enqueueRes.body.taskId;
    assert.ok(taskId, 'Task ID must be returned');

    // Poll for task
    const pollWithTask = await request('POST', '/api/runner/relay/poll', { 'x-runner-token': TEST_TOKEN }, { isWindows: true });
    assert.strictEqual(pollWithTask.status, 200, 'Poll with queued task must yield 200');
    assert.strictEqual(pollWithTask.body.id, taskId, 'Polled task ID must match');
    assert.strictEqual(pollWithTask.body.tool, 'browser.get_title');

    // TEST 7: Return result & Idempotency
    console.log('[Test 7] Return task result & check idempotency');
    const resRes = await request(
      'POST',
      '/api/runner/relay/response',
      { 'x-runner-token': TEST_TOKEN },
      { taskId, success: true, result: { title: 'Google AI Studio' } }
    );
    assert.strictEqual(resRes.status, 200, 'Submitting result must yield 200');
    assert.strictEqual(resRes.body.status, 'ok');

    // Submit duplicate result (Idempotency)
    const dupRes = await request(
      'POST',
      '/api/runner/relay/response',
      { 'x-runner-token': TEST_TOKEN },
      { taskId, success: true, result: { title: 'Duplicate Result' } }
    );
    assert.strictEqual(dupRes.status, 200, 'Duplicate result must be handled gracefully with 200');
    assert.strictEqual(dupRes.body.alreadyCompleted, true, 'Should mark alreadyCompleted');

    // TEST 8: Task Expiration handling
    console.log('[Test 8] Expired task is skipped and marked EXPIRED');
    const expiredEnqueue = await request(
      'POST',
      '/api/runner/relay/task',
      { 'x-runner-token': TEST_TOKEN },
      { tool: 'omniroute.status', params: {}, timeoutMs: 500 }
    );
    const expiredTaskId = expiredEnqueue.body.taskId;

    // Manually force expiration in memory
    const storedTask = taskStore.get(expiredTaskId);
    if (storedTask) storedTask.expiresAt = Date.now() - 1000;

    // Poll should skip the expired task and return 204
    const pollExpired = await request('POST', '/api/runner/relay/poll', { 'x-runner-token': TEST_TOKEN }, { isWindows: true });
    assert.strictEqual(pollExpired.status, 204, 'Expired task must be skipped during polling');
    assert.strictEqual(taskStore.get(expiredTaskId)?.status, 'EXPIRED', 'Status must be updated to EXPIRED');

    console.log('\n✅ ALL MARYAM RELAY SECURITY & UNIT TESTS PASSED!');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ TEST FAILURE:', err);
  process.exit(1);
});
