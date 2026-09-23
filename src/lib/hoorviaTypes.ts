// --- HOORVIA SHARED TYPES & CLIENT-SAFE DEFINITIONS ---
// Pure TypeScript types and helpers (No Node.js dependencies: fs, path, crypto)

export type UserRole = 'owner' | 'user';

export type CompanionType =
  | 'girlfriend'
  | 'boyfriend'
  | 'teacher'
  | 'helper'
  | 'support'
  | 'study_partner'
  | 'custom'
  | 'health_info_assistant'
  | 'finance_edu_assistant'
  | 'trading_edu_assistant'
  | string;

export type CompanionGender = 'female' | 'male' | 'nonbinary' | 'neutral';

export type CompanionVoice = 'Aoede' | 'Charon' | 'Fenrir' | 'Kore' | 'Puck' | 'Zephyr';

export type CompanionTone =
  | 'Romantic'
  | 'Friendly'
  | 'Professional'
  | 'Educational'
  | 'Playful'
  | 'Formal';

export const HOORVIA_TONES: CompanionTone[] = [
  'Romantic',
  'Friendly',
  'Professional',
  'Educational',
  'Playful',
  'Formal',
];

export type UserCapabilityId =
  // WEB
  | 'web_search'
  | 'web_browsing'
  | 'deep_research'
  // MEDIA
  | 'image_generation'
  | 'video_generation'
  // SOCIAL
  | 'social_content'
  | 'social_accounts'
  | 'social_scheduling'
  | 'social_publishing'
  // PRODUCTIVITY
  | 'docs'
  | 'pdfs'
  | 'spreadsheets'
  | 'presentations'
  // OTHER
  | 'text_chat'
  | 'live_voice'
  | 'memory'
  | 'file_analysis'
  | 'coding_assistant'
  | 'automations'
  | 'telegram_integration';

export type AccessPackId =
  | 'Basic'
  | 'Creator'
  | 'Researcher'
  | 'Social Manager'
  | 'Developer'
  | 'Custom';

export type CapabilityCategory = 'WEB' | 'MEDIA' | 'SOCIAL' | 'PRODUCTIVITY' | 'OTHER';

export interface CapabilityDefinition {
  id: UserCapabilityId;
  name: string;
  category: CapabilityCategory;
  description: string;
  defaultState: boolean;
}

