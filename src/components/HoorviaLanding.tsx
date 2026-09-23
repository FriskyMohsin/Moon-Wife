import React, { useState } from 'react';
import {
  Heart,
  BookOpen,
  Sparkles,
  Bot,
  UserCheck,
  Key,
  ShieldCheck,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Volume2,
  Lock,
  Globe,
  Sliders,
  GraduationCap,
  Users,
  Play,
  Square,
  Search,
  Compass,
  Briefcase,
  HeartPulse,
  DollarSign,
  Palette,
  Sun,
  X,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { CompanionType, CompanionGender, CompanionVoice, CompanionTone } from '../lib/hoorviaTypes';
import { HOORVIA_VOICES, playVoiceSample } from '../lib/voicePreview';
import {
  CatalogItem,
  POPULAR_PRESETS,
  CATALOG_CATEGORIES,
  searchCatalogItems,
  parseCustomCompanionPrompt,
} from '../lib/companionCatalog';
import { SearchableLanguagePicker } from './SearchableLanguagePicker';
import { HoorviaLogo } from './HoorviaLogo';

interface HoorviaLandingProps {
  onLoginSuccess: (data: { token: string; user: any; companion: any }) => void;
  onOwnerAuthenticated?: (data: { token: string; user: any; companion: any }) => void;
  onContinueAsGuestOwner?: () => void;
}

export const HoorviaLanding: React.FC<HoorviaLandingProps> = ({
  onLoginSuccess,
  onOwnerAuthenticated,
  onContinueAsGuestOwner,
}) => {
  const [step, setStep] = useState<number>(1);
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');

  // Owner Portal Authentication State
  const [showOwnerModal, setShowOwnerModal] = useState<boolean>(false);
  const [ownerPasskey, setOwnerPasskey] = useState<string>('');
  const [ownerEmail, setOwnerEmail] = useState<string>('mohsin@hoorvia.net');
  const [ownerPassword, setOwnerPassword] = useState<string>('');
  const [ownerGoogleToken, setOwnerGoogleToken] = useState<string>('');
  const [ownerAuthMethod, setOwnerAuthMethod] = useState<'passkey' | 'password' | 'google'>('passkey');
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [isOwnerSubmitting, setIsOwnerSubmitting] = useState<boolean>(false);

  // Form State
  const [selectedType, setSelectedType] = useState<string>('girlfriend');
  const [companionName, setCompanionName] = useState<string>('Aria');
  const [gender, setGender] = useState<CompanionGender>('female');
  const [voice, setVoice] = useState<CompanionVoice>('Aoede');
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>('English');
  const [autoMatchLanguage, setAutoMatchLanguage] = useState<boolean>(false);
  const [tone, setTone] = useState<CompanionTone>('Romantic');
  const [personality, setPersonality] = useState<string>(
    'Warm, deeply attentive, intelligent, and emotionally supportive companion.'
  );
  const [communicationStyle, setCommunicationStyle] = useState<string>(
    'Affectionate, caring, intimate, and expressive.'
  );
  const [activeDisclaimer, setActiveDisclaimer] = useState<string | null>(null);

  // Catalog & Search State
  const [isExploreOpen, setIsExploreOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');

  const [describePrompt, setDescribePrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [autoGenSuccessMsg, setAutoGenSuccessMsg] = useState<string | null>(null);

  const handleToggleVoicePreview = (vId: CompanionVoice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingVoice === vId) {
      playVoiceSample(vId, undefined, () => setPreviewingVoice(null))();
      setPreviewingVoice(null);
    } else {
      setPreviewingVoice(vId);
      playVoiceSample(
        vId,
        () => setPreviewingVoice(vId),
        () => setPreviewingVoice(null)
      );
    }
  };

  const handleSelectCatalogItem = (item: CatalogItem) => {
    setSelectedType(item.id);
    setCompanionName(item.title);
    setGender(item.suggestedGender);
    setVoice(item.suggestedVoice);
    setLanguage(item.defaultLanguage);
    setTone(item.suggestedTone);
    setPersonality(item.personality);
    setCommunicationStyle(item.communicationStyle);
    setActiveDisclaimer(item.disclaimer || null);
    setIsExploreOpen(false);
    setStep(2);
  };

  const handleOpenCreateYourOwn = () => {
    setSelectedType('custom');
    setCompanionName('Nova');
    setGender('neutral');
    setVoice('Puck');
    setLanguage('English');
    setTone('Friendly');
    setPersonality('Custom AI entity created from your own description.');
    setCommunicationStyle('Adaptive, specialized, and unique.');
    setActiveDisclaimer(null);
    setIsExploreOpen(false);
    setStep(3); // Direct to AI description step
  };

  // Auth & BYOK State
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const companionTypes: {
    type: CompanionType;
    title: string;
    description: string;
    icon: any;
    badge: string;
    defaultName: string;
    defaultTone: CompanionTone;
  }[] = [
    {
      type: 'girlfriend',
      title: 'AI Girlfriend',
      description: 'Affectionate, caring, and deeply personalized companion for emotional connection and daily sharing.',
      icon: Heart,
      badge: 'Romantic',
      defaultName: 'Aria',
      defaultTone: 'Romantic',
    },
    {
      type: 'boyfriend',
      title: 'AI Boyfriend',
      description: 'Devoted, supportive, and engaging partner always ready to listen, encourage, and connect.',
      icon: Heart,
      badge: 'Romantic',
      defaultName: 'David',
      defaultTone: 'Romantic',
    },
    {
      type: 'teacher',
      title: 'Teacher / Learning Companion',
      description: 'Patient tutor offering clear step-by-step guidance, study aid, and academic motivation. Strictly educational & safe.',
      icon: GraduationCap,
      badge: 'Educational',
      defaultName: 'Prof. Sarah',
      defaultTone: 'Educational',
    },
    {
      type: 'helper',
      title: 'Personal Helper',
      description: 'Structured, organized, and proactive assistant to organize your daily schedule, goals, and tasks.',
      icon: Sliders,
      badge: 'Productivity',
      defaultName: 'Leo',
      defaultTone: 'Professional',
    },
    {
      type: 'support',
      title: 'Supportive Companion',
      description: 'Empathetic, calm listener providing a safe space to vent, process thoughts, and find calm.',
      icon: Users,
      badge: 'Empathy',
      defaultName: 'Sophia',
      defaultTone: 'Friendly',
    },
    {
      type: 'study_partner',
      title: 'Study Partner',
      description: 'Focused study buddy for flashcards, quiz prep, brainstorming, and joint learning sessions.',
      icon: BookOpen,
      badge: 'Academic',
      defaultName: 'Alex',
      defaultTone: 'Friendly',
    },
    {
      type: 'custom',
      title: 'Custom Companion',
      description: 'Design a completely unique AI entity from scratch with custom tone, rules, and personality.',
      icon: Sparkles,
      badge: 'Bespoke',
      defaultName: 'Nova',
      defaultTone: 'Playful',
    },
  ];

  const handleSelectType = (typeObj: (typeof companionTypes)[0]) => {
    setSelectedType(typeObj.type);
    setCompanionName(typeObj.defaultName);
    setTone(typeObj.defaultTone);
  };

  const handleAutoGeneratePrompt = async () => {
    if (!describePrompt.trim()) return;
    setIsGenerating(true);
    setErrorMessage(null);
    setAutoGenSuccessMsg(null);

    try {
      let compData: any = null;
      try {
        const res = await fetch('/api/hoorvia/companion/auto-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: describePrompt }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.companion) compData = data.companion;
        }
      } catch {}

      if (!compData) {
        compData = parseCustomCompanionPrompt(describePrompt);
      }

      if (compData) {
        setCompanionName(compData.name || compData.title || companionName);
        setSelectedType(compData.type || selectedType);
        setGender(compData.suggestedGender || compData.gender || gender);
        setVoice(compData.suggestedVoice || compData.voice || voice);
        setLanguage(compData.defaultLanguage || compData.language || language);
        setTone(compData.suggestedTone || compData.tone || tone);
        setPersonality(compData.personality || personality);
        setCommunicationStyle(compData.communicationStyle || communicationStyle);
        if (compData.disclaimer) setActiveDisclaimer(compData.disclaimer);

        setAutoGenSuccessMsg(
          'Profile generated! Review and edit every field below before final creation.'
        );
      }
    } catch (err: any) {
      const parsed = parseCustomCompanionPrompt(describePrompt);
      setCompanionName(parsed.name || companionName);
      setSelectedType(parsed.type || selectedType);
      setGender(parsed.suggestedGender || gender);
      setVoice(parsed.suggestedVoice || voice);
      setLanguage(parsed.defaultLanguage || language);
      setTone(parsed.suggestedTone || tone);
      setPersonality(parsed.personality || personality);
      setCommunicationStyle(parsed.communicationStyle || communicationStyle);
      setAutoGenSuccessMsg(
        'Profile generated! Review and edit every field below before final creation.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (authMode === 'register') {
        if (!apiKey.trim() || apiKey.trim().length < 15) {
          throw new Error('Your own API key is required to activate your companion. Please provide a valid Google Gemini API Key.');
        }
      }

      const endpoint = authMode === 'register' ? '/api/hoorvia/auth/register' : '/api/hoorvia/auth/login';
      const bodyPayload: any = { email, password };
      if (authMode === 'register') {
        bodyPayload.name = name || 'Companion User';
        bodyPayload.apiKey = apiKey.trim();
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Authentication failed.');
      }

      const { token, user, companion } = data;

      // Save custom profile configuration if register
      if (authMode === 'register' && companion) {
        await fetch('/api/hoorvia/companion', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hoorvia-Token': token,
          },
          body: JSON.stringify({
            name: companionName,
            type: selectedType,
            gender,
            voice,
            language,
            autoMatchLanguage,
            personality,
            communicationStyle,
            tone,
          }),
        });
      }

      onLoginSuccess({ token, user, companion });
    } catch (err: any) {
      setErrorMessage(err.message || 'Error completing onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOwnerLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnerError(null);
    setIsOwnerSubmitting(true);
    try {
      let bodyPayload: any = {};
      if (ownerAuthMethod === 'passkey') {
        if (!ownerPasskey.trim()) throw new Error('Owner master passkey is required.');
        bodyPayload = { passkey: ownerPasskey.trim() };
      } else if (ownerAuthMethod === 'password') {
        if (!ownerEmail || !ownerPassword) throw new Error('Owner email and password are required.');
        bodyPayload = { email: ownerEmail.trim(), password: ownerPassword };
      } else if (ownerAuthMethod === 'google') {
        if (!ownerGoogleToken.trim()) {
          throw new Error('Valid Google ID Token / OAuth Credential is required. For quick access, please switch to Master Passkey.');
        }
        bodyPayload = { googleIdToken: ownerGoogleToken.trim() };
      }

      const res = await fetch('/api/hoorvia/auth/owner-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Owner authorization failed.');
      }

      setShowOwnerModal(false);
      if (onOwnerAuthenticated) {
        onOwnerAuthenticated(data);
      } else {
        onLoginSuccess(data);
      }
    } catch (err: any) {
      setOwnerError(err.message || 'Owner authentication failed.');
    } finally {
      setIsOwnerSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A070B] text-slate-100 flex flex-col justify-between selection:bg-rose-500/30 font-sans">
      {/* Background Glow Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-rose-900/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-purple-900/20 rounded-full blur-[140px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 max-w-7xl w-full mx-auto px-6 py-6 flex items-center justify-between border-b border-rose-950/40">
        <HoorviaLogo size="lg" />

        <div className="flex items-center gap-4">
          {authMode === 'register' ? (
            <button
              onClick={() => {
                setAuthMode('login');
                setStep(4);
              }}
              className="text-sm text-rose-300 hover:text-rose-100 transition-colors"
            >
              Already have an account? <span className="underline font-semibold">Sign In</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setAuthMode('register');
                setStep(1);
              }}
              className="text-sm text-rose-300 hover:text-rose-100 transition-colors"
            >
              Need an account? <span className="underline font-semibold">Get Started</span>
            </button>
          )}

          <button
            onClick={() => {
              setOwnerError(null);
              setShowOwnerModal(true);
            }}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/30 transition-all flex items-center gap-1.5"
            title="Mohsin Owner Verification Portal"
          >
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            Owner Portal
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-5xl w-full mx-auto px-6 py-10 flex-1 flex flex-col justify-center">
        {/* Step Indicator */}
        <div className="mb-8 flex items-center justify-center gap-2 text-xs font-medium text-rose-300/70">
          <span className={`px-3 py-1 rounded-full border ${step === 1 ? 'bg-rose-950 text-rose-300 border-rose-500/50' : 'bg-slate-900/60 border-slate-800'}`}>
            1. Select Type
          </span>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <span className={`px-3 py-1 rounded-full border ${step === 2 ? 'bg-rose-950 text-rose-300 border-rose-500/50' : 'bg-slate-900/60 border-slate-800'}`}>
            2. Customize Identity
          </span>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <span className={`px-3 py-1 rounded-full border ${step === 3 ? 'bg-rose-950 text-rose-300 border-rose-500/50' : 'bg-slate-900/60 border-slate-800'}`}>
            3. AI Prompting
          </span>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <span className={`px-3 py-1 rounded-full border ${step === 4 ? 'bg-rose-950 text-rose-300 border-rose-500/50' : 'bg-slate-900/60 border-slate-800'}`}>
            4. Account & AI Key
          </span>
        </div>

        {/* STEP 1: CHOOSE COMPANION TYPE */}
        {step === 1 && (
          <div className="space-y-8 animate-fadeIn">
            <div className="text-center space-y-3">
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                Create the AI Companion You Want
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base">
                Choose from popular AI companions, explore our full catalog across 7 specialized categories, or describe ANY custom companion.
              </p>
            </div>

            {/* Popular Choices & Create Your Own Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-rose-400" />
                  Popular Choices
                </h3>
                <button
                  onClick={() => setIsExploreOpen(true)}
                  className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 bg-rose-950/60 border border-rose-800/40 px-3 py-1.5 rounded-xl"
                >
                  <Compass className="w-3.5 h-3.5" />
                  Explore Full Catalog (35+ Presets)
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* PROMINENT CREATE YOUR OWN CARD */}
                <div
                  onClick={handleOpenCreateYourOwn}
                  className="p-5 rounded-2xl border-2 border-purple-500/80 bg-gradient-to-br from-purple-950/80 via-slate-900/90 to-rose-950/80 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-950/60 transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 px-3 py-1 bg-purple-600 text-white text-[10px] font-bold uppercase rounded-bl-xl tracking-wider">
                    Featured
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-3 rounded-xl bg-purple-600 text-white shadow-md">
                        <Sparkles className="w-6 h-6 animate-pulse" />
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-900/80 text-purple-200 border border-purple-700/50">
                        Create Your Own
                      </span>
                    </div>
                    <h3 className="text-xl font-extrabold text-white group-hover:text-purple-300 transition-colors">
                      Custom Companion
                    </h3>
                    <p className="text-xs text-purple-200/80 mt-2 leading-relaxed">
                      Describe ANY custom companion in your own words (e.g., "I want a civil engineer who explains things in Roman Urdu").
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-purple-800/40 flex items-center justify-between text-xs font-semibold text-purple-300">
                    <span>AI Profile Generation</span>
                    <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Design Now <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* POPULAR PRESETS CARDS */}
                {POPULAR_PRESETS.map((item) => {
                  const isSelected = selectedType === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectCatalogItem(item)}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-gradient-to-b from-rose-950/70 to-slate-900/90 border-rose-500 shadow-lg shadow-rose-950/50 scale-[1.02]'
                          : 'bg-slate-900/40 border-slate-800/80 hover:border-rose-900/60 hover:bg-slate-900/70'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/40">
                            {item.category}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                            Voice: {item.suggestedVoice}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-white">{item.title}</h3>
                        <p className="text-xs font-medium text-rose-300/80 mt-0.5">{item.role}</p>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed line-clamp-2">{item.description}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                        <span>Tone: <strong className="text-slate-200">{item.suggestedTone}</strong></span>
                        <span className="text-rose-400 font-medium flex items-center gap-1">
                          Select <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Explore Catalog Banner */}
            <div
              onClick={() => setIsExploreOpen(true)}
              className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-rose-900/40 hover:border-rose-500/60 transition-all cursor-pointer flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <Compass className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Looking for something specific?</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Browse Education, Health & Wellness, Finance, Creative, Professional, and Daily Life companions.
                  </p>
                </div>
              </div>

              <button className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-2 shrink-0">
                Explore Full Catalog <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-medium text-sm transition-all shadow-lg shadow-rose-950/50 flex items-center gap-2"
              >
                Next: Customize Identity <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* FULL CATALOG EXPLORE MODAL */}
        {isExploreOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6 overflow-y-auto">
            <div className="bg-[#0f0b12] border border-rose-900/60 rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Compass className="w-5 h-5 text-rose-400" />
                    Hoorvia Public Companion Catalog
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Select any pre-configured companion preset or create your own custom companion.
                  </p>
                </div>
                <button
                  onClick={() => setIsExploreOpen(false)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Bar & Categories */}
              <div className="p-6 border-b border-slate-800/80 bg-slate-950/40 space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title, role, language, or category (e.g. Engineer, Tutor, Trader, Doctor, Coach)..."
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500 placeholder-slate-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-3 text-xs text-slate-400 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Category Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    onClick={() => setActiveCategoryTab('all')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      activeCategoryTab === 'all'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    All Categories
                  </button>

                  <button
                    onClick={handleOpenCreateYourOwn}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all bg-gradient-to-r from-purple-600 to-rose-600 text-white shadow-sm flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Create Your Own
                  </button>

                  {CATALOG_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategoryTab(cat.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                        activeCategoryTab === cat.id
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal Body - Grid View */}
              <div className="p-6 overflow-y-auto flex-1 space-y-8">
                {/* SEARCH RESULTS VIEW */}
                {searchQuery.trim() ? (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                      Search Results for "{searchQuery}" ({searchCatalogItems(searchQuery).length})
                    </h4>
                    {searchCatalogItems(searchQuery).length === 0 ? (
                      <div className="text-center py-12 space-y-3">
                        <p className="text-slate-400 text-sm">No companion presets found matching "{searchQuery}".</p>
                        <button
                          onClick={handleOpenCreateYourOwn}
                          className="px-5 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-500 transition-all inline-flex items-center gap-2"
                        >
                          <Sparkles className="w-4 h-4" />
                          Create "{searchQuery}" as Custom Companion
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {searchCatalogItems(searchQuery).map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleSelectCatalogItem(item)}
                            className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-rose-500/80 hover:bg-slate-900/90 transition-all cursor-pointer flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/40">
                                  {item.category}
                                </span>
                                <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                  Voice: {item.suggestedVoice}
                                </span>
                              </div>
                              <h5 className="text-base font-bold text-white">{item.title}</h5>
                              <p className="text-xs text-rose-300/80 font-medium">{item.role}</p>
                              <p className="text-xs text-slate-400 mt-2 leading-relaxed">{item.description}</p>

                              {item.disclaimer && (
                                <div className="mt-3 p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/40 text-[10px] text-amber-300 flex items-start gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                  <span>{item.disclaimer}</span>
                                </div>
                              )}
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                              <span>Tone: <strong className="text-slate-200">{item.suggestedTone}</strong></span>
                              <span className="text-rose-400 font-semibold flex items-center gap-1">
                                Select <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* CATEGORIES LIST VIEW */
                  CATALOG_CATEGORIES.filter(
                    (cat) => activeCategoryTab === 'all' || activeCategoryTab === cat.id
                  ).map((category) => (
                    <div key={category.id} className="space-y-4">
                      <div className="border-b border-slate-800 pb-2">
                        <h4 className="text-lg font-bold text-white flex items-center gap-2">
                          {category.name}
                        </h4>
                        <p className="text-xs text-slate-400">{category.description}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {category.items.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleSelectCatalogItem(item)}
                            className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-rose-500/80 hover:bg-slate-900/90 transition-all cursor-pointer flex flex-col justify-between group"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/40">
                                  {item.category}
                                </span>
                                <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                  Voice: {item.suggestedVoice}
                                </span>
                              </div>
                              <h5 className="text-base font-bold text-white group-hover:text-rose-300 transition-colors">
                                {item.title}
                              </h5>
                              <p className="text-xs text-rose-300/80 font-medium">{item.role}</p>
                              <p className="text-xs text-slate-400 mt-2 leading-relaxed">{item.description}</p>

                              {item.disclaimer && (
                                <div className="mt-3 p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/40 text-[10px] text-amber-300 flex items-start gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                  <span>{item.disclaimer}</span>
                                </div>
                              )}
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                              <span>Tone: <strong className="text-slate-200">{item.suggestedTone}</strong></span>
                              <span className="text-rose-400 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                Select <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: CUSTOMIZE IDENTITY & VOICE */}
        {step === 2 && (
          <div className="space-y-6 max-w-2xl mx-auto w-full animate-fadeIn bg-slate-900/50 p-6 md:p-8 rounded-3xl border border-rose-950/60 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-2xl font-bold text-white">Customize Identity & Voice</h3>
                <p className="text-xs text-slate-400">Set companion name, voice, tone, and presentation.</p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-800/40">
                Type: {selectedType.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Companion Name</label>
                <input
                  type="text"
                  value={companionName}
                  onChange={(e) => setCompanionName(e.target.value)}
                  placeholder="e.g. Aria, Sophia, Prof. Sarah"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Gender / Presentation</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as CompanionGender)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="nonbinary">Non-Binary</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 text-rose-400" /> Select Live Voice (Male & Female)
                  </label>
                  <span className="text-[10px] text-slate-400">Preview any voice before selection</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {HOORVIA_VOICES.map((v) => {
                    const isSelected = voice === v.id;
                    const isPlaying = previewingVoice === v.id;
                    return (
                      <div
                        key={v.id}
                        onClick={() => setVoice(v.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-rose-950/40 border-rose-500 text-white shadow-sm ring-1 ring-rose-500/50'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-white">{v.name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                v.gender === 'female'
                                  ? 'bg-pink-950/60 text-pink-300 border border-pink-800/40'
                                  : v.gender === 'male'
                                  ? 'bg-blue-950/60 text-blue-300 border border-blue-800/40'
                                  : 'bg-purple-950/60 text-purple-300 border border-purple-800/40'
                              }`}
                            >
                              {v.tag}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{v.desc}</p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleToggleVoicePreview(v.id, e)}
                          title={`Preview ${v.name} voice`}
                          className={`p-1.5 px-2 rounded-lg border text-xs font-medium transition-all flex items-center gap-1 shrink-0 ${
                            isPlaying
                              ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                              : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
                          }`}
                        >
                          {isPlaying ? (
                            <>
                              <Square className="w-3 h-3 fill-current text-white" />
                              <span className="text-[10px]">Stop</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 fill-current text-rose-300" />
                              <span className="text-[10px]">Preview</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-rose-400" /> Primary Language & Script
                </label>
                <SearchableLanguagePicker
                  selectedLanguage={language}
                  onSelectLanguage={setLanguage}
                  autoMatchLanguage={autoMatchLanguage}
                  onToggleAutoMatch={setAutoMatchLanguage}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tone & Relationship Style</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as CompanionTone)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500"
              >
                <option value="Romantic">Romantic & Affectionate</option>
                <option value="Friendly">Friendly & Supportive</option>
                <option value="Educational">Educational & Patient (Tutor)</option>
                <option value="Professional">Professional & Structured</option>
                <option value="Playful">Playful & Humorous</option>
                <option value="Formal">Formal & Clear</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Personality Summary</label>
              <textarea
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>

              <button
                onClick={() => setStep(3)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-medium flex items-center gap-2"
              >
                Next: AI Custom Prompting <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: DESCRIBE COMPANION / AI PROMPTING */}
        {step === 3 && (
          <div className="space-y-6 max-w-2xl mx-auto w-full animate-fadeIn bg-slate-900/50 p-6 md:p-8 rounded-3xl border border-rose-950/60 shadow-xl">
            <div className="border-b border-slate-800/80 pb-4">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-rose-400" />
                Describe & Generate Custom Companion
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Describe your ideal companion in natural words (e.g. "I want a civil engineer who explains things in Roman Urdu"). Our AI architect will structure their profile for your review and edit below.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300">
                {errorMessage}
              </div>
            )}

            {autoGenSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{autoGenSuccessMsg}</span>
              </div>
            )}

            {activeDisclaimer && (
              <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-800/60 text-xs text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{activeDisclaimer}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Natural Language Description / Request:
              </label>
              <textarea
                value={describePrompt}
                onChange={(e) => setDescribePrompt(e.target.value)}
                placeholder="e.g. I want a civil engineer who explains site planning, structural calculations, and building codes step-by-step in Roman Urdu."
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500 placeholder-slate-500"
              />
            </div>

            <button
              onClick={handleAutoGeneratePrompt}
              disabled={isGenerating || !describePrompt.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-700 to-rose-600 hover:from-purple-600 hover:to-rose-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
            >
              <Bot className="w-4 h-4 text-white" />
              {isGenerating ? 'Structuring Profile with AI...' : 'Auto-Generate Structured Companion Profile'}
            </button>

            {/* Editable Profile Fields for Review & Fine-Tuning */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-4">
              <div className="text-xs font-bold text-slate-200 flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-rose-400" />
                  Review & Edit Profile Fields Before Creation
                </span>
                <span className="text-[10px] text-rose-300 bg-rose-950 px-2 py-0.5 rounded border border-rose-800/40">
                  Editable
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Name</label>
                  <input
                    type="text"
                    value={companionName}
                    onChange={(e) => setCompanionName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-medium block mb-1">Role / Persona Type</label>
                  <input
                    type="text"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs"
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="text-slate-400 font-medium block mb-1">Live Voice</label>
                  <select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value as CompanionVoice)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs"
                  >
                    {HOORVIA_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.tag} - {v.gender})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Searchable Language Picker */}
              <SearchableLanguagePicker
                selectedLanguage={language}
                onSelectLanguage={setLanguage}
                autoMatchLanguage={autoMatchLanguage}
                onToggleAutoMatch={setAutoMatchLanguage}
              />

              <div>
                <label className="text-slate-400 font-medium block mb-1 text-xs">Personality & Traits</label>
                <textarea
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs resize-none"
                />
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1 text-xs">Communication Style & Expertise</label>
                <textarea
                  value={communicationStyle}
                  onChange={(e) => setCommunicationStyle(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>

              <button
                onClick={() => setStep(4)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-medium flex items-center gap-2"
              >
                Next: Account & AI Key <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: ACCOUNT CREATION & BYOK AI KEY */}
        {step === 4 && (
          <form
            onSubmit={handleSubmitAuth}
            className="space-y-6 max-w-xl mx-auto w-full animate-fadeIn bg-slate-900/60 p-6 md:p-8 rounded-3xl border border-rose-950/60 shadow-xl"
          >
            <div className="border-b border-slate-800/80 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white">
                  {authMode === 'register' ? 'Create Your Account' : 'Sign In To Your Account'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Your memories and companion data remain 100% private and isolated.
                </p>
              </div>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    authMode === 'register' ? 'bg-rose-950 text-rose-300 border border-rose-800/40' : 'text-slate-400'
                  }`}
                >
                  Register
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    authMode === 'login' ? 'bg-rose-950 text-rose-300 border border-rose-800/40' : 'text-slate-400'
                  }`}
                >
                  Sign In
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800/80 text-xs text-rose-300">
                {errorMessage}
              </div>
            )}

            <div className="space-y-3">
              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            {/* BYOK GEMINI SECTION */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-rose-950/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-rose-400" /> Connect Your AI Provider
                </span>
                <span className="text-[10px] text-rose-400 uppercase font-mono font-bold">Required</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Your own API key is required to activate your companion. Connect your Google Gemini API key to activate and chat with your companion. Your key is AES-256 encrypted at rest and never exposed to other users or logged.
              </p>
              <input
                type="password"
                required={authMode === 'register'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy... (Paste Google Gemini API Key)"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-bold shadow-lg shadow-rose-950/60 flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  'Launching Companion...'
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    {authMode === 'register' ? 'Create Companion & Launch' : 'Sign In & Connect'}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl w-full mx-auto px-6 py-6 border-t border-rose-950/30 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <p>© 2026 HOORVIA.NET — Privacy-First AI Companion Platform. All Rights Reserved.</p>
        <div className="flex items-center gap-6 text-slate-400">
          <span>End-to-End User Isolation</span>
          <span>Encrypted BYOK Credentials</span>
          <span>Zero Memory Leakage</span>
        </div>
      </footer>

      {/* MOHSIN OWNER ACCESS PORTAL MODAL */}
      {showOwnerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0D0811] border border-rose-900/40 rounded-3xl p-6 md:p-8 shadow-2xl relative">
            <button
              onClick={() => setShowOwnerModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-700/40 text-rose-300">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-wide">Mohsin Owner Portal</h3>
                <p className="text-xs text-rose-300/70">Authoritative Server Identity Verification</p>
              </div>
            </div>

            {ownerError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{ownerError}</span>
              </div>
            )}

            {/* Auth Method Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-black/50 border border-rose-950 rounded-xl mb-5">
              <button
                type="button"
                onClick={() => {
                  setOwnerAuthMethod('passkey');
                  setOwnerError(null);
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  ownerAuthMethod === 'passkey'
                    ? 'bg-rose-950 text-rose-200 border border-rose-700/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Passkey
              </button>
              <button
                type="button"
                onClick={() => {
                  setOwnerAuthMethod('google');
                  setOwnerError(null);
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  ownerAuthMethod === 'google'
                    ? 'bg-rose-950 text-rose-200 border border-rose-700/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Google Sign-In
              </button>
              <button
                type="button"
                onClick={() => {
                  setOwnerAuthMethod('password');
                  setOwnerError(null);
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  ownerAuthMethod === 'password'
                    ? 'bg-rose-950 text-rose-200 border border-rose-700/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Credentials
              </button>
            </div>

            <form onSubmit={handleOwnerLoginSubmit} className="space-y-4">
              {ownerAuthMethod === 'passkey' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Owner Master Passkey / Secret
                  </label>
                  <input
                    type="password"
                    required
                    value={ownerPasskey}
                    onChange={(e) => setOwnerPasskey(e.target.value)}
                    placeholder="Enter Mohsin master key..."
                    className="w-full px-4 py-3 rounded-xl bg-black/60 border border-rose-900/40 text-white text-sm font-mono focus:outline-none focus:border-rose-500"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Protected by server-side verification and constant-time secret evaluation.
                  </p>
                </div>
              )}

              {ownerAuthMethod === 'google' && (
                <div className="space-y-3 py-2">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Canonical Owner accounts (<span className="text-rose-300 font-mono">mohsin@hoorvia.net</span> or <span className="text-rose-300 font-mono">friskymohsin55@gmail.com</span>) are verified server-side against Google Identity Services.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Google OAuth ID Token / Credential
                    </label>
                    <input
                      type="text"
                      value={ownerGoogleToken}
                      onChange={(e) => setOwnerGoogleToken(e.target.value)}
                      placeholder="Paste Google JWT / Credential token..."
                      className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-rose-900/40 text-white text-xs font-mono focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-rose-950 text-[11px] text-slate-400">
                    💡 Tip: For faster direct access without pasting Google tokens, use the <strong className="text-rose-300 font-semibold cursor-pointer" onClick={() => setOwnerAuthMethod('passkey')}>Passkey</strong> or <strong className="text-rose-300 font-semibold cursor-pointer" onClick={() => setOwnerAuthMethod('password')}>Credentials</strong> tab.
                  </div>
                </div>
              )}

              {ownerAuthMethod === 'password' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Owner Email</label>
                    <input
                      type="email"
                      required
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-rose-900/40 text-white text-sm focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-rose-900/40 text-white text-sm focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowOwnerModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 text-slate-300 text-xs font-medium hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isOwnerSubmitting}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-bold shadow-lg shadow-rose-950/60 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isOwnerSubmitting ? (
                    'Verifying Owner Rights...'
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Authenticate as Owner
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
