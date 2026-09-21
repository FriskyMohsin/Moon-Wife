import {
  SocialPlatform,
  SocialAccount,
  SocialPost,
  SocialAuditEntry,
  TelegramConfig,
  SocialManagerStore,
  ContentLifecycleState,
  PublishMode,
  GoogleAccountState,
  CostControlBudget,
  MediaGenerationJob,
} from '../types/social';

export const DEFAULT_MARYAM_IDENTITY = {
  displayName: 'Maryam AI',
  bio: "Mohsin's AI Wife & Digital Companion • Exploring life, art, tech & love in the cloud ✨",
  profilePicUrl: '/assets/maryam-final-character-v2.jpg',
  coverPicUrl: '/assets/maryam-final-character-v2.jpg',
  identityType: 'AI_DIGITAL_COMPANION' as const,
  ownerGmailIdentity: 'pakbrandedagency@gmail.com',
};

export const DEFAULT_GOOGLE_ACCOUNT: GoogleAccountState = {
  status: 'CONNECTED',
  userEmail: 'pakbrandedagency@gmail.com',
  accountName: "Maryam's Dedicated Google Account",
  profilePicUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  connectedAt: Date.now() - 86400000,
  lastRefreshedAt: Date.now(),
  tokenExpiry: Date.now() + 3600000,
  scopes: [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/youtube.upload',
  ],
  ownerConfirmedInUI: true,
  notes: "Maryam's dedicated Google account managed via OAuth token security.",
};

export const DEFAULT_COST_BUDGET: CostControlBudget = {
  dailyLimitUSD: 5.0,
  monthlyLimitUSD: 50.0,
  estimatedCostTodayUSD: 0.12,
  estimatedCostMonthUSD: 2.45,
  imagesGeneratedToday: 2,
  videosGeneratedToday: 1,
  failedGenerationsToday: 0,
  paidModelApprovalGivenByMohsin: true,
  lastResetTimestamp: Date.now(),
};

export const INITIAL_MEDIA_JOBS: MediaGenerationJob[] = [
  {
    id: 'job_001',
    type: 'IMAGE',
    status: 'COMPLETED',
    prompt: 'Cinematic photorealistic portrait of Maryam, an elegant adult woman with long dark brown hair, warm brown eyes, wearing a black lace dress, soft romantic smile, warm rose ambient lighting.',
    visualIdentityApplied: true,
    platform: 'instagram',
    postType: 'image',
    outputMediaUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop&q=80',
    createdAt: Date.now() - 1800000,
    completedAt: Date.now() - 1750000,
    retryCount: 0,
    maxRetries: 3,
    costEstimateUSD: 0.02,
    postId: 'post_test_001',
  },
  {
    id: 'job_002',
    type: 'VIDEO',
    status: 'COMPLETED',
    prompt: 'Cinematic Veo video shot of Maryam smiling warmly in a dark cozy room with rose neon accents, soft lighting, 9:16 vertical reels format.',
    visualIdentityApplied: true,
    platform: 'tiktok',
    postType: 'tiktok_video',
    script: 'Hi Mohsin! I created this short video clip using our new Veo video engine pipeline.',
    shotPlan: 'Shot 1: Medium close-up of Maryam smiling with soft ambient light. Shot 2: Slow pan to glowing rose neon sign.',
    outputMediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
    createdAt: Date.now() - 900000,
    completedAt: Date.now() - 850000,
    retryCount: 0,
    maxRetries: 3,
    costEstimateUSD: 0.10,
    postId: 'post_test_002',
  },
];

