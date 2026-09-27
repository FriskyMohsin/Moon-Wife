import React, { useState } from 'react';
import {
  Sparkles,
  Bot,
  UserCheck,
  Key,
  ArrowRight,
  ArrowLeft,
  Volume2,
  Lock,
  Globe,
  Play,
  Square,
  X,
  AlertCircle,
  Mic,
  MessageSquare,
  Brain,
  FileText,
  Bell,
  CheckCircle,
} from 'lucide-react';
import { CompanionVoice } from '../lib/hoorviaTypes';
import { HOORVIA_VOICES, playVoiceSample } from '../lib/voicePreview';
import { SearchableLanguagePicker } from './SearchableLanguagePicker';
import { PariBrand } from './PariBrand';
import { GEMINI_KEY_TUTORIAL_VIDEO_URL } from '../lib/pariConfig';

interface HoorviaLandingProps {
  onLoginSuccess: (data: { token: string; user: any; companion: any }) => void;
  onOwnerAuthenticated?: (data: { token: string; user: any; companion: any }) => void;
  onContinueAsGuestOwner?: () => void;
}

// Fixed Pari AI profile sent at registration — the 41-preset catalog is gone.
const PARI_FIXED_PROFILE = {
  name: 'Pari AI',
  type: 'pari_assistant',
  gender: 'female' as const,
  tone: 'Friendly' as const,
  personality:
    'Pari AI — your personal AI companion. Warm, helpful, and proactive: she chats, remembers what matters, manages your tasks and reminders, and creates files and content on request.',
  communicationStyle:
    'Natural and conversational, like talking to a smart friend on a call. Clear, warm, and to the point — in your language.',
};

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

  // Pari AI customization (name is fixed)
  const [voice, setVoice] = useState<CompanionVoice>('Aoede');
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>('English');
  const [autoMatchLanguage, setAutoMatchLanguage] = useState<boolean>(false);

  // Auth & BYOK State
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isGuestSubmitting, setIsGuestSubmitting] = useState<boolean>(false);

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

  const handleSubmitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (authMode === 'register') {
        if (!apiKey.trim() || apiKey.trim().length < 15) {
          throw new Error('Your own API key is required to activate Pari AI. Please provide a valid Google Gemini API Key.');
        }
      }

      const endpoint = authMode === 'register' ? '/api/hoorvia/auth/register' : '/api/hoorvia/auth/login';
      const bodyPayload: any = { email, password };
      if (authMode === 'register') {
        bodyPayload.name = name || 'Pari AI User';
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

      // Save the fixed Pari AI profile on register
      if (authMode === 'register' && companion) {
        await fetch('/api/hoorvia/companion', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hoorvia-Token': token,
          },
          body: JSON.stringify({
            ...PARI_FIXED_PROFILE,
            voice,
            language,
            autoMatchLanguage,
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

  // Isolated Guest entry: server mints an anonymous role:'user' guest
  // identity (never the owner). No owner data, admin, or runner access.
  const handleContinueAsGuest = async () => {
    if (isGuestSubmitting) return;
    setErrorMessage(null);
    setIsGuestSubmitting(true);
    try {
      const res = await fetch('/api/hoorvia/auth/guest', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error || !data.token) {
        throw new Error(data.error || 'Guest entry failed. Please try again.');
      }
      onLoginSuccess({ token: data.token, user: data.user, companion: data.companion });
    } catch (err: any) {
      setErrorMessage(err.message || 'Guest entry failed. Please try again.');
    } finally {
      setIsGuestSubmitting(false);
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

  const PARI_FEATURES = [
    {
      icon: Mic,
      title: 'Voice-first — just call and talk',
      text: 'Tap one button and talk to Pari AI like Alexa. She listens, replies out loud, and gets things done.',
    },
    {
      icon: MessageSquare,
      title: 'Chat that remembers',
      text: 'Text or speak in your own language — Roman Urdu, English, or 24 more. Pari AI remembers what matters to you.',
    },
    {
      icon: Bell,
      title: 'Tasks & reminders that fire',
      text: 'Say "remind me at 7" and it is done. Tasks persist, reminders arrive as push notifications — even when the app is closed.',
    },
    {
      icon: Brain,
      title: 'A memory that works for you',
      text: 'Pari AI auto-remembers facts in any language. View, edit, or delete them anytime from your Memory tab.',
    },
    {
      icon: FileText,
      title: 'Real files, on demand',
      text: 'Ask for a presentation, Word doc, spreadsheet, PDF, or EPUB manuscript — download the actual file in seconds.',
    },
    {
      icon: Sparkles,
      title: 'Content studio',
      text: 'Give a topic, pick a platform — get a ready post image, caption, and hashtags for your social media.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A070B] text-slate-100 flex flex-col justify-between selection:bg-rose-500/30 font-sans">
      {/* Background Glow Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-rose-900/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-purple-900/20 rounded-full blur-[140px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 max-w-7xl w-full mx-auto px-6 py-6 flex items-center justify-between border-b border-rose-950/40">
        <PariBrand size="lg" />

        <div className="flex items-center gap-4">
          {authMode === 'register' ? (
            <button
              onClick={() => {
                setAuthMode('login');
                setStep(3);
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

          <button
            onClick={handleContinueAsGuest}
            disabled={isGuestSubmitting}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-white disabled:opacity-60 text-slate-900 transition-all flex items-center gap-1.5"
            title="Enter as an isolated guest (no account needed)"
          >
            <UserCheck className="w-3.5 h-3.5" />
            {isGuestSubmitting ? 'Opening Guest…' : 'Continue as Guest'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-5xl w-full mx-auto px-6 py-10 flex-1 flex flex-col justify-center">
        {/* Step Indicator */}
        <div className="mb-8 flex items-center justify-center gap-2 text-xs font-medium text-rose-300/70">
          <span className={`px-3 py-1 rounded-full border ${step === 1 ? 'bg-rose-950 text-rose-300 border-rose-500/50' : 'bg-slate-900/60 border-slate-800'}`}>
            1. Meet Pari AI
          </span>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <span className={`px-3 py-1 rounded-full border ${step === 2 ? 'bg-rose-950 text-rose-300 border-rose-500/50' : 'bg-slate-900/60 border-slate-800'}`}>
            2. Customize
          </span>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <span className={`px-3 py-1 rounded-full border ${step === 3 ? 'bg-rose-950 text-rose-300 border-rose-500/50' : 'bg-slate-900/60 border-slate-800'}`}>
            3. Account & AI Key
          </span>
        </div>

        {/* STEP 1: MEET PARI AI */}
        {step === 1 && (
          <div className="space-y-8 animate-fadeIn">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-950/60 border border-rose-800/40 text-xs font-semibold text-rose-300">
                <Mic className="w-3.5 h-3.5" />
                Voice-first personal AI companion
              </div>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
                Meet <span className="text-rose-400">Pari AI</span>
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
                Your personal AI companion that you simply <strong className="text-slate-200">call and talk to</strong> — like Alexa, but yours.
                Chat by text or voice, set tasks and reminders, and let her remember what matters to you.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PARI_FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-rose-900/60 transition-colors"
                  >
                    <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/40 text-rose-300 w-fit mb-3">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-white">{f.title}</h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{f.text}</p>
                  </div>
                );
              })}
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-rose-900/40 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                <strong className="text-white">One companion, no confusing catalog.</strong> Pari AI adapts to whatever you need —
                a chat partner, a reminder keeper, a study helper, a content maker. Just tell her.
              </p>
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-medium text-sm transition-all shadow-lg shadow-rose-950/50 flex items-center gap-2 shrink-0"
              >
                Continue: Customize <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CUSTOMIZE PARI AI */}
        {step === 2 && (
          <div className="space-y-6 max-w-2xl mx-auto w-full animate-fadeIn bg-slate-900/50 p-6 md:p-8 rounded-3xl border border-rose-950/60 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-2xl font-bold text-white">Customize Pari AI</h3>
                <p className="text-xs text-slate-400">Pick her voice and your language. Everything else just works.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Companion Name</label>
              <input
                type="text"
                value="Pari AI"
                readOnly
                disabled
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-sm cursor-not-allowed opacity-80"
              />
              <p className="text-[11px] text-slate-500 mt-1">Fixed for now — renamable later.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5 text-rose-400" /> Select Voice
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
                <Globe className="w-3.5 h-3.5 text-rose-400" /> Primary Language
              </label>
              <SearchableLanguagePicker
                selectedLanguage={language}
                onSelectLanguage={setLanguage}
                autoMatchLanguage={autoMatchLanguage}
                onToggleAutoMatch={setAutoMatchLanguage}
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
                Next: Account & AI Key <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: ACCOUNT CREATION & BYOK AI KEY */}
        {step === 3 && (
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
                  Your memories and Pari AI data remain 100% private and isolated.
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
                Your own API key is required to activate Pari AI. Connect your Google Gemini API key — it is encrypted
                at rest and never exposed to other users or logged.
              </p>
              <input
                type="password"
                required={authMode === 'register'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy... (Paste Google Gemini API Key)"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-rose-500"
              />
              {GEMINI_KEY_TUTORIAL_VIDEO_URL ? (
                <a
                  href={GEMINI_KEY_TUTORIAL_VIDEO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] text-rose-300 hover:text-rose-200 font-medium"
                >
                  <Play className="w-3 h-3 fill-current" />
                  How to get your Gemini API key? Watch the tutorial
                </a>
              ) : null}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
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
                  'Launching Pari AI...'
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    {authMode === 'register' ? 'Create Account & Launch' : 'Sign In & Connect'}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl w-full mx-auto px-6 py-6 border-t border-rose-950/30 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <p>© 2026 Pari AI — Your personal AI companion. All Rights Reserved.</p>
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
                      <CheckCircle className="w-4 h-4" />
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
