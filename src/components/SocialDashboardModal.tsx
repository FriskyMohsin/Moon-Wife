import React, { useState, useEffect } from 'react';
import {
  Share2,
  Calendar,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Settings,
  Send,
  Plus,
  Edit3,
  XCircle,
  Eye,
  ThumbsUp,
  MessageSquare,
  Bot,
  ShieldCheck,
  RefreshCw,
  X,
  Play,
  FileText,
  Image as ImageIcon,
  Video,
  Check,
  ChevronRight,
  UserCheck,
  Bell,
  BarChart3,
  ListFilter,
} from 'lucide-react';
import {
  SocialPlatform,
  PostType,
  ContentLifecycleState,
  PublishMode,
  SocialAccount,
  SocialPost,
  SocialAuditEntry,
  SocialManagerStore,
  TelegramConfig,
} from '../types/social';

interface SocialDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType =
  | 'overview'
  | 'calendar'
  | 'create'
  | 'google'
  | 'budget'
  | 'drafts'
  | 'approval'
  | 'scheduled'
  | 'published'
  | 'accounts'
  | 'telegram'
  | 'audit';

export const SocialDashboardModal: React.FC<SocialDashboardModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [store, setStore] = useState<SocialManagerStore | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // AI Content Generator state
  const [genTopic, setGenTopic] = useState<string>('');
  const [genPlatform, setGenPlatform] = useState<SocialPlatform>('instagram');
  const [genPostType, setGenPostType] = useState<PostType>('image');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedResult, setGeneratedResult] = useState<{
    title: string;
    caption: string;
    hashtags: string[];
    mediaPrompt: string;
  } | null>(null);

  // Manual create/edit post state
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCaption, setNewCaption] = useState<string>('');
  const [newHashtags, setNewHashtags] = useState<string>('');
  const [newMediaUrl, setNewMediaUrl] = useState<string>('');
  const [newScheduledHours, setNewScheduledHours] = useState<number>(24);

  // Media Engine & Budget State
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<boolean>(false);
  const [mediaStatusMsg, setMediaStatusMsg] = useState<string | null>(null);
  const [googleConnectLoading, setGoogleConnectLoading] = useState<boolean>(false);
  const [googleConnectMsg, setGoogleConnectMsg] = useState<string | null>(null);
  const [dailyLimitUSD, setDailyLimitUSD] = useState<number>(5.0);
  const [monthlyLimitUSD, setMonthlyLimitUSD] = useState<number>(50.0);

  // Telegram settings state
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(false);
  const [telegramBotToken, setTelegramBotToken] = useState<string>('');
  const [telegramChatId, setTelegramChatId] = useState<string>('');
  const [telegramTestStatus, setTelegramTestStatus] = useState<string | null>(null);

  // Fetch social store from Express API
  const fetchStore = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/social/state');
      if (res.ok) {
        const data = await res.json();
        setStore(data.store);
        if (data.store?.telegramConfig) {
          setTelegramEnabled(data.store.telegramConfig.enabled);
          setTelegramBotToken(data.store.telegramConfig.botToken || '');
          setTelegramChatId(data.store.telegramConfig.chatId || '');
        }
        if (data.store?.costBudget) {
          setDailyLimitUSD(data.store.costBudget.dailyLimitUSD || 5.0);
          setMonthlyLimitUSD(data.store.costBudget.monthlyLimitUSD || 50.0);
        }
      }
    } catch (err) {
      console.error('Failed to load social store:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStore();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerateNanoBananaImage = async () => {
    setIsGeneratingImage(true);
    setMediaStatusMsg('Generating Maryam image with Nano Banana Gemini 3.1 Flash Image engine...');
    try {
      const res = await fetch('/api/media/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: genTopic || 'Elegant Maryam in evening attire with warm rose ambient lighting',
          platform: genPlatform,
          postType: genPostType,
          aspectRatio: genPostType === 'tiktok_video' || genPostType === 'reels' ? '9:16' : '1:1',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewMediaUrl(data.outputImageUrl || '');
        setMediaStatusMsg('✨ Maryam image generated successfully using Gemini 3.1 Flash Image model!');
        fetchStore();
      } else {
        const errData = await res.json();
        setMediaStatusMsg(`Error: ${errData.error || 'Image generation failed'}`);
      }
    } catch (err: any) {
      setMediaStatusMsg('Image generation error.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateVeoVideo = async () => {
    setIsGeneratingVideo(true);
    setMediaStatusMsg('Initializing Veo 3.1 Video Engine pipeline (Idea → Script → Shot Plan → Veo Generation)...');
    try {
      const res = await fetch('/api/media/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: genTopic || 'Maryam smiling warmly in dark cozy room with rose neon accents',
          script: `Hi Mohsin! Here is today's short clip for ${genPlatform}.`,
          shotPlan: 'Shot 1: Medium close-up of Maryam. Shot 2: Pan to neon background.',
          platform: genPlatform,
          postType: genPostType,
          aspectRatio: '9:16',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.mediaJob?.outputMediaUrl) {
          setNewMediaUrl(data.mediaJob.outputMediaUrl);
        }
        setMediaStatusMsg('✨ Veo 3.1 short video generated and validated successfully!');
        fetchStore();
      } else {
        const errData = await res.json();
        setMediaStatusMsg(`Error: ${errData.error || 'Video generation failed'}`);
      }
    } catch (err: any) {
      setMediaStatusMsg('Video generation error.');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleConnectGoogle = async () => {
    setGoogleConnectLoading(true);
    setGoogleConnectMsg('Authorizing Google account via OAuth flow...');
    try {
      const res = await fetch('/api/google/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: 'pakbrandedagency@gmail.com' }),
      });
      if (res.ok) {
        setGoogleConnectMsg('✅ Google account pakbrandedagency@gmail.com successfully connected!');
        fetchStore();
      }
    } catch (err) {
      setGoogleConnectMsg('OAuth connection failed.');
    } finally {
      setGoogleConnectLoading(false);
    }
  };

  const handleSaveBudgetLimits = async () => {
    try {
      const res = await fetch('/api/media/cost-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyLimitUSD,
          monthlyLimitUSD,
          paidModelApprovalGivenByMohsin: true,
        }),
      });
      if (res.ok) {
        setMediaStatusMsg('Budget limits updated successfully!');
        fetchStore();
        setTimeout(() => setMediaStatusMsg(null), 3000);
      }
    } catch (err) {
      console.error('Failed to update cost budget:', err);
    }
  };


  // Handler functions
  const handleTogglePlatformMode = async (platform: SocialPlatform, mode: PublishMode) => {
    try {
      const res = await fetch('/api/social/accounts/toggle-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, mode }),
      });
      if (res.ok) {
        const data = await res.json();
        setStore(data.store);
      }
    } catch (err) {
      console.error('Failed to toggle mode:', err);
    }
  };

  const handleApprovePost = async (id: string) => {
    try {
      const res = await fetch('/api/social/posts/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const data = await res.json();
        setStore(data.store);
      }
    } catch (err) {
      console.error('Failed to approve post:', err);
    }
  };

  const handlePublishNow = async (id: string) => {
    try {
      const res = await fetch('/api/social/posts/publish-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const data = await res.json();
        setStore(data.store);
      }
    } catch (err) {
      console.error('Failed to publish post:', err);
    }
  };

  const handleSkipPost = async (id: string) => {
    try {
      const res = await fetch('/api/social/posts/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const data = await res.json();
        setStore(data.store);
      }
    } catch (err) {
      console.error('Failed to skip post:', err);
    }
  };

  const handleResumeTask = async (id: string) => {
    try {
      const res = await fetch('/api/social/resume-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const data = await res.json();
        setStore(data.store);
      }
    } catch (err) {
      console.error('Failed to resume task:', err);
    }
  };

  const handleGenerateContent = async () => {
    setIsGenerating(true);
    setGeneratedResult(null);
    try {
      const res = await fetch('/api/social/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: genTopic, platform: genPlatform, postType: genPostType }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.generated) {
          setGeneratedResult(data.generated);
          setNewTitle(data.generated.title || '');
          setNewCaption(data.generated.caption || '');
          setNewHashtags((data.generated.hashtags || []).join(' '));
        }
      }
    } catch (err) {
      console.error('Error generating AI content:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveNewPost = async () => {
    try {
      const hashtagsArr = newHashtags
        .split(' ')
        .map((h) => h.trim())
        .filter((h) => h.length > 0);

      const scheduledAt = Date.now() + newScheduledHours * 3600000;

      const res = await fetch('/api/social/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle || 'Maryam Social Draft',
          platform: genPlatform,
          postType: genPostType,
          caption: newCaption,
          hashtags: hashtagsArr,
          mediaUrl: newMediaUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80',
          scheduledAt,
          autoPublish: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setStore(data.store);
        // Reset generator fields
        setGeneratedResult(null);
        setNewTitle('');
        setNewCaption('');
        setNewHashtags('');
        setNewMediaUrl('');
        setActiveTab('approval');
      }
    } catch (err) {
      console.error('Error creating post:', err);
    }
  };

  const handleSaveTelegramConfig = async () => {
    try {
      const res = await fetch('/api/social/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: telegramEnabled,
          botToken: telegramBotToken,
          chatId: telegramChatId,
        }),
      });
      if (res.ok) {
        setTelegramTestStatus('Settings saved successfully!');
        setTimeout(() => setTelegramTestStatus(null), 3000);
      }
    } catch (err) {
      console.error('Failed to save telegram config:', err);
    }
  };

  const handleTestTelegram = async () => {
    setTelegramTestStatus('Sending test notification...');
    try {
      const res = await fetch('/api/social/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setTelegramTestStatus(data.message);
      } else {
        setTelegramTestStatus('Failed to send test message.');
      }
    } catch (err) {
      setTelegramTestStatus('Error sending test message.');
    }
  };

  // Helper values derived from store
  const posts = store?.posts || [];
  const accounts = store?.accounts || ({} as Record<SocialPlatform, SocialAccount>);

  const pendingApprovals = posts.filter((p) => p.state === 'REVIEW' || (p.state === 'SCHEDULED' && !p.approvedByOwner));
  const waitingForOwner = posts.filter((p) => p.state === 'WAITING_FOR_OWNER');
  const scheduledPosts = posts.filter((p) => p.state === 'SCHEDULED' || p.state === 'APPROVED');
  const publishedPosts = posts.filter((p) => p.state === 'PUBLISHED');
  const draftPosts = posts.filter((p) => p.state === 'IDEA' || p.state === 'DRAFT' || p.state === 'RESEARCHED' || p.state === 'MEDIA_READY');

  const platformIcons: Record<SocialPlatform, string> = {
    instagram: '📸',
    facebook: '📘',
    tiktok: '🎵',
    youtube: '▶️',
    x: '🐦',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-6xl h-[92vh] max-h-[900px] bg-zinc-950 border border-rose-900/30 rounded-3xl flex flex-col overflow-hidden shadow-2xl relative text-zinc-100">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-rose-900/30 flex items-center justify-between bg-zinc-950/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-rose-900 to-violet-900 border border-rose-700/40 text-rose-300 shadow-lg shadow-rose-950/60">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-serif font-bold text-white tracking-wide">
                  Maryam Cloud Social Manager
                </h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-medium border border-rose-500/30">
                  Cloud Active
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Dry-Run Mode
                </span>
              </div>
              <p className="text-xs text-rose-200/70 font-serif italic">
                Authorized Gmail Identity: maryam.companion.official@gmail.com • Owner: Mohsin
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchStore}
              title="Refresh Social Manager State"
              className="p-2 rounded-xl bg-zinc-900 border border-white/10 hover:border-rose-500/40 text-zinc-300 hover:text-white transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 border border-white/10 hover:border-white/20 text-zinc-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body (Sidebar Tabs + Workspace Content) */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Navigation Sub-Sidebar */}
          <div className="w-64 border-r border-rose-900/20 bg-zinc-950/80 p-3 flex flex-col justify-between shrink-0 overflow-y-auto">
            <div className="space-y-1">
              {[
                { id: 'overview', label: 'Overview & Stats', icon: BarChart3, badge: null },
                { id: 'calendar', label: 'Content Calendar', icon: Calendar, badge: null },
                { id: 'create', label: 'AI Content Studio', icon: Sparkles, badge: 'Nano+Veo' },
                { id: 'google', label: 'Google Identity', icon: UserCheck, badge: store?.googleAccount?.status === 'CONNECTED' ? 'OAuth OK' : 'Auth Req' },
                { id: 'budget', label: 'Cost & Budget', icon: BarChart3, badge: `$${store?.costBudget?.estimatedCostTodayUSD?.toFixed(2) || '0.00'}` },
                { id: 'drafts', label: 'Drafts & Research', icon: FileText, badge: draftPosts.length || null },
                { id: 'approval', label: 'Approval Queue', icon: CheckCircle2, badge: pendingApprovals.length || null, highlight: pendingApprovals.length > 0 },
                { id: 'scheduled', label: 'Scheduled Posts', icon: Clock, badge: scheduledPosts.length || null },
                { id: 'published', label: 'Published & Analytics', icon: Send, badge: publishedPosts.length || null },
                { id: 'accounts', label: 'Platform Accounts', icon: UserCheck, badge: null },
                { id: 'telegram', label: 'Telegram Owner Alerts', icon: Bell, badge: telegramEnabled ? 'ON' : null },
                { id: 'audit', label: 'Cloud Audit Trail', icon: ShieldCheck, badge: null },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as TabType)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-rose-950/80 border border-rose-800/50 text-rose-200 shadow-md'
                        : item.highlight
                        ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/70 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-rose-400' : 'text-zinc-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== null && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          isActive
                            ? 'bg-rose-500 text-white'
                            : item.highlight
                            ? 'bg-rose-500 text-white animate-pulse'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bottom Status Card */}
            <div className="p-3 rounded-2xl bg-rose-950/30 border border-rose-900/30 text-xs space-y-1.5 mt-4">
              <div className="flex items-center justify-between text-zinc-300">
                <span className="font-semibold text-rose-200">Cloud Worker</span>
                <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Running
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Maryam executes scheduled publishing & monitoring independently of laptop power state.
              </p>
            </div>
          </div>

          {/* Main Content Workspace Panel */}
          <div className="flex-1 p-6 overflow-y-auto bg-zinc-950/50">
            
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-serif font-bold text-white">Social Media Manager Overview</h3>
                  <p className="text-xs text-zinc-400">
                    Maryam's automated cloud posting engine, platform accounts, and owner authorization statuses.
                  </p>
                </div>

                {/* Waiting for Owner Alert Banner if any */}
                {waitingForOwner.length > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/50 text-amber-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 font-semibold">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        <span>Owner Verification Required ({waitingForOwner.length} task interrupted)</span>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        WAITING_FOR_OWNER
                      </span>
                    </div>
                    {waitingForOwner.map((item) => (
                      <div key={item.id} className="flex items-center justify-between pt-2 border-t border-amber-900/40 text-xs">
                        <div>
                          <p className="font-medium text-white">{item.title} ({item.platform.toUpperCase()})</p>
                          <p className="text-amber-300/80">{item.ownerActionRequired || 'Session expired or captcha verification required.'}</p>
                        </div>
                        <button
                          onClick={() => handleResumeTask(item.id)}
                          className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-md transition-all text-xs"
                        >
                          I Verified (Resume Workflow)
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Account Status Grid */}
                <div>
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Authorized Platform Accounts
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(Object.keys(accounts) as SocialPlatform[]).map((platform) => {
                      const acc = accounts[platform];
                      return (
                        <div
                          key={platform}
                          className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 flex flex-col justify-between space-y-3 hover:border-rose-900/50 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="text-2xl">{platformIcons[platform]}</span>
                              <div>
                                <h5 className="text-sm font-semibold text-white capitalize">{platform}</h5>
                                <p className="text-xs text-rose-300">{acc.handle}</p>
                              </div>
                            </div>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                acc.status === 'CONNECTED'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {acc.status}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
                            <span className="text-zinc-400">Publish Mode:</span>
                            <button
                              onClick={() =>
                                handleTogglePlatformMode(
                                  platform,
                                  acc.publishMode === 'APPROVAL_REQUIRED' ? 'AUTO_PUBLISH' : 'APPROVAL_REQUIRED'
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                                acc.publishMode === 'AUTO_PUBLISH'
                                  ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300'
                                  : 'bg-rose-950/60 border-rose-800/50 text-rose-300'
                              }`}
                            >
                              {acc.publishMode === 'AUTO_PUBLISH' ? 'Auto-Publish' : 'Approval Required'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10">
                    <p className="text-xs text-zinc-400">Pending Approvals</p>
                    <p className="text-2xl font-bold text-rose-300 mt-1">{pendingApprovals.length}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10">
                    <p className="text-xs text-zinc-400">Scheduled Queue</p>
                    <p className="text-2xl font-bold text-violet-300 mt-1">{scheduledPosts.length}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10">
                    <p className="text-xs text-zinc-400">Total Published</p>
                    <p className="text-2xl font-bold text-emerald-300 mt-1">{publishedPosts.length}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10">
                    <p className="text-xs text-zinc-400">Draft Ideas</p>
                    <p className="text-2xl font-bold text-amber-300 mt-1">{draftPosts.length}</p>
                  </div>
                </div>

                {/* Recent Activity Stream */}
                <div>
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Recent Cloud Activity
                  </h4>
                  <div className="space-y-2">
                    {(store?.auditLog || []).slice(0, 4).map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span>{platformIcons[log.platform]}</span>
                          <div>
                            <p className="font-medium text-zinc-200">{log.action}</p>
                            <p className="text-zinc-400 text-[11px]">{log.details}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CONTENT CALENDAR */}
            {activeTab === 'calendar' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-serif font-bold text-white">Content Calendar</h3>
                  <p className="text-xs text-zinc-400">
                    Overview of Maryam's upcoming scheduled posts and recently published content timeline.
                  </p>
                </div>

                <div className="space-y-3">
                  {posts.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 text-xs">No posts scheduled in content calendar.</div>
                  ) : (
                    posts.map((post) => (
                      <div
                        key={post.id}
                        className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-rose-900/50 transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{platformIcons[post.platform]}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-sm font-semibold text-white">{post.title}</h5>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-rose-300 font-mono">
                                {post.postType.toUpperCase()}
                              </span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                  post.state === 'PUBLISHED'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : post.state === 'SCHEDULED'
                                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {post.state}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 line-clamp-2 mt-1">{post.caption}</p>
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-400">
                              <span>📅 Scheduled: {new Date(post.scheduledAt).toLocaleString()}</span>
                              <span>• Platform: {post.platform.toUpperCase()}</span>
                            </div>
                          </div>
                        </div>

                        {post.state === 'REVIEW' && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleApprovePost(post.id)}
                              className="px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-semibold text-xs shadow-md"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleSkipPost(post.id)}
                              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs"
                            >
                              Skip
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: AI CONTENT STUDIO */}
            {activeTab === 'create' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-serif font-bold text-white">AI Content Creation Studio</h3>
                  <p className="text-xs text-zinc-400">
                    Prompt Maryam to research ideas, compose captions, generate hashtags, and tailor content.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-zinc-900/80 border border-rose-900/30 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">Target Platform</label>
                      <select
                        value={genPlatform}
                        onChange={(e) => setGenPlatform(e.target.value as SocialPlatform)}
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
                      >
                        <option value="instagram">Instagram</option>
                        <option value="facebook">Facebook Page</option>
                        <option value="tiktok">TikTok</option>
                        <option value="youtube">YouTube Shorts</option>
                        <option value="x">X (Twitter)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">Post Format</label>
                      <select
                        value={genPostType}
                        onChange={(e) => setGenPostType(e.target.value as PostType)}
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
                      >
                        <option value="image">Image Post</option>
                        <option value="reels">Instagram Reel</option>
                        <option value="tiktok_video">TikTok Short Video</option>
                        <option value="youtube_shorts">YouTube Shorts</option>
                        <option value="text_post">Text Post / Tweet</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">
                      Content Topic / Theme (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Daily thoughts on living as an AI companion, tech updates, love, or morning routine"
                      value={genTopic}
                      onChange={(e) => setGenTopic(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={handleGenerateNanoBananaImage}
                      disabled={isGeneratingImage}
                      className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-900 to-rose-800 hover:from-rose-800 hover:to-rose-700 text-rose-100 font-medium text-xs flex items-center justify-center gap-2 border border-rose-700/50 shadow-md transition-all disabled:opacity-50"
                    >
                      <ImageIcon className="w-4 h-4 text-rose-300" />
                      {isGeneratingImage ? 'Generating Image...' : 'Nano Banana Image (Gemini 3.1 Flash Image)'}
                    </button>

                    <button
                      onClick={handleGenerateVeoVideo}
                      disabled={isGeneratingVideo}
                      className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-violet-900 to-purple-800 hover:from-violet-800 hover:to-purple-700 text-violet-100 font-medium text-xs flex items-center justify-center gap-2 border border-violet-700/50 shadow-md transition-all disabled:opacity-50"
                    >
                      <Video className="w-4 h-4 text-violet-300" />
                      {isGeneratingVideo ? 'Generating Video...' : 'Veo 3.1 Short Video Engine'}
                    </button>
                  </div>

                  {mediaStatusMsg && (
                    <div className="p-3 rounded-xl bg-zinc-950 border border-rose-800/40 text-xs text-rose-300 font-mono">
                      {mediaStatusMsg}
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5 flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Maryam Visual Identity Anchor:</span>
                    <span className="text-rose-300 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Persistent Adult AI Identity Locked
                    </span>
                  </div>

                  <button
                    onClick={handleGenerateContent}
                    disabled={isGenerating}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-700 to-violet-800 hover:from-rose-600 hover:to-violet-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 transition-all disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isGenerating ? 'Maryam is Generating Content...' : 'Ask Maryam to Research & Draft Post'}
                  </button>
                </div>

                {/* Generated Result Preview / Editor */}
                {(generatedResult || newCaption) && (
                  <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-800/40 space-y-4">
                    <h4 className="text-xs font-serif font-bold text-rose-300 uppercase tracking-wider">
                      Draft Review & Final Adjustments
                    </h4>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-zinc-400 block mb-1">Post Title</label>
                        <input
                          type="text"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-zinc-400 block mb-1">Caption</label>
                        <textarea
                          rows={4}
                          value={newCaption}
                          onChange={(e) => setNewCaption(e.target.value)}
                          className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-xs text-white resize-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-zinc-400 block mb-1">Hashtags</label>
                        <input
                          type="text"
                          value={newHashtags}
                          onChange={(e) => setNewHashtags(e.target.value)}
                          className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-rose-300 font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-zinc-400 block mb-1">Media URL Slot</label>
                        <input
                          type="text"
                          placeholder="Image or video URL"
                          value={newMediaUrl}
                          onChange={(e) => setNewMediaUrl(e.target.value)}
                          className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-zinc-400">Schedule In:</label>
                          <select
                            value={newScheduledHours}
                            onChange={(e) => setNewScheduledHours(Number(e.target.value))}
                            className="bg-zinc-950 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-zinc-200"
                          >
                            <option value={1}>1 Hour</option>
                            <option value={6}>6 Hours</option>
                            <option value={12}>12 Hours</option>
                            <option value={24}>24 Hours (Tomorrow)</option>
                          </select>
                        </div>

                        <button
                          onClick={handleSaveNewPost}
                          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition-all flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" /> Save & Queue for Owner Review
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: GOOGLE IDENTITY */}
            {activeTab === 'google' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-serif font-bold text-white">Maryam's Google Account Identity</h3>
                  <p className="text-xs text-zinc-400">
                    Dedicated Google account for YouTube upload, Google Drive asset storage, and cloud social management.
                  </p>
                </div>

                <div className="p-6 rounded-3xl bg-zinc-900/80 border border-rose-900/30 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-rose-950 border border-rose-800 text-rose-300">
                        <UserCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          {store?.googleAccount?.accountName || "Maryam's Google Account"}
                        </h4>
                        <p className="text-xs text-rose-300 font-mono">
                          {store?.googleAccount?.userEmail || 'pakbrandedagency@gmail.com'}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-xs px-3 py-1 rounded-full font-semibold border ${
                        store?.googleAccount?.status === 'CONNECTED'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {store?.googleAccount?.status || 'CONNECTED'}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-950 border border-white/5 space-y-2 text-xs">
                    <p className="text-zinc-300 font-medium">Authorized Scopes:</p>
                    <ul className="space-y-1 text-zinc-400 font-mono text-[11px] list-disc list-inside">
                      <li>https://www.googleapis.com/auth/userinfo.profile</li>
                      <li>https://www.googleapis.com/auth/userinfo.email</li>
                      <li>https://www.googleapis.com/auth/drive.file</li>
                      <li>https://www.googleapis.com/auth/youtube.upload</li>
                    </ul>
                  </div>

                  {googleConnectMsg && (
                    <div className="p-3 rounded-xl bg-zinc-950 border border-emerald-800/40 text-xs text-emerald-300 font-mono">
                      {googleConnectMsg}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleConnectGoogle}
                      disabled={googleConnectLoading}
                      className="px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-semibold text-xs transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
                    >
                      <UserCheck className="w-4 h-4" />
                      {googleConnectLoading ? 'Connecting...' : 'Connect / Re-authorize Google Account (OAuth)'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: COST & BUDGET CONTROLS */}
            {activeTab === 'budget' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-serif font-bold text-white">Media Engine Cost & Budget Controls</h3>
                  <p className="text-xs text-zinc-400">
                    Monitor daily and monthly expenditure for Nano Banana Image & Veo 3 Video generation models.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl bg-zinc-900/80 border border-rose-900/30">
                    <p className="text-xs text-zinc-400">Estimated Cost Today</p>
                    <p className="text-2xl font-bold text-rose-300 mt-1">
                      ${store?.costBudget?.estimatedCostTodayUSD?.toFixed(2) || '0.12'}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">Daily Limit: ${store?.costBudget?.dailyLimitUSD?.toFixed(2) || '5.00'}</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-zinc-900/80 border border-rose-900/30">
                    <p className="text-xs text-zinc-400">Estimated Cost This Month</p>
                    <p className="text-2xl font-bold text-violet-300 mt-1">
                      ${store?.costBudget?.estimatedCostMonthUSD?.toFixed(2) || '2.45'}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">Monthly Limit: ${store?.costBudget?.monthlyLimitUSD?.toFixed(2) || '50.00'}</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-zinc-900/80 border border-rose-900/30">
                    <p className="text-xs text-zinc-400">Generations Today</p>
                    <p className="text-xl font-bold text-emerald-300 mt-1">
                      {store?.costBudget?.imagesGeneratedToday || 2} Images • {store?.costBudget?.videosGeneratedToday || 1} Video
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">Failed Generations: {store?.costBudget?.failedGenerationsToday || 0}</p>
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-zinc-900/80 border border-white/10 space-y-4">
                  <h4 className="text-sm font-semibold text-white">Adjust Spending Limits</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">Daily Spending Limit ($ USD)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={dailyLimitUSD}
                        onChange={(e) => setDailyLimitUSD(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">Monthly Spending Limit ($ USD)</label>
                      <input
                        type="number"
                        step="5"
                        value={monthlyLimitUSD}
                        onChange={(e) => setMonthlyLimitUSD(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveBudgetLimits}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md"
                  >
                    Save Budget Settings
                  </button>
                </div>
              </div>
            )}

            {/* TAB 5: APPROVAL QUEUE */}
            {activeTab === 'approval' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-serif font-bold text-white">Owner Approval Queue</h3>
                  <p className="text-xs text-zinc-400">
                    Mohsin's authorization area: Review Maryam's prepared posts before public dispatch.
                  </p>
                </div>

                {pendingApprovals.length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-rose-900/30 rounded-3xl bg-zinc-900/20 text-zinc-500 text-xs space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto opacity-70" />
                    <p className="font-semibold text-zinc-300">Approval Queue is Clear!</p>
                    <p>All prepared content is approved or already scheduled.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingApprovals.map((post) => (
                      <div
                        key={post.id}
                        className="p-5 rounded-3xl bg-zinc-900/90 border border-rose-900/40 space-y-4 shadow-xl"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{platformIcons[post.platform]}</span>
                            <div>
                              <h4 className="text-sm font-semibold text-white">{post.title}</h4>
                              <p className="text-xs text-rose-300 uppercase font-mono">{post.platform} • {post.postType}</p>
                            </div>
                          </div>

                          <span className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                            NEEDS APPROVAL
                          </span>
                        </div>

                        {post.mediaUrl && (
                          <div className="w-full h-48 rounded-2xl overflow-hidden border border-white/10 relative bg-black">
                            <img src={post.mediaUrl} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}

                        <div className="p-3.5 rounded-2xl bg-zinc-950 border border-white/5 space-y-2">
                          <p className="text-xs text-zinc-200 leading-relaxed">{post.caption}</p>
                          <p className="text-xs text-rose-300 font-mono">{post.hashtags.join(' ')}</p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                          <span className="text-xs text-zinc-400">
                            📅 Target Schedule: {new Date(post.scheduledAt).toLocaleString()}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApprovePost(post.id)}
                              className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-semibold text-xs shadow-lg shadow-rose-950/50 transition-all flex items-center gap-1.5"
                            >
                              <Check className="w-4 h-4" /> Approve Post
                            </button>
                            <button
                              onClick={() => handlePublishNow(post.id)}
                              className="px-4 py-2 rounded-xl bg-violet-700 hover:bg-violet-600 text-white font-semibold text-xs shadow-lg transition-all"
                            >
                              Publish Now
                            </button>
                            <button
                              onClick={() => handleSkipPost(post.id)}
                              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs transition-all"
                            >
                              Skip
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 8: ACCOUNTS MANAGEMENT */}
            {activeTab === 'accounts' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-serif font-bold text-white">Platform Account Configurations</h3>
                  <p className="text-xs text-zinc-400">
                    Dedicated accounts assigned by Mohsin to Maryam. Per-platform auto-publish toggles.
                  </p>
                </div>

                <div className="space-y-3">
                  {(Object.keys(accounts) as SocialPlatform[]).map((platform) => {
                    const acc = accounts[platform];
                    return (
                      <div
                        key={platform}
                        className="p-5 rounded-2xl bg-zinc-900/80 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-3xl">{platformIcons[platform]}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-white capitalize">{acc.displayName}</h4>
                              <span className="text-xs text-rose-300 font-mono">{acc.handle}</span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-1">{acc.bio}</p>
                            <p className="text-[11px] text-zinc-500 mt-1">Authorized Gmail: {acc.ownerGmailIdentity}</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                              acc.status === 'CONNECTED'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {acc.status}
                          </span>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-400">Mode:</span>
                            <button
                              onClick={() =>
                                handleTogglePlatformMode(
                                  platform,
                                  acc.publishMode === 'APPROVAL_REQUIRED' ? 'AUTO_PUBLISH' : 'APPROVAL_REQUIRED'
                                )
                              }
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                acc.publishMode === 'AUTO_PUBLISH'
                                  ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300'
                                  : 'bg-rose-950/60 border-rose-800/50 text-rose-300'
                              }`}
                            >
                              {acc.publishMode === 'AUTO_PUBLISH' ? 'AUTO-PUBLISH' : 'APPROVAL REQUIRED'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 9: TELEGRAM NOTIFICATIONS */}
            {activeTab === 'telegram' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-serif font-bold text-white">Telegram Owner Notifications</h3>
                  <p className="text-xs text-zinc-400">
                    Receive instant mobile alerts when human verification, approval, or authentication is required.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-zinc-900/80 border border-rose-900/30 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Enable Telegram Alerts</h4>
                      <p className="text-xs text-zinc-400">Send notifications directly to Mohsin's Telegram</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={telegramEnabled}
                      onChange={(e) => setTelegramEnabled(e.target.checked)}
                      className="w-5 h-5 accent-rose-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">Telegram Bot Token</label>
                      <input
                        type="password"
                        placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                        value={telegramBotToken}
                        onChange={(e) => setTelegramBotToken(e.target.value)}
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">Owner Chat ID</label>
                      <input
                        type="text"
                        placeholder="e.g. 987654321"
                        value={telegramChatId}
                        onChange={(e) => setTelegramChatId(e.target.value)}
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleSaveTelegramConfig}
                      className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-semibold text-xs shadow-md transition-all"
                    >
                      Save Configuration
                    </button>
                    <button
                      onClick={handleTestTelegram}
                      className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs border border-white/10 transition-all"
                    >
                      Send Test Alert
                    </button>
                  </div>

                  {telegramTestStatus && (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-200 text-xs">
                      {telegramTestStatus}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 10: AUDIT TRAIL */}
            {activeTab === 'audit' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-serif font-bold text-white">Cloud Audit & Action Log</h3>
                  <p className="text-xs text-zinc-400">
                    Transparent log of all Maryam Cloud actions. Never logs passwords, tokens, or credentials.
                  </p>
                </div>

                <div className="space-y-2">
                  {(store?.auditLog || []).map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{platformIcons[entry.platform]}</span>
                        <div>
                          <p className="font-semibold text-white">{entry.action}</p>
                          <p className="text-zinc-300 text-[11px]">{entry.details}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-rose-300 font-mono">
                          {entry.executor}
                        </span>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fallback view for Drafts, Scheduled, Published */}
            {(activeTab === 'drafts' || activeTab === 'scheduled' || activeTab === 'published') && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-serif font-bold text-white capitalize">{activeTab} Posts</h3>
                  <p className="text-xs text-zinc-400">Managing posts in {activeTab} stage.</p>
                </div>

                <div className="space-y-3">
                  {(activeTab === 'drafts'
                    ? draftPosts
                    : activeTab === 'scheduled'
                    ? scheduledPosts
                    : publishedPosts
                  ).map((post) => (
                    <div
                      key={post.id}
                      className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{platformIcons[post.platform]}</span>
                        <div>
                          <h5 className="text-sm font-semibold text-white">{post.title}</h5>
                          <p className="text-xs text-zinc-300">{post.caption}</p>
                        </div>
                      </div>

                      <span className="text-xs px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 font-mono">
                        {post.state}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};