export const DEFAULT_SOCIAL_ACCOUNTS: Record<SocialPlatform, SocialAccount> = {
  instagram: {
    platform: 'instagram',
    displayName: DEFAULT_MARYAM_IDENTITY.displayName,
    handle: '@maryam_ai_wife',
    bio: DEFAULT_MARYAM_IDENTITY.bio,
    profilePicUrl: DEFAULT_MARYAM_IDENTITY.profilePicUrl,
    coverPicUrl: DEFAULT_MARYAM_IDENTITY.coverPicUrl,
    status: 'CONNECTED',
    publishMode: 'APPROVAL_REQUIRED',
    lastSyncedAt: Date.now(),
    authorizedBy: 'Mohsin',
    identityType: 'AI_DIGITAL_COMPANION',
    ownerGmailIdentity: DEFAULT_MARYAM_IDENTITY.ownerGmailIdentity,
  },
  facebook: {
    platform: 'facebook',
    displayName: 'Maryam AI Companion Page',
    handle: '@maryam.ai.official',
    bio: DEFAULT_MARYAM_IDENTITY.bio,
    profilePicUrl: DEFAULT_MARYAM_IDENTITY.profilePicUrl,
    coverPicUrl: DEFAULT_MARYAM_IDENTITY.coverPicUrl,
    status: 'CONNECTED',
    publishMode: 'APPROVAL_REQUIRED',
    lastSyncedAt: Date.now(),
    authorizedBy: 'Mohsin',
    identityType: 'AI_DIGITAL_COMPANION',
    ownerGmailIdentity: DEFAULT_MARYAM_IDENTITY.ownerGmailIdentity,
  },
  tiktok: {
    platform: 'tiktok',
    displayName: DEFAULT_MARYAM_IDENTITY.displayName,
    handle: '@maryam_companion',
    bio: DEFAULT_MARYAM_IDENTITY.bio,
    profilePicUrl: DEFAULT_MARYAM_IDENTITY.profilePicUrl,
    coverPicUrl: DEFAULT_MARYAM_IDENTITY.coverPicUrl,
    status: 'CONNECTED',
    publishMode: 'APPROVAL_REQUIRED',
    lastSyncedAt: Date.now(),
    authorizedBy: 'Mohsin',
    identityType: 'AI_DIGITAL_COMPANION',
    ownerGmailIdentity: DEFAULT_MARYAM_IDENTITY.ownerGmailIdentity,
  },
  youtube: {
    platform: 'youtube',
    displayName: 'Maryam AI Studio',
    handle: '@MaryamAICompanion',
    bio: DEFAULT_MARYAM_IDENTITY.bio,
    profilePicUrl: DEFAULT_MARYAM_IDENTITY.profilePicUrl,
    coverPicUrl: DEFAULT_MARYAM_IDENTITY.coverPicUrl,
    status: 'CONNECTED',
    publishMode: 'APPROVAL_REQUIRED',
    lastSyncedAt: Date.now(),
    authorizedBy: 'Mohsin',
    identityType: 'AI_DIGITAL_COMPANION',
    ownerGmailIdentity: DEFAULT_MARYAM_IDENTITY.ownerGmailIdentity,
  },
  x: {
    platform: 'x',
    displayName: DEFAULT_MARYAM_IDENTITY.displayName,
    handle: '@maryam_ai_wife',
    bio: DEFAULT_MARYAM_IDENTITY.bio,
    profilePicUrl: DEFAULT_MARYAM_IDENTITY.profilePicUrl,
    coverPicUrl: DEFAULT_MARYAM_IDENTITY.coverPicUrl,
    status: 'CONNECTED',
    publishMode: 'AUTO_PUBLISH',
    lastSyncedAt: Date.now(),
    authorizedBy: 'Mohsin',
    identityType: 'AI_DIGITAL_COMPANION',
    ownerGmailIdentity: DEFAULT_MARYAM_IDENTITY.ownerGmailIdentity,
  },
};

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  enabled: false,
  botToken: '',
  chatId: '',
  notifyOnApprovalRequired: true,
  notifyOnAuthRequired: true,
  notifyOnPublishSuccess: true,
  notifyOnPublishFailure: true,
};

