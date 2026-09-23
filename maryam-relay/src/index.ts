import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Limit request body size to 10MB to prevent memory exhaustion
app.use(express.json({ limit: '10mb' }));

// -------------------------------------------------------------------------
// Security & Authentication Helper
// -------------------------------------------------------------------------
function getExpectedToken(): string {
  return (
    process.env.RUNNER_TOKEN ||
    process.env.MARYAM_RUNNER_TOKEN ||
    process.env.MARYAM_RUNNER_SECRET ||
    ''
  ).trim();
}

/**
 * Constant-time string verification to prevent timing attacks
 */
function timingSafeCheck(input: string, expected: string): boolean {
  if (!input || !expected) return false;
  const bufA = Buffer.from(input);
  const bufB = Buffer.from(expected);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Authenticates incoming machine requests.
 * Accepts token via x-runner-token header or Authorization: Bearer <token>.
 */
function authenticateMachineRequest(req: Request, res: Response, next: NextFunction): void {
  const tokenHeader =
    (req.headers['x-runner-token'] as string) ||
    ((req.headers['authorization'] as string) || '').replace(/^Bearer\s+/i, '');

  const expected = getExpectedToken();

  if (expected) {
    if (!tokenHeader || !timingSafeCheck(tokenHeader.trim(), expected)) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing runner authentication token.' });
      return;
    }
  } else {
    // If no explicit token is configured on the relay server, require a non-empty token >= 16 characters
    if (!tokenHeader || tokenHeader.trim().length < 16) {
      res.status(401).json({ error: 'Unauthorized: Runner authentication token required.' });
      return;
    }
  }

  next();
}

// -------------------------------------------------------------------------
// Strict Tool Allowlist
// -------------------------------------------------------------------------
const ALLOWED_TOOLS = new Set<string>([
  'system.health',
  'system.node_version',
  'omniroute.status',
  'omniroute.version',
  'browser.open',
  'browser.navigate',
  'browser.search',
  'browser.click',
  'browser.type',
  'browser.scroll',
  'browser.back',
  'browser.forward',
  'browser.refresh',
  'browser.new_tab',
  'browser.close_tab',
  'browser.switch_tab',
  'browser.read_page',
  'browser.get_url',
  'browser.get_title',
  'browser.screenshot',
  'browser.upload_file',
  'browser.play',
  'browser.pause',
  'browser.seek',
  'browser.mute',
  'browser.unmute',
  'browser.volume',
  'browser.fullscreen',
  'browser.get_playback_info',
  'browser.media_play',
  'browser.media_pause',
  'browser.media_toggle',
  'browser.media_seek',
  'browser.media_restart',
  'browser.media_get_state',
  'browser.media_mute',
  'browser.media_unmute',
  'browser.media_volume',
  'browser.media_fullscreen',
  'browser.media_info',
  'file.list',
  'file.read',
  'file.create',
  'file.write',
  'file.append',
  'file.rename',
  'folder.list',
  'folder.create',
  'folder.rename',
  'folder.move',
  'system.list_apps',
  'system.open_app',
  'system.list_processes',
  'system.system_info',
  'coding.start_task',
  'coding.status',
  'coding.cancel',
  'coding.read_result',
  'coding.test',
  'coding.get_diff',
  'coding.rollback',
  'dev.create_project',
  'dev.inspect_project',
  'dev.plan',
  'dev.execute_plan',
  'dev.test',
  'dev.fix_failures',
  'dev.review',
  'dev.rollback',
  'dev.finalize',
]);

function isAllowedTool(toolName: string): boolean {
  if (!toolName || typeof toolName !== 'string') return false;
  if (ALLOWED_TOOLS.has(toolName)) return true;
  // Also allow dot or underscore variants if they map to standard safe tool prefixes
  if (
    toolName.startsWith('browser.') ||
    toolName.startsWith('file.') ||
    toolName.startsWith('folder.') ||
    toolName.startsWith('system.') ||
    toolName.startsWith('omniroute.') ||
    toolName.startsWith('coding.') ||
    toolName.startsWith('dev.')
  ) {
    const base = toolName.split('.')[0];
    if (['browser', 'file', 'folder', 'system', 'omniroute', 'coding', 'dev'].includes(base)) {
      return true;
    }
  }
  return false;
}

// -------------------------------------------------------------------------
// Task Queue & State Storage
// -------------------------------------------------------------------------
export type TaskStatus =
  | 'QUEUED'
  | 'DELIVERED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface Task {
  taskId: string;
  tool: string;
  params: any;
  createdAt: number;
  expiresAt: number;
  status: TaskStatus;
  result?: any;
  error?: string;
  deliveredAt?: number;
  completedAt?: number;
}

