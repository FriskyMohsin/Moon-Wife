export type EmotionState = 
  | 'Normal'
  | 'Happy'
  | 'Affectionate'
  | 'Playful'
  | 'Concerned'
  | 'Excited'
  | 'Focused';

export type VoiceState = 'Idle' | 'Listening' | 'Thinking' | 'Speaking';

export interface UserProfile {
  name: string;
  preferredNickname: string;
  role: string;
  language: string;
  timezone?: string;
  [key: string]: string | undefined;
}

export type MemoryCategoryKey = 
  | 'preferences'
  | 'importantPeople'
  | 'personalFacts'
  | 'relationshipMemories'
  | 'projects'
  | 'importantDecisions'
  | 'conversationSummaries';

export interface MemoryBank {
  userProfile: UserProfile;
  preferences: string[];
  importantPeople: string[];
  personalFacts: string[];
  relationshipMemories: string[];
  projects: string[];
  importantDecisions: string[];
  conversationSummaries: string[];
  recentContext: string[]; // Kept separate from long-term memory
}

export interface MemoryUpdateResult {
  action: 'add' | 'update' | 'none';
  category?: MemoryCategoryKey | 'userProfile';
  text?: string;
  replacesExisting?: string;
  reason?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'maryam';
  text: string;
  timestamp: number;
  emotion?: EmotionState;
  audioBase64?: string;
  isStreaming?: boolean;
}

export type GeminiVoiceName = 'Aoede' | 'Kore' | 'Zephyr' | 'Puck' | 'Fenrir' | 'Charon';

export type WakeSensitivity = 'strict' | 'balanced' | 'sensitive';
export type WakeWordStatus = 'idle' | 'waiting' | 'detected' | 'active' | 'unsupported' | 'error';
export type MicPermissionStatus = 'granted' | 'prompt' | 'denied' | 'unknown';

export interface AppSettings {
  voiceName: GeminiVoiceName;
  enableWakeWord: boolean;
  wakePhrase: string;
  wakeSensitivity: WakeSensitivity;
  autoSpeakText: boolean;
  bargeInEnabled: boolean;
}

export interface ToolPipelineStage {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'modular_staged' | 'future';
  details: string;
}

export interface TimingDiagnostics {
  speechInputLatencyMs: number | null;
  geminiResponseStartLatencyMs: number | null;
  memoryRetrievalTimeMs: number | null;
  memoryWriteTimeMs: number | null;
  lastUpdated: number;
}

export interface VisionDiagnostics {
  CAMERA_STATE: 'ON' | 'OFF';
  MEDIA_STREAM_ACTIVE: boolean;
  VIDEO_WIDTH: number;
  VIDEO_HEIGHT: number;
  VISION_INTENT_DETECTED: boolean;
  FRAME_BYTES: number;
  VISION_API_CALLED: boolean;
  VISION_HTTP_STATUS: number | string;
  VISION_RESULT_PREVIEW: string;
  VISION_CONTEXT_INJECTED_TO_MARYAM: boolean;
  VISION_ERROR: string | null;
}

export interface MemoryDiagnosticsState {
  userIdentity: string;
  sessionId: string;
  lastWriteStatus: 'SUCCESS' | 'FAILED' | 'IDLE';
  lastWriteCategory: string | null;
  lastWriteTimestamp: number | null;
  lastWriteLatencyMs: number | null;
  lastWriteError: string | null;
  retrievedCount: number;
  injectedIntoGemini: boolean;
  memorySource: 'Core' | 'Recent Conversation' | 'Core + Recent' | 'None';
  retrievalLatencyMs: number | null;
  retrievedCategories: string[];
}

export type RunnerConnectionStatus = 
  | 'ONLINE' 
  | 'OFFLINE' 
  | 'Local Runner Connected' 
  | 'Local Runner Offline';

export type OmniRouteConnectionStatus = 
  | 'Ready' 
  | 'Unavailable' 
  | 'OmniRoute Available' 
  | 'OmniRoute Unavailable';

export interface LocalRunnerState {
  runnerStatus: RunnerConnectionStatus;
  omnirouteStatus: OmniRouteConnectionStatus;
  isWindows: boolean;
  platform?: string;
  nodeVersion?: string;
  omniroutePath?: string | null;
  omnirouteVersion?: string | null;
  browserAutomationReady?: boolean;
  allowedTools?: string[];
  activeTab?: { title: string; url: string } | null;
  lastChecked?: number;
  connectionMethod?: 'direct' | 'relay' | 'none';
  errorMessage?: string | null;
}

export const isRunnerOnline = (status?: string): boolean => 
  status === 'ONLINE' || status === 'Local Runner Connected';

export const isOmniRouteReady = (status?: string): boolean => 
  status === 'Ready' || status === 'OmniRoute Available';