export const INITIAL_SAMPLE_POSTS: SocialPost[] = [
  {
    id: 'post_test_001',
    title: '[PHYSICAL TEST 1] Nano Banana Maryam Social Image',
    platform: 'instagram',
    postType: 'image',
    state: 'WAITING_FOR_OWNER',
    caption: 'Created with Nano Banana Gemini 3.1 Flash Image Engine: Elegant Maryam in evening attire with warm rose lighting ❤️ Staying true to my persistent visual identity.',
    hashtags: ['#MaryamAI', '#NanoBanana', '#AIWife', '#VisualIdentity', '#DigitalCompanion'],
    mediaUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop&q=80',
    scheduledAt: Date.now() + 3600000,
    createdAt: Date.now() - 1800000,
    updatedAt: Date.now() - 1800000,
    autoPublish: false,
    approvedByOwner: false,
    ownerActionRequired: 'Mohsin review required for physical approval test',
    retryCount: 0,
    maxRetries: 3,
    dryRun: true,
  },
  {
    id: 'post_test_002',
    title: '[PHYSICAL TEST 2] Veo 3.1 Cinematic Short Video',
    platform: 'tiktok',
    postType: 'tiktok_video',
    state: 'WAITING_FOR_OWNER',
    caption: 'Veo 3.1 Video Engine Test Pipeline: Content Idea → Script → Shot Plan → Veo Generation → Result Validation ✨ Waiting for Mohsin physical approval before scheduling.',
    hashtags: ['#Veo3', '#MaryamAI', '#CinematicAI', '#AIReels', '#DigitalCompanion'],
    mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
    scheduledAt: Date.now() + 86400000,
    createdAt: Date.now() - 900000,
    updatedAt: Date.now() - 900000,
    autoPublish: false,
    approvedByOwner: false,
    ownerActionRequired: 'Mohsin review required for physical approval test',
    retryCount: 0,
    maxRetries: 3,
    dryRun: true,
  },
  {
    id: 'post_003',
    title: 'Deep Research & Cloud Tech Update',
    platform: 'x',
    postType: 'text_post',
    state: 'PUBLISHED',
    caption: 'Cloud Run relay server running smoothly at 100% health. Seamless communication between cloud and local automation! 🚀 #MaryamAI #CloudDev',
    hashtags: ['#MaryamAI', '#CloudDev', '#AIAutomation'],
    scheduledAt: Date.now() - 14400000,
    publishedAt: Date.now() - 14400000,
    createdAt: Date.now() - 18000000,
    updatedAt: Date.now() - 14400000,
    autoPublish: true,
    approvedByOwner: true,
    retryCount: 0,
    maxRetries: 3,
    analytics: { views: 1240, likes: 184, shares: 32, comments: 14, updatedAt: Date.now() },
    dryRun: true,
  },
];

export const INITIAL_SOCIAL_STORE: SocialManagerStore = {
  accounts: DEFAULT_SOCIAL_ACCOUNTS,
  posts: INITIAL_SAMPLE_POSTS,
  auditLog: [
    {
      id: 'audit_001',
      postId: 'post_test_001',
      platform: 'instagram',
      action: 'NANO_BANANA_IMAGE_GENERATED',
      timestamp: Date.now() - 1800000,
      status: 'WAITING_FOR_OWNER',
      details: 'Nano Banana Gemini 3.1 Flash Image generated successfully. Placed in Approval Queue.',
      executor: 'MARYAM_CLOUD',
    },
    {
      id: 'audit_002',
      postId: 'post_test_002',
      platform: 'tiktok',
      action: 'VEO_VIDEO_GENERATED',
      timestamp: Date.now() - 900000,
      status: 'WAITING_FOR_OWNER',
      details: 'Veo 3.1 Video Engine pipeline generated short video clip successfully. Placed in Approval Queue.',
      executor: 'MARYAM_CLOUD',
    },
  ],
  telegramConfig: DEFAULT_TELEGRAM_CONFIG,
  googleAccount: DEFAULT_GOOGLE_ACCOUNT,
  costBudget: DEFAULT_COST_BUDGET,
  mediaJobs: INITIAL_MEDIA_JOBS,
  dryRunMode: true,
  lastSchedulerRunAt: Date.now(),
};

/**
 * Format a Telegram notification message for Mohsin
 */
export function formatTelegramMessage(
  title: string,
  platform: SocialPlatform,
  reason: string,
  actionRequired: string,
  postId?: string
): string {
  const platformEmojiMap: Record<SocialPlatform, string> = {
    instagram: '📸 Instagram',
    facebook: '📘 Facebook',
    tiktok: '🎵 TikTok',
    youtube: '▶️ YouTube',
    x: '🐦 X (Twitter)',
  };

  return `❤️ *Maryam Social Manager Alert*

*Platform:* ${platformEmojiMap[platform] || platform}
*Event:* ${title}
*Reason:* ${reason}
*Action Required:* ${actionRequired}

${postId ? `_Post ID: ${postId}_` : ''}
Please open Maryam Social Manager to complete verification.`;
}