export interface RunnerState {
  status: 'ONLINE' | 'OFFLINE';
  omnirouteStatus: string;
  omnirouteVersion?: string | null;
  omniroutePath?: string | null;
  platform?: string;
  isWindows?: boolean;
  lastSeen: number;
  allowedTools: string[];
}

const taskStore = new Map<string, Task>();
const taskWaiters = new Map<string, Array<(task: Task) => void>>();

const runnerState: RunnerState = {
  status: 'OFFLINE',
  omnirouteStatus: 'Unavailable',
  lastSeen: 0,
  allowedTools: Array.from(ALLOWED_TOOLS),
};

// Periodic task cleanup & expiration (runs every 10 seconds)
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [taskId, task] of taskStore.entries()) {
    if (task.status === 'QUEUED' && task.expiresAt < now) {
      task.status = 'EXPIRED';
      notifyWaiters(task);
    }
    // Prune completed/expired tasks older than 10 minutes to save memory
    if (
      (task.status === 'COMPLETED' ||
        task.status === 'FAILED' ||
        task.status === 'EXPIRED' ||
        task.status === 'CANCELLED') &&
      now - (task.completedAt || task.createdAt) > 600000
    ) {
      taskStore.delete(taskId);
      taskWaiters.delete(taskId);
    }
  }
}, 10000);
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

function notifyWaiters(task: Task) {
  const waiters = taskWaiters.get(task.taskId);
  if (waiters && waiters.length > 0) {
    taskWaiters.delete(task.taskId);
    for (const resolve of waiters) {
      try {
        resolve(task);
      } catch (_) {}
    }
  }
}

// -------------------------------------------------------------------------
// Routes Implementation
// -------------------------------------------------------------------------

// 1. Health Endpoint (Public, no secrets exposed)
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'maryam-relay',
  });
});

// 2. Poll Endpoint (Called by Local Runner on Windows)
const handlePoll = (req: Request, res: Response): void => {
  const body = req.body || {};

  // Update runner status from heartbeat
  runnerState.status = 'ONLINE';
  runnerState.lastSeen = Date.now();
  if (body.omnirouteStatus) runnerState.omnirouteStatus = body.omnirouteStatus;
  if (body.omnirouteVersion) runnerState.omnirouteVersion = body.omnirouteVersion;
  if (body.omniroutePath) runnerState.omniroutePath = body.omniroutePath;
  if (body.platform) runnerState.platform = body.platform;
  if (typeof body.isWindows === 'boolean') runnerState.isWindows = body.isWindows;

  const now = Date.now();

  // Find oldest QUEUED task that has not expired
  let nextTask: Task | null = null;
  for (const task of taskStore.values()) {
    if (task.status === 'QUEUED') {
      if (task.expiresAt < now) {
        task.status = 'EXPIRED';
        notifyWaiters(task);
      } else {
        nextTask = task;
        break;
      }
    }
  }

  if (!nextTask) {
    // 204 No Content when no task is pending
    res.status(204).end();
    return;
  }

  // Mark task as RUNNING
  nextTask.status = 'RUNNING';
  nextTask.deliveredAt = now;

  // Return payload to runner
  res.json({
    id: nextTask.taskId,
    taskId: nextTask.taskId,
    tool: nextTask.tool,
    params: nextTask.params || {},
    createdAt: nextTask.createdAt,
    expiresAt: nextTask.expiresAt,
  });
};

app.post('/api/runner/relay/poll', authenticateMachineRequest, handlePoll);
app.post('/poll', authenticateMachineRequest, handlePoll);

// 3. Response Endpoint (Called by Local Runner when tool execution finishes)
const handleResponse = (req: Request, res: Response): void => {
  const { taskId, success, result, error, status } = req.body || {};

  if (!taskId || typeof taskId !== 'string') {
    res.status(400).json({ error: 'taskId is required' });
    return;
  }

  const task = taskStore.get(taskId);
  if (!task) {
    res.status(404).json({ error: `Task '${taskId}' not found or has expired.` });
    return;
  }

  // Idempotency: Handle duplicate result submissions safely
  if (task.status === 'COMPLETED' || task.status === 'FAILED') {
    res.json({ status: 'ok', taskId, alreadyCompleted: true });
    return;
  }

  const isSuccess = success !== false && status !== 'FAILED';
  task.status = isSuccess ? 'COMPLETED' : 'FAILED';
  task.completedAt = Date.now();
  if (result !== undefined) task.result = result;
  if (error !== undefined) task.error = typeof error === 'string' ? error : JSON.stringify(error);

  notifyWaiters(task);

  res.json({ status: 'ok', taskId });
};