export const ALL_CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  // WEB
  { id: 'web_search', name: 'Web Search', category: 'WEB', description: 'Query live search indexes and retrieve up-to-date web information.', defaultState: true },
  { id: 'web_browsing', name: 'Web Browsing', category: 'WEB', description: 'Live web scraping, webpage extraction, and real-time site navigation.', defaultState: false },
  { id: 'deep_research', name: 'Deep Research', category: 'WEB', description: 'Multi-source synthesis, recursive topic investigation, and academic synthesis.', defaultState: false },

  // MEDIA
  { id: 'image_generation', name: 'Image Generation', category: 'MEDIA', description: 'Generate high-fidelity AI artwork, avatars, and visual assets.', defaultState: true },
  { id: 'video_generation', name: 'Video Generation / Google Flow', category: 'MEDIA', description: 'Produce AI video clips, motion animations, and cinematic scenes.', defaultState: false },

  // SOCIAL
  { id: 'social_content', name: 'Social Content Generation', category: 'SOCIAL', description: 'Generate viral tweets, LinkedIn posts, threads, and captions.', defaultState: false },
  { id: 'social_accounts', name: 'Account Connection', category: 'SOCIAL', description: 'Connect external social media profiles and channels securely.', defaultState: false },
  { id: 'social_scheduling', name: 'Scheduling', category: 'SOCIAL', description: 'Calendar and queue automated social post releases.', defaultState: false },
  { id: 'social_publishing', name: 'Publishing', category: 'SOCIAL', description: 'Publish approved drafts directly to connected social feeds.', defaultState: false },

  // PRODUCTIVITY
  { id: 'docs', name: 'Documents', category: 'PRODUCTIVITY', description: 'Draft, parse, and edit formatted documents and markdown reports.', defaultState: true },
  { id: 'pdfs', name: 'PDFs', category: 'PRODUCTIVITY', description: 'Analyze, parse, and extract structured data from PDF documents.', defaultState: true },
  { id: 'spreadsheets', name: 'Spreadsheets', category: 'PRODUCTIVITY', description: 'Synthesize formulas, parse CSV/XLSX, and run table analysis.', defaultState: false },
  { id: 'presentations', name: 'Presentations', category: 'PRODUCTIVITY', description: 'Structure slide decks, speaker notes, and presentation outlines.', defaultState: false },

  // OTHER
  { id: 'text_chat', name: 'Text Chat', category: 'OTHER', description: 'Interactive multimodal conversational dialogue with the AI companion.', defaultState: true },
  { id: 'live_voice', name: 'Live Voice', category: 'OTHER', description: 'Bidirectional low-latency real-time voice streaming with Gemini.', defaultState: true },
  { id: 'memory', name: 'Memory', category: 'OTHER', description: 'Persistent long-term memory extraction and cross-session recall.', defaultState: true },
  { id: 'file_analysis', name: 'File Analysis', category: 'OTHER', description: 'Multi-format file upload inspection, parsing, and context feeding.', defaultState: false },
  { id: 'coding_assistant', name: 'Coding Assistant', category: 'OTHER', description: 'Code generation, debugging, refactoring, and test writing.', defaultState: false },
  { id: 'automations', name: 'Automations', category: 'OTHER', description: 'Trigger webhooks, custom workflows, and automated pipeline execution.', defaultState: false },
  { id: 'telegram_integration', name: 'Telegram Integration', category: 'OTHER', description: 'Connect companion to Telegram bot for mobile remote access.', defaultState: false },
];

export const ALL_CAPABILITY_IDS: UserCapabilityId[] = ALL_CAPABILITY_DEFINITIONS.map(d => d.id);

export const DEFAULT_PLATFORM_CAPABILITIES: Record<UserCapabilityId, boolean> = ALL_CAPABILITY_DEFINITIONS.reduce(
  (acc, def) => {
    acc[def.id] = def.defaultState;
    return acc;
  },
  {} as Record<UserCapabilityId, boolean>
);

