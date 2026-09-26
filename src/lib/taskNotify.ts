/**
 * src/lib/taskNotify.ts
 *
 * Single task-event fan-out for owner notifications (Telegram channel).
 * The engine emits; server.ts wires the Telegram sender. No import cycles:
 * this module depends on nothing.
 */

export type TaskEventKind = 'COMPLETED' | 'FAILED' | 'NEEDS_APPROVAL';

export interface TaskEvent {
  kind: TaskEventKind;
  taskId: string;
  taskName: string;
  summary: string | null;
  error: string | null;
  outputPath: string | null;
  outputUrl: string | null;
  at: string;
}

type TaskEventNotifier = (event: TaskEvent) => void;

let notifier: TaskEventNotifier | null = null;

/** Wired once by server.ts to the existing Telegram integration. */
export function setTaskEventNotifier(fn: TaskEventNotifier): void {
  notifier = fn;
}

export function emitTaskEvent(event: TaskEvent): void {
  try {
    if (notifier) notifier(event);
  } catch {
    // Notifications must never break task execution.
  }
}