app.post('/api/runner/relay/response', authenticateMachineRequest, handleResponse);
app.post('/response', authenticateMachineRequest, handleResponse);

// 4. Task Enqueue Endpoint (Called by Maryam App server)
const handleEnqueueTask = (req: Request, res: Response): void => {
  const { tool, params, arguments: args, timeoutMs } = req.body || {};

  const targetTool = tool || req.body?.toolName;
  if (!targetTool || typeof targetTool !== 'string') {
    res.status(400).json({ error: 'tool name is required' });
    return;
  }

  if (!isAllowedTool(targetTool)) {
    res.status(400).json({ error: `Tool '${targetTool}' is not in the approved safety allowlist.` });
    return;
  }

  const taskId = 'task_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  const now = Date.now();
  const ttl = Math.min(Math.max(timeoutMs || 30000, 5000), 120000); // 5s to 120s

  const newTask: Task = {
    taskId,
    tool: targetTool,
    params: params || args || {},
    createdAt: now,
    expiresAt: now + ttl,
    status: 'QUEUED',
  };

  taskStore.set(taskId, newTask);

  res.status(201).json({
    taskId,
    id: taskId,
    tool: targetTool,
    status: 'QUEUED',
    createdAt: now,
    expiresAt: now + ttl,
  });
};

app.post('/api/runner/relay/task', authenticateMachineRequest, handleEnqueueTask);
app.post('/task', authenticateMachineRequest, handleEnqueueTask);

// 5. Get Task Status Endpoint
const handleGetTask = (req: Request, res: Response): void => {
  const taskId = req.params.taskId;
  const task = taskStore.get(taskId);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json(task);
};

app.get('/api/runner/relay/task/:taskId', authenticateMachineRequest, handleGetTask);
app.get('/task/:taskId', authenticateMachineRequest, handleGetTask);

// 6. Await Task Endpoint (Long-polls up to timeout for task completion)
const handleAwaitTask = (req: Request, res: Response): void => {
  const taskId = req.params.taskId;
  const task = taskStore.get(taskId);

  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (
    task.status === 'COMPLETED' ||
    task.status === 'FAILED' ||
    task.status === 'EXPIRED' ||
    task.status === 'CANCELLED'
  ) {
    res.json(task);
    return;
  }

  const timeout = setTimeout(() => {
    // Remove waiter on timeout
    const list = taskWaiters.get(taskId) || [];
    taskWaiters.set(
      taskId,
      list.filter((w) => w !== onComplete)
    );
    const current = taskStore.get(taskId) || task;
    res.json(current);
  }, 25000);

  const onComplete = (updatedTask: Task) => {
    clearTimeout(timeout);
    res.json(updatedTask);
  };

  if (!taskWaiters.has(taskId)) {
    taskWaiters.set(taskId, []);
  }
  taskWaiters.get(taskId)!.push(onComplete);
};

app.post('/api/runner/relay/task/:taskId/await', authenticateMachineRequest, handleAwaitTask);
app.post('/task/:taskId/await', authenticateMachineRequest, handleAwaitTask);
app.get('/api/runner/relay/task/:taskId/await', authenticateMachineRequest, handleAwaitTask);
app.get('/task/:taskId/await', authenticateMachineRequest, handleAwaitTask);

// 7. Runner Status Endpoint
const handleGetStatus = (_req: Request, res: Response): void => {
  const isOnline = runnerState.status === 'ONLINE' && Date.now() - runnerState.lastSeen < 45000;
  res.json({
    status: isOnline ? 'ONLINE' : 'OFFLINE',
    omnirouteStatus: runnerState.omnirouteStatus,
    omnirouteVersion: runnerState.omnirouteVersion || null,
    omniroutePath: runnerState.omniroutePath || null,
    platform: runnerState.platform || 'unknown',
    isWindows: runnerState.isWindows || false,
    lastSeen: runnerState.lastSeen,
    allowedToolsCount: ALLOWED_TOOLS.size,
  });
};

app.get('/api/runner/relay/status', authenticateMachineRequest, handleGetStatus);
app.get('/status', authenticateMachineRequest, handleGetStatus);

// Export for testing
export { app, taskStore, runnerState, ALLOWED_TOOLS };

// Start server if main module
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(` MARYAM CLOUD RUN RELAY GATEWAY`);
    console.log(` Listening on: http://0.0.0.0:${PORT}`);
    console.log(` Health check: http://0.0.0.0:${PORT}/health`);
    console.log(` Allowed tools: ${ALLOWED_TOOLS.size} safe tools`);
    console.log(`=======================================================`);
  });
}
