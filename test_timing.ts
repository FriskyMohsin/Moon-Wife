async function traceSystemHealthPrePolled() {
  const token = '1234567890abcdef1234567890abcdef';
  const t_start = Date.now();
  const REQUEST_SENT_AT = new Date(t_start).toISOString();
  console.log(`[REQUEST_SENT_AT] ${REQUEST_SENT_AT}`);

  // 1. Establish active long-poll first (simulating active Windows runner connection)
  const pollPromise = fetch('http://localhost:3000/api/runner/relay/poll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-runner-token': token },
    body: JSON.stringify({ platform: 'win32', omnirouteAvailable: true, omnirouteVersion: '3.8.50' })
  });

  // Give 100ms for poll to reach server and set activeRelayPollRes
  await new Promise(r => setTimeout(r, 100));

  const t_exec_start = Date.now();
  const execPromise = fetch('http://localhost:3000/api/runner/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool: 'system.health', params: {} })
  }).then(async r => {
    const DISPATCHER_RECEIVED_AT = new Date().toISOString();
    console.log(`[DISPATCHER_RECEIVED_AT] ${DISPATCHER_RECEIVED_AT} (elapsed: ${Date.now() - t_exec_start}ms)`);
    return await r.json();
  });

  const pollRes = await pollPromise;
  if (pollRes.status === 200) {
    const task = await pollRes.json();
    const RUNNER_RECEIVED_AT = new Date().toISOString();
    console.log(`[RUNNER_RECEIVED_AT] ${RUNNER_RECEIVED_AT}`);

    // Simulate 445ms Windows runner processing time
    await new Promise(r => setTimeout(r, 445));
    const RUNNER_RESPONDED_AT = new Date().toISOString();
    console.log(`[RUNNER_RESPONDED_AT] ${RUNNER_RESPONDED_AT}`);

    const respRes = await fetch('http://localhost:3000/api/runner/relay/response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-runner-token': token },
      body: JSON.stringify({
        taskId: task.id,
        success: true,
        result: {
          success: true,
          tool: 'system.health',
          available: true,
          runnerStatus: 'ONLINE',
          omnirouteStatus: 'Ready',
          omnirouteVersion: '3.8.50',
          browserAutomationReady: true,
          timestamp: Date.now()
        }
      })
    });
    const RELAY_RECEIVED_RESPONSE_AT = new Date().toISOString();
    console.log(`[RELAY_RECEIVED_RESPONSE_AT] ${RELAY_RECEIVED_RESPONSE_AT}`);
  }

  const result = await execPromise;
  const GEMINI_RECEIVED_RESULT_AT = new Date().toISOString();
  console.log(`[GEMINI_RECEIVED_RESULT_AT] ${GEMINI_RECEIVED_RESULT_AT}`);
  console.log('Result:', JSON.stringify(result, null, 2));
}

traceSystemHealthPrePolled();