export const ACCESS_PACK_DEFINITIONS: Record<AccessPackId, { name: string; description: string; capabilities: Record<UserCapabilityId, boolean> }> = {
  Basic: {
    name: 'Basic',
    description: 'Essential conversational companion with text chat, persistent memory, web search, and docs.',
    capabilities: {
      web_search: true,
      web_browsing: false,
      deep_research: false,
      image_generation: false,
      video_generation: false,
      social_content: false,
      social_accounts: false,
      social_scheduling: false,
      social_publishing: false,
      docs: true,
      pdfs: false,
      spreadsheets: false,
      presentations: false,
      text_chat: true,
      live_voice: false,
      memory: true,
      file_analysis: false,
      coding_assistant: false,
      automations: false,
      telegram_integration: false,
    },
  },
  Creator: {
    name: 'Creator',
    description: 'Rich media creation pack with image/video generation, social content, scheduling, live voice, and browsing.',
    capabilities: {
      web_search: true,
      web_browsing: true,
      deep_research: false,
      image_generation: true,
      video_generation: true,
      social_content: true,
      social_accounts: false,
      social_scheduling: true,
      social_publishing: true,
      docs: true,
      pdfs: true,
      spreadsheets: false,
      presentations: true,
      text_chat: true,
      live_voice: true,
      memory: true,
      file_analysis: true,
      coding_assistant: false,
      automations: false,
      telegram_integration: false,
    },
  },
  Researcher: {
    name: 'Researcher',
    description: 'In-depth analysis suite with web browsing, deep research, PDFs, spreadsheets, and file analysis.',
    capabilities: {
      web_search: true,
      web_browsing: true,
      deep_research: true,
      image_generation: false,
      video_generation: false,
      social_content: false,
      social_accounts: false,
      social_scheduling: false,
      social_publishing: false,
      docs: true,
      pdfs: true,
      spreadsheets: true,
      presentations: true,
      text_chat: true,
      live_voice: true,
      memory: true,
      file_analysis: true,
      coding_assistant: false,
      automations: false,
      telegram_integration: false,
    },
  },
  'Social Manager': {
    name: 'Social Manager',
    description: 'End-to-end social media publishing, content drafting, scheduling, and multi-platform account sync.',
    capabilities: {
      web_search: true,
      web_browsing: true,
      deep_research: false,
      image_generation: true,
      video_generation: false,
      social_content: true,
      social_accounts: true,
      social_scheduling: true,
      social_publishing: true,
      docs: true,
      pdfs: false,
      spreadsheets: true,
      presentations: false,
      text_chat: true,
      live_voice: true,
      memory: true,
      file_analysis: true,
      coding_assistant: false,
      automations: true,
      telegram_integration: true,
    },
  },
  Developer: {
    name: 'Developer',
    description: 'Technical assistant with coding capabilities, automations, file analysis, web research, and voice.',
    capabilities: {
      web_search: true,
      web_browsing: true,
      deep_research: true,
      image_generation: false,
      video_generation: false,
      social_content: false,
      social_accounts: false,
      social_scheduling: false,
      social_publishing: false,
      docs: true,
      pdfs: true,
      spreadsheets: true,
      presentations: false,
      text_chat: true,
      live_voice: true,
      memory: true,
      file_analysis: true,
      coding_assistant: true,
      automations: true,
      telegram_integration: false,
    },
  },
  Custom: {
    name: 'Custom',
    description: 'Fine-grained granular entitlement configuration with tailored overrides per capability.',
    capabilities: { ...DEFAULT_PLATFORM_CAPABILITIES },
  },
};

/**
 * STRICT SECURITY HARD-CODED LIST:
 * These capabilities are NEVER grantable to any public user or non-owner role.
 */
export const FORBIDDEN_PUBLIC_CAPABILITIES = [
  'mohsin_local_runner',
  'mohsin_computer_files',
  'mohsin_private_browser',
  'mohsin_omniroute',
  'mohsin_core_memory',
  'maryam_private_data',
  'owner_admin',
  'owner_secrets',
] as const;

export interface PublicUser {
  id: string;
  email: string;
  passwordHash?: string;
  role: UserRole;
  name: string;
  createdAt: string;
  lastLogin?: string;
  lastActive?: string;
  isSuspended?: boolean;
  customEntitlements?: {
    allowLiveVoice?: boolean;
    allowTextChat?: boolean;
    enableMemory?: boolean;
    allowCompanionCustomization?: boolean;
    allowImageFeatures?: boolean;
    dailyRequestLimit?: number;
    maxLiveSessionMinutes?: number;
    accessPack?: AccessPackId;
    capabilitiesOverrides?: Partial<Record<UserCapabilityId, boolean>>;
  };
}

export interface CompanionProfile {
  id: string;
  userId: string;
  name: string;
  type: CompanionType;
  gender: CompanionGender;
  voice: CompanionVoice;
  language: string;
  autoMatchLanguage?: boolean;
  personality: string;
  communicationStyle: string;
  tone: CompanionTone;
  purpose: string;
  systemPrompt: string;
  updatedAt: string;
}

export interface UserMemoryItem {
  id: string;
  userId: string;
  companionId: string;
  fact: string;
  category: 'preference' | 'personal' | 'goal' | 'relationship' | 'general';
  createdAt: string;
}

export type ApiConnectionStatus = 'Connected' | 'Invalid' | 'Missing' | 'Disabled';

export type KeyValidationState =
  | 'API_KEY_VALID'
  | 'API_KEY_INVALID'
  | 'MODEL_UNAVAILABLE'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR';

