/**
 * src/lib/taskScheduler.ts
 *
 * Maryam Authoritative Task Scheduler & Lifecycle Execution Engine.
 * Manages background task scheduling, double-execution locking, approval gates,
 * IANA timezone conversion, real execution dispatch, and lifecycle state transitions:
 * SCHEDULED -> QUEUED -> RUNNING -> COMPLETED / FAILED / NEEDS_APPROVAL / PAUSED / CANCELLED.
 */

import crypto from 'crypto';
import {
  getAllTasks,
  getAllTaskRuns,
  calculateNextRun,
  getTaskDetails,
} from './scheduledTasksManager';
import { resolveDataPath } from './runtimePaths';
import { readJsonSafeSync, writeJsonAtomicSync } from './dataPersistence';
import { ScheduledTask, TaskRunHistory } from '../types/taskManagement';

const TASKS_FILE = resolveDataPath('hoorvia_platform', 'scheduled_tasks.json');
const RUNS_FILE = resolveDataPath('hoorvia_platform', 'task_runs.json');

// In-memory execution locks to prevent double-execution across ticks
const activeLocks = new Map<string, { lockedAt: number; runId: string }>();
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minute lock TTL

let schedulerTimer: NodeJS.Timeout | null = null;
let isEvaluating = false;

function isLocked(taskId: string): boolean {
  const lock = activeLocks.get(taskId);
  if (!lock) return false;
  if (Date.now() - lock.lockedAt > LOCK_TIMEOUT_MS) {
    activeLocks.delete(taskId);
    return false;
  }
  return true;
}

function acquireLock(taskId: string, runId: string): boolean {
  if (isLocked(taskId)) return false;
  activeLocks.set(taskId, { lockedAt: Date.now(), runId });
  return true;
}

function releaseLock(taskId: string): void {
  activeLocks.delete(taskId);
}

function saveTasks(tasks: ScheduledTask[]): void {
  writeJsonAtomicSync(TASKS_FILE, tasks);
}

function saveRuns(runs: TaskRunHistory[]): void {
  writeJsonAtomicSync(RUNS_FILE, runs);
}

/**
 * Converts local scheduled time in a given IANA timezone (e.g. Asia/Riyadh)
 * to a canonical UTC ISO string.
 */
export function convertLocalTimeToUTC(
  dateStr: string,
  timeStr: string,
  ianaTimezone: string = 'Asia/Riyadh'
): string {
  try {
    const [hours, minutes] = (timeStr || '09:00').split(':').map((v) => parseInt(v, 10) || 0);
    const [year, month, day] = (dateStr || new Date().toISOString().split('T')[0])
      .split('-')
      .map((v) => parseInt(v, 10));

    // Construct approximate UTC date
    const utcCandidate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));

    // Format in target timezone to find offset difference
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = dtf.formatToParts(utcCandidate);
    const tzYear = parseInt(parts.find((p) => p.type === 'year')?.value || '0', 10);
    const tzMonth = parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10);
    const tzDay = parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10);
    const tzHour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const tzMinute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);

    const tzDateAsUTC = new Date(Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0, 0));
    const offsetMs = tzDateAsUTC.getTime() - utcCandidate.getTime();

    // The real UTC time corresponds to candidate minus offset
    const realUTC = new Date(utcCandidate.getTime() - offsetMs);
    return realUTC.toISOString();
  } catch (err) {
    // Fallback to standard Date parsing if timezone format invalid
    const [hours, minutes] = (timeStr || '09:00').split(':').map((v) => parseInt(v, 10) || 0);
    const [y, m, d] = dateStr.split('-').map((v) => parseInt(v, 10));
    return new Date(y, m - 1, d, hours, minutes, 0, 0).toISOString();
  }
}

export interface TaskExecutionResult {
  runId: string;
  taskId: string;
  status: 'COMPLETED' | 'FAILED' | 'NEEDS_APPROVAL' | 'CANCELLED';
  summary: string;
  error?: string | null;
  durationMs: number;
}

