/**
 * Modular interfaces for future Tool Runner & Task Router execution pipeline.
 * Pipeline architecture:
 * Mohsin -> Maryam -> Gemini -> Task Router -> Local Tool Runner -> OmniRoute CLI -> Build and Test -> Maryam reports verified result
 *
 * NOTE: These interfaces are structural architectural contracts ready for integration,
 * not faked mock runners.
 */

export interface TaskRouteRequest {
  id: string;
  sourceUserId: string; // "Mohsin"
  rawInstruction: string;
  contextMemories: string[];
  suggestedActionType: 'conversation' | 'code_generation' | 'apk_build' | 'debugging' | 'git_ops' | 'terminal_ops';
}

export interface TaskRouteResult {
  routeId: string;
  isExecutableToolTask: boolean;
  toolTarget?: 'OmniRouteCLI' | 'AndroidBuilder' | 'GitRunner' | 'TerminalExecutor';
  payloadParameters?: Record<string, unknown>;
  maryamPreambleUrdu: string;
}

export interface LocalToolRunnerConfig {
  workingDirectory: string;
  allowTerminalExecution: boolean;
  maxExecutionTimeoutSeconds: number;
  environmentVariables: Record<string, string>;
}

export interface ToolExecutionReport {
  executionId: string;
  toolName: string;
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  maryamSummaryMessage: string;
  timestamp: number;
}

export interface IToolRunner {
  canHandle(taskType: string): boolean;
  validateSafety(instruction: string): Promise<boolean>;
  executeTask(params: TaskRouteResult): Promise<ToolExecutionReport>;
}