export type DiagnosticClassification =
  | 'SUCCESS'
  | 'AUTHENTICATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'MODEL_NOT_FOUND'
  | 'MODEL_FREE_TIER_LIMIT_ZERO'
  | 'MODEL_QUOTA_UNAVAILABLE'
  | 'MODEL_RATE_LIMIT'
  | 'PROJECT_DAILY_QUOTA'
  | 'PROJECT_RATE_LIMIT'
  | 'PROVIDER_TEMPORARY_LIMIT'
  | 'PROVIDER_ERROR';

export interface ValidationDiagnostics {
  apiKeyAuth: 'PASS' | 'FAIL';
  modelsDiscovered: string[];
  modelsAttempted: string[];
  selectedModel: string | null;
  httpStatus: number | null;
  googleErrorStatus: string | null;
  googleErrorCode: number | string | null;
  googleErrorMessage: string | null;
  quotaMetric: string | null;
  quotaId: string | null;
  quotaValue: string | null;
  retryDelay: string | null;
  finalClassification: DiagnosticClassification;
  timestamp?: string;
}

export const PREFERRED_GEMINI_MODELS: string[] = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.5-flash',
  'gemini-3.1-pro-preview',
  'gemini-pro-latest',
  'gemini-2.5-pro',
  'gemini-1.5-pro',
];

export interface EncryptedCredential {
  userId: string;
  provider: 'gemini' | string;
  encryptedKey: string; // Hex ciphertext
  iv: string; // Hex
  tag: string; // Hex (authTag)
  keyMask: string;
  cryptoVersion?: string; // e.g. 'v2'
  algorithm?: string; // e.g. 'aes-256-gcm'
  masterKeyFingerprint?: string; // e.g. 'MK-CD728CF9'
  fingerprint?: string;
  status?: ApiConnectionStatus;
  keyValidationState?: KeyValidationState;
  selectedModel?: string;
  availableModels?: string[];
  accountTier?: string; // 'Unknown' if not explicitly provided
  addedAt?: string;
  lastValidatedAt?: string;
  lastUsedAt?: string;
  validationError?: string;
  lastDiagnostics?: ValidationDiagnostics;
  isDisabledByOwner?: boolean;
  totalRequests?: number;
  successfulRequests?: number;
  failedRequests?: number;
  updatedAt: string;
}

export interface LiveSessionDiagnostics {
  liveModel?: string;
  micPermission?: 'granted' | 'denied' | 'prompt' | 'unavailable';
  wsConnectionState?: 'connected' | 'failed' | 'disconnected';
  sessionStarted?: boolean;
  audioInputFrames?: number;
  audioOutputFrames?: number;
  clientAudioChunksSent?: number;
  clientAudioBytesSent?: number;
  geminiInputChunks?: number;
  geminiInputBytes?: number;
  geminiOutputAudioChunks?: number;
  geminiOutputAudioBytes?: number;
  browserAudioChunksForwarded?: number;
  browserAudioBytesForwarded?: number;
  durationSeconds?: number;
  disconnectReason?: string;
  httpOrApiStatus?: string | number;
  retryCount?: number;
  finalResult?: 'SUCCESS' | 'FAILED';
}

export interface ApiAuditLog {
  id: string;
  userId: string;
  timestamp: string;
  provider: string;
  model: string;
  initialModel?: string;
  failoverModel?: string;
  originalStatus?: string | number;
  retryCount?: number;
  companionName: string;
  credentialSource: 'USER_BYOK';
  maskedKey: string;
  fingerprint: string;
  status: 'Success' | 'Failed';
  ownerKeyUsed: false;
  errorMessage?: string;
  actionType?: 'chat' | 'profile_gen' | 'validation' | 'live_voice';
  liveDiagnostics?: LiveSessionDiagnostics;
}

export interface OwnerAdminUserView {
  // ACCOUNT DETAILS
  id: string;
  name: string;
  email: string;
  createdAt: string;
  accountStatus: 'Active' | 'Suspended';
  isSuspended: boolean;
  lastLogin: string;
  lastActive: string;
  companionName: string;
  companionType: string;
  companionLanguage: string;
  companionVoice: string;