/**
 * Executes a specific task's instructions using real execution dispatch.
 * Handles approval gates and updates task state accordingly.
 */
export async function executeTask(
  taskId: string,
  options: { manualTrigger?: boolean; preApproved?: boolean } = {}
): Promise<TaskExecutionResult> {
  const tasks = getAllTasks();
  const taskIndex = tasks.findIndex((t) => t.task_id === taskId);
  if (taskIndex === -1) {
    throw new Error(`Task ${taskId} not found.`);
  }

  const task = tasks[taskIndex];

  if (task.status === 'PAUSED' && !options.manualTrigger) {
    return {
      runId: `run_skip_${Date.now()}`,
      taskId,
      status: 'CANCELLED',
      summary: `Task is PAUSED. Skipped scheduled trigger.`,
      durationMs: 0,
    };
  }

  // Approval Gate: If approval_mode is 'ask_owner' and not pre-approved, transition to NEEDS_APPROVAL
  if (task.approval_mode === 'ask_owner' && !options.preApproved && !options.manualTrigger) {
    task.status = 'NEEDS_APPROVAL';
    task.progress = 'Awaiting owner authorization';
    task.updated_at = new Date().toISOString();
    tasks[taskIndex] = task;
    saveTasks(tasks);

    return {
      runId: `run_pending_${Date.now()}`,
      taskId,
      status: 'NEEDS_APPROVAL',
      summary: `Task requires owner approval before execution. Marked as NEEDS_APPROVAL.`,
      durationMs: 0,
    };
  }

  const runId = `run_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  if (!acquireLock(taskId, runId)) {
    return {
      runId,
      taskId,
      status: 'FAILED',
      summary: `Task is already locked in an active run. Double execution prevented.`,
      durationMs: 0,
    };
  }

  const startTime = Date.now();
  const startedAtIso = new Date(startTime).toISOString();

  // Update task status to RUNNING
  task.status = 'IN PROGRESS';
  task.progress = 'Executing real automated workflow';
  task.updated_at = startedAtIso;
  tasks[taskIndex] = task;
  saveTasks(tasks);

  let runStatus: 'COMPLETED' | 'FAILED' | 'NEEDS_APPROVAL' = 'COMPLETED';
  let summary = '';
  let errorMsg: string | null = null;
  let realOutput: TaskRunHistory['output'] = null;

  try {
    // REAL EXECUTION DISPATCH through the executor pipeline (never simulated).
    const { executeTaskInstructions, getTaskToolExecutor } = await import('./taskExecutor');
    const real = await executeTaskInstructions(task, getTaskToolExecutor(), {
      preApproved: options.preApproved || options.manualTrigger,
    });
    summary = real.result_summary;
    realOutput = real.output || null;
    if (real.success) {
      runStatus = 'COMPLETED';
    } else if (real.needsApproval) {
      runStatus = 'NEEDS_APPROVAL';
      errorMsg = real.needsApproval.reason || 'Owner approval required.';
    } else {
      runStatus = 'FAILED';
      errorMsg = real.error || 'Execution failed.';
    }
  } catch (err: any) {
    runStatus = 'FAILED';
    errorMsg = err.message || 'Unknown execution error';
    summary = `Execution failed: ${errorMsg}`;
  } finally {
    releaseLock(taskId);
  }

  const finishedAt = Date.now();
  const durationMs = finishedAt - startTime;
  const finishedAtIso = new Date(finishedAt).toISOString();

  // Create real run history entry
  const runEntry: TaskRunHistory = {
    run_id: runId,
    task_id: taskId,
    task_name: task.task_name,
    started_at: startedAtIso,
    finished_at: finishedAtIso,
    status: runStatus,
    result_summary: summary,
    error: errorMsg,
    duration_ms: durationMs,
    output: realOutput,
  };

  const runs = getAllTaskRuns();
  runs.unshift(runEntry);
  saveRuns(runs);

  // Advance task state
  task.last_run_at = finishedAtIso;
  task.execution_count = (task.execution_count || 0) + 1;
  task.latest_result = summary;
  task.latest_error = runStatus === 'COMPLETED' ? null : errorMsg;
  task.latest_output = realOutput;
  task.progress = runStatus === 'COMPLETED' ? 'Idle' : runStatus === 'NEEDS_APPROVAL' ? 'Awaiting owner approval' : 'Failed';
  task.updated_at = finishedAtIso;

  if (runStatus === 'NEEDS_APPROVAL') {
    task.status = 'NEEDS_APPROVAL';
    task.next_run_at = null;
  } else if (task.task_type === 'one_time') {
    task.status = runStatus === 'COMPLETED' ? 'COMPLETED' : 'FAILED';
    task.next_run_at = null;
  } else {
    // Recurring tasks stay on schedule; each run is recorded honestly.
    task.status = 'SCHEDULED';
    task.next_run_at = calculateNextRun(task.task_type, task.schedule, new Date(finishedAt));
  }

  tasks[taskIndex] = task;
  saveTasks(tasks);

  // Owner notification fan-out (Telegram): COMPLETED / FAILED / BLOCKED.
  try {
    const { emitTaskEvent } = await import('./taskNotify');
    emitTaskEvent({
      kind: runStatus,
      taskId,
      taskName: task.task_name,
      summary,
      error: errorMsg,
      outputPath: realOutput?.output_path || null,
      outputUrl: realOutput?.output_url || null,
      at: finishedAtIso,
    });
  } catch (_) {}

  return {
    runId,
    taskId,
    status: runStatus,
    summary,
    error: errorMsg,
    durationMs,
  };
}

/**
 * Evaluates all due scheduled tasks and executes them safely.
 */
export async function evaluateScheduledTasks(): Promise<TaskExecutionResult[]> {
  if (isEvaluating) return [];
  isEvaluating = true;

  const results: TaskExecutionResult[] = [];
  try {
    const tasks = getAllTasks();
    const now = new Date();

    for (const task of tasks) {
      if (task.status !== 'SCHEDULED') continue;
      if (!task.next_run_at) continue;

      const nextRun = new Date(task.next_run_at);
      if (nextRun <= now) {
        console.log(`[TaskScheduler] Triggering due task: ${task.task_id} ("${task.task_name}")`);
        try {
          const res = await executeTask(task.task_id);
          results.push(res);
        } catch (err: any) {
          console.error(`[TaskScheduler] Error executing task ${task.task_id}:`, err);
        }
      }
    }
  } finally {
    isEvaluating = false;
  }

  return results;
}

/**
 * Approves a task currently in NEEDS_APPROVAL state and triggers execution.
 */
export async function approveTaskExecution(taskId: string): Promise<TaskExecutionResult> {
  const tasks = getAllTasks();
  const task = tasks.find((t) => t.task_id === taskId);
  if (!task) throw new Error(`Task ${taskId} not found.`);

  return await executeTask(taskId, { preApproved: true, manualTrigger: true });
}

/**
 * Starts the background evaluation loop (default every 30 seconds).
 */
export function startTaskScheduler(intervalMs: number = 30000): void {
  if (schedulerTimer) return;
  console.log(`[TaskScheduler] Initializing lifecycle task scheduler (interval: ${intervalMs}ms)...`);

  // Initial evaluation tick
  evaluateScheduledTasks().catch((err) => console.error('[TaskScheduler] Initial tick error:', err));

  schedulerTimer = setInterval(() => {
    evaluateScheduledTasks().catch((err) => console.error('[TaskScheduler] Tick error:', err));
  }, intervalMs);
}

/**
 * Stops the background task scheduler.
 */
export function stopTaskScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log('[TaskScheduler] Stopped background scheduler.');
  }
}

export function getSchedulerStatus(): {
  running: boolean;
  activeLocksCount: number;
  activeLocks: string[];
} {
  return {
    running: schedulerTimer !== null,
    activeLocksCount: activeLocks.size,
    activeLocks: Array.from(activeLocks.keys()),
  };
}
