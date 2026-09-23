export type TaskType = 'one_time' | 'daily' | 'weekly' | 'monthly' | 'custom';
export type TaskPriority = 'normal' | 'high' | 'critical';
export type TaskApprovalMode = 'automatic' | 'ask_owner';
export type TaskStatus = 'SCHEDULED' | 'PENDING' | 'IN PROGRESS' | 'COMPLETED' | 'FAILED' | 'PAUSED' | 'CANCELLED';

export interface TaskScheduleConfig {
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  deadline?: string; // Optional deadline for one-time task (YYYY-MM-DD)
  endDate?: string; // Optional end date for recurring (YYYY-MM-DD)
  daysOfWeek?: string[]; // e.g. ['monday', 'friday'] for weekly
  dayOfMonth?: number; // 1-31 for monthly
  customInterval?: number; // e.g. 2
  customUnit?: 'days' | 'weeks'; // e.g. 'days' or 'weeks'
  customDays?: string[];
}

export interface ScheduledTask {
  task_id: string;
  owner_user_id: string; // 'usr_mohsin_owner'
  task_name: string;
  instructions: string;
  task_type: TaskType;
  schedule: TaskScheduleConfig;
  priority: TaskPriority;
  approval_mode: TaskApprovalMode;
  resources?: {
    websiteUrl?: string;
    notes?: string;
  };
  created_at: string;
  updated_at: string;
  next_run_at: string | null;
  last_run_at: string | null;
  status: TaskStatus;
  progress: string; // Real execution progress string, e.g. 'Idle', 'Scheduled', 'Running', 'Completed', 'Failed', 'Paused'
  latest_result: string | null;
  latest_error: string | null;
  execution_count: number;
}

export interface TaskRunHistory {
  run_id: string;
  task_id: string;
  task_name: string;
  started_at: string;
  finished_at: string | null;
  status: 'IN PROGRESS' | 'COMPLETED' | 'FAILED';
  result_summary: string | null;
  error: string | null;
  duration_ms?: number;
}

export interface TaskSummaryCounts {
  total: number;
  scheduled: number;
  in_progress: number;
  completed: number;
  failed: number;
  paused: number;
}

// Connectivity types
export type ConnectionState = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'NEEDS AUTHENTICATION' | 'NOT CONFIGURED' | 'CHECKING';

export interface IntegrationHealthInfo {
  id: string;
  name: string;
  category: 'channel' | 'runner' | 'memory' | 'communication';
  status: ConnectionState;
  accountLabel: string;
  lastSuccessfulConnection: string | null;
  lastChecked: string;
  healthSummary: string;
  details?: Record<string, any>;
  supportedActions: ('TEST_CONNECTION' | 'CONNECT' | 'RECONNECT' | 'DISCONNECT')[];
}
