#!/usr/bin/env node
/**
 * Maryam Chrome Native Messaging Host
 * Connects Chrome Extension (stdin/stdout 32-bit uint framing)
 * to Maryam Local Runner on 127.0.0.1:48123 (or local named pipe / event bus).
 */

const fs = require('fs');
const http = require('http');
const path = require('path');

const RUNNER_PORT = process.env.RUNNER_PORT || 48123;
const RUNNER_HOST = '127.0.0.1';
const TRUSTED_EXTENSION_ORIGIN = 'chrome-extension://ooalidlihcoemfijgdagllfkpbnhegjd/';
const PAIRING_STORE_PATH = path.join(
  process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || process.cwd(), 'AppData', 'Local'),
  'Maryam',
  'paired_profiles.json'
);

// Setup length-prefixed I/O for Chrome Native Messaging
function sendMessage(msg) {
  const jsonStr = JSON.stringify(msg);
  const buffer = Buffer.from(jsonStr, 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buffer.length, 0);
  process.stdout.write(header);
  process.stdout.write(buffer);
}

let inputBuffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);

  while (inputBuffer.length >= 4) {
    const msgLength = inputBuffer.readUInt32LE(0);
    if (inputBuffer.length < 4 + msgLength) {
      // Wait for complete message
      break;
    }

    const msgBytes = inputBuffer.slice(4, 4 + msgLength);
    inputBuffer = inputBuffer.slice(4 + msgLength);

    try {
      const msg = JSON.parse(msgBytes.toString('utf8'));
      handleExtensionMessage(msg);
    } catch (err) {
      logError('Failed to parse extension message:', err);
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});

function logError(...args) {
  // Never write raw text to stdout as it corrupts Native Messaging framing
  process.stderr.write(`[NativeHost] ${args.join(' ')}\n`);
}

function normalizeHandshakeResponse(requestType, response) {
  const responseType = requestType === 'VERIFY_PAIRING' ? 'PAIRING_RESULT' : 'HANDSHAKE_RESPONSE';
  if (response && response.success === true &&
      (response.profileRole === 'primary' || response.profileRole === 'secondary') &&
      typeof response.profileEmail === 'string' && response.profileEmail) {
    return { type: responseType, success: true, profileRole: response.profileRole, profileEmail: response.profileEmail };
  }
  return {
    type: responseType,
    success: false,
    error: String(response?.error || 'HANDSHAKE_SCHEMA_INVALID')
  };
}

// Recovery never returns the credential to Chrome. The native host is invoked
// only by the manifest's single allowed extension origin and supplies the
// existing user-level proof directly to the localhost runner.
function buildRecoveryHandshake(msg) {
  const invokingOrigin = process.argv.find(arg => arg.startsWith('chrome-extension://'));
  if (invokingOrigin !== TRUSTED_EXTENSION_ORIGIN) {
    throw new Error('PAIRING_RECOVERY_DENIED: Native host was not invoked by the trusted extension origin.');
  }
  const role = msg?.profileRole;
  if (role !== 'primary' && role !== 'secondary') {
    throw new Error('PAIRING_RECOVERY_DENIED: Authorized profile role is required.');
  }
  let store;
  try {
    store = JSON.parse(fs.readFileSync(PAIRING_STORE_PATH, 'utf8'));
  } catch (_) {
    throw new Error('PAIRING_RECOVERY_UNAVAILABLE: Persistent pairing proof is missing or unreadable.');
  }
  const record = store?.[role];
  if (!record || typeof record.pairingSecret !== 'string' || !record.pairingSecret) {
    throw new Error('PAIRING_RECOVERY_UNAVAILABLE: Persistent pairing proof is incomplete.');
  }
  return { type: 'HANDSHAKE', profileRole: role, pairingSecret: record.pairingSecret };
}

// Forward Extension Handshake & Responses to Local Runner
async function handleExtensionMessage(msg) {
  if (!msg) return;

  // 1. Pairing verification or handshake
  if (msg.type === 'HANDSHAKE' || msg.type === 'VERIFY_PAIRING' || msg.type === 'RECOVER_PAIRING') {
    try {
      const runnerRequest = msg.type === 'RECOVER_PAIRING' ? buildRecoveryHandshake(msg) : msg;
      const res = await callRunnerApi('/api/native-bridge/handshake', runnerRequest);
      sendMessage(normalizeHandshakeResponse(msg.type, res));
    } catch (err) {
      sendMessage(normalizeHandshakeResponse(msg.type, { success: false, error: err.message || 'NATIVE_HOST_HANDSHAKE_FAILED' }));
    }
    return;
  }

  // 2. Task response from extension
  if (msg.correlationId) {
    try {
      await callRunnerApi('/api/native-bridge/response', msg);
    } catch (err) {
      logError('Failed to forward task response to runner:', err);
    }
    return;
  }
}

// Long-poll Local Runner for tasks destined for this Extension
let isPolling = false;
let wasConnectedToRunner = false;

async function pollRunnerForTasks() {
  if (isPolling) return;
  isPolling = true;

  try {
    const task = await callRunnerApi('/api/native-bridge/poll', { host: 'com.maryam.browser.bridge' });
    if (!wasConnectedToRunner) {
      wasConnectedToRunner = true;
      // Notify extension that runner is online so it immediately initiates pairing recovery if needed
      sendMessage({ type: 'RUNNER_ONLINE' });
    }
    if (task && task.correlationId) {
      sendMessage(task);
    }
  } catch (err) {
    wasConnectedToRunner = false;
    // Runner might be briefly rebooting or busy, back off gracefully
  } finally {
    isPolling = false;
    setTimeout(pollRunnerForTasks, 300);
  }
}

function callRunnerApi(endpoint, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body || {});
    const req = http.request({
      hostname: RUNNER_HOST,
      port: RUNNER_PORT,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data || '{}'));
        } catch (_) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Runner API timeout'));
    });

    req.write(postData);
    req.end();
  });
}

// Start polling runner for dispatched extension actions
pollRunnerForTasks();