  // AI PROVIDER DETAILS
  providerName: string;
  selectedModel: string;
  availableModels: string[];
  accountTier: string; // 'Unknown' unless explicitly provided
  keyValidationState: KeyValidationState;
  apiConnectionStatus: ApiConnectionStatus;
  credentialSource: 'USER_BYOK';
  maskedApiKey: string;
  safeCredentialFingerprint: string;
  apiKeyAddedDate: string;
  lastSuccessfulValidation: string;
  lastApiRequest: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  isDisabledByOwner: boolean;
  validationError?: string;
  lastDiagnostics?: ValidationDiagnostics;
  ownerKeyUsed: false;

  // USAGE DETAILS
  requestsToday: number;
  liveMinutesToday: number;
  recentAuditLogs: ApiAuditLog[];

  // ENTITLEMENT OVERRIDES & CAPABILITIES
  customEntitlements?: PublicUser['customEntitlements'];
  effectiveCapabilities: Record<UserCapabilityId, boolean>;
  capabilityOverrides: Partial<Record<UserCapabilityId, boolean>>;
  accessPack: AccessPackId;
}

export interface AdminAuditEntry {
  id: string;
  adminId: string;
  adminEmail: string;
  action:
    | 'suspend_user'
    | 'restore_user'
    | 'update_entitlements'
    | 'disable_ai'
    | 'enable_ai'
    | 'update_policy'
    | 'validate_user_key'
    | 'adjust_quota'
    | 'reveal_byok_key'
    | 'update_byok_key'
    | 'revoke_byok_key'
    | 'reset_user_password';
  targetUserId?: string;
  targetUserEmail?: string;
  details: string;
  timestamp: string;
}

export interface PlatformOverviewStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalCompanions: number;
  activeSessions: number;
  byokSummary: {
    connected: number;
    invalid: number;
    missing: number;
    disabled: number;
  };
  usageSummary: {
    totalRequestsToday: number;
    totalLiveMinutesToday: number;
  };
  recentRegistrations: Array<{
    id: string;
    email: string;
    name: string;
    createdAt: string;
    isSuspended: boolean;
    companionName: string;
    byokStatus: ApiConnectionStatus;
  }>;
  recentActivity: Array<{
    id: string;
    type: 'admin' | 'api';
    timestamp: string;
    title: string;
    description: string;
    status: 'success' | 'warning' | 'error' | 'info';
  }>;
  systemHealth: {
    uptimeSeconds: number;
    uptimeFormatted: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    memoryRssMb: number;
    memoryHeapUsedMb: number;
    memoryHeapTotalMb: number;
    masterKeyFingerprint: string;
    cryptoAlgorithm: string;
    totalCredentialsStored: number;
    geminiServerKeyConfigured: boolean;
    localRunnerIsolated: boolean;
    localRunnerStatus: string;
  };
  policy: PlatformPolicy;
}

export interface PlatformPolicy {
  allowRegistration: boolean;
  maintenanceMode: boolean;
  enableTextChat: boolean;
  enableLiveVoice: boolean;
  enableMemory: boolean;
  requireBYOK: boolean;
  freeTierDailyLimit: number;
  maxLiveSessionMinutes: number;
  globalAnnouncement: string;
  allowedCompanionTypes: CompanionType[];
  defaultCapabilities: Record<UserCapabilityId, boolean>;
}

export interface UserUsageRecord {
  userId: string;
  dateStr: string; // YYYY-MM-DD
  requestCount: number;
  liveMinutesUsed: number;
  lastActive: string;
}

/**
 * Technical lock checker: Mohsin's private Maryam companion is locked to prevent override.
 */
export function isMohsinMaryam(userId?: string, companionId?: string): boolean {
  if (!userId && !companionId) return false;
  return userId === 'usr_mohsin_owner' || companionId === 'comp_mohsin_maryam';
}
