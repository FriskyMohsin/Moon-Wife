export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'x';

export type PostType = 'image' | 'short_video' | 'reels' | 'tiktok_video' | 'youtube_shorts' | 'story' | 'text_post';

export type ContentLifecycleState =
  | 'IDEA'
  | 'RESEARCHED'
  | 'DRAFT'
  | 'MEDIA_READY'
  | 'REVIEW'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'WAITING_FOR_OWNER'
  | 'FAILED'
  | 'CANCELLED';

export type PublishMode = 'APPROVAL_REQUIRED' | 'AUTO_PUBLISH';

export type AccountAuthStatus = 'CONNECTED' | 'AUTH_REQUIRED' | 'DISCONNECTED' | 'WAITING_FOR_OWNER';

export type FailureCategory =
  | 'TEMPORARY'
  | 'AUTH_REQUIRED'
  | 'OWNER_REQUIRED'
  | 'PLATFORM_ERROR'
  | 'CONTENT_ERROR'
  | 'RATE_LIMITED'
  | 'PERMANENT_FAILURE';

export interface SocialAccount {
  platform: SocialPlatform;
  displayName: string;
  handle: string;
  bio: string;
  profilePicUrl: string;
  coverPicUrl?: string;
  status: AccountAuthStatus;
  publishMode: PublishMode;
  lastSyncedAt: number;
  authorizedBy: string;
  identityType: 'AI_DIGITAL_COMPANION';
  ownerGmailIdentity: string;
}

export interface PostAnalytics {
  views: number;
  likes: number;
  shares: number;
  comments: number;
  updatedAt: number;
}

export interface SocialPost {
  id: string;
  title: string;
  platform: SocialPlatform;
  postType: PostType;
  state: ContentLifecycleState;
  caption: string;
  hashtags: string[];
  mediaUrl?: string;
  thumbnailUrl?: string;
  scheduledAt: number;
  publishedAt?: number;
  createdAt: number;
  updatedAt: number;
  autoPublish: boolean;
  approvedByOwner: boolean;
  approvedAt?: number;
  failureReason?: string;
  failureCategory?: FailureCategory;
  ownerActionRequired?: string;
  interruptedStep?: string;
  retryCount: number;
  maxRetries: number;
  analytics?: PostAnalytics;
  dryRun: boolean;
}

export interface SocialAuditEntry {
  id: string;
  postId?: string;
  platform: SocialPlatform;
  action: string;
  timestamp: number;
  status: 'SUCCESS' | 'WAITING_FOR_OWNER' | 'FAILED' | 'INFO';
  details: string;
  executor: 'MARYAM_CLOUD' | 'OWNER_MOHSIN' | 'LOCAL_RUNNER';
}

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  notifyOnApprovalRequired: boolean;
  notifyOnAuthRequired: boolean;
  notifyOnPublishSuccess: boolean;
  notifyOnPublishFailure: boolean;
  lastNotificationSentAt?: number;
}

export type GoogleOAuthStatus =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'TOKEN_REFRESH'
  | 'REAUTH_REQUIRED'
  | 'WAITING_FOR_OWNER';

export interface GoogleAccountState {
  status: GoogleOAuthStatus;
  userEmail: string;
  accountName: string;
  profilePicUrl?: string;
  connectedAt?: number;
  lastRefreshedAt?: number;
  tokenExpiry?: number;
  scopes: string[];
  ownerConfirmedInUI: boolean;
  notes?: string;
}

export type MediaJobStatus = 'QUEUED' | 'GENERATING' | 'COMPLETED' | 'FAILED' | 'WAITING_FOR_OWNER';

export interface MediaGenerationJob {
  id: string;
  type: 'IMAGE' | 'VIDEO';
  status: MediaJobStatus;
  prompt: string;
  visualIdentityApplied: boolean;
  platform: SocialPlatform;
  postType: PostType;
  script?: string;
  shotPlan?: string;
  referenceImageUrl?: string;
  outputMediaUrl?: string;
  thumbnailUrl?: string;
  operationName?: string;
  createdAt: number;
  completedAt?: number;
  retryCount: number;
  maxRetries: number;
  error?: string;
  costEstimateUSD: number;
  postId?: string;
}

export interface CostControlBudget {
  dailyLimitUSD: number;
  monthlyLimitUSD: number;
  estimatedCostTodayUSD: number;
  estimatedCostMonthUSD: number;
  imagesGeneratedToday: number;
  videosGeneratedToday: number;
  failedGenerationsToday: number;
  paidModelApprovalGivenByMohsin: boolean;
  lastResetTimestamp: number;
}

export interface SocialManagerStore {
  accounts: Record<SocialPlatform, SocialAccount>;
  posts: SocialPost[];
  auditLog: SocialAuditEntry[];
  telegramConfig: TelegramConfig;
  googleAccount: GoogleAccountState;
  costBudget: CostControlBudget;
  mediaJobs: MediaGenerationJob[];
  dryRunMode: boolean;
  lastSchedulerRunAt: number;
}

