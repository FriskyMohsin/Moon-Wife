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
              onClick={() => setAuthMode('login')}
              className="text-sm text-rose-300 hover:text-rose-100 transition-colors"
            >
              Already have an account? <span className="underline font-semibold">Sign In</span>
            </button>
          ) : (
            <button
              onClick={() => setAuthMode('register')}
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

      {/* Main Content — simple single page */}
      <main className="relative z-10 max-w-md w-full mx-auto px-6 py-10 flex-1 flex flex-col justify-center">
        <div className="text-center space-y-3 mb-8">
          <div className="relative w-28 h-28 mx-auto">
            <div className="absolute inset-0 rounded-full bg-rose-500/30 blur-xl" />
            <img
              src="/pari-avatar-face.png"
              alt="Pari AI"
              className="relative w-28 h-28 rounded-full object-cover border-2 border-rose-400/50 shadow-2xl"
            />
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-white">
            Pari <span className="text-rose-400">AI</span>
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Your personal AI companion — call and talk, chat, set reminders. She remembers what matters.
          </p>
        </div>

        <form
          onSubmit={handleSubmitAuth}
          className="space-y-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800"
        >
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setAuthMode('register')}
              className={`flex-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                authMode === 'register' ? 'bg-rose-950 text-rose-300' : 'text-slate-400'
              }`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`flex-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                authMode === 'login' ? 'bg-rose-950 text-rose-300' : 'text-slate-400'
              }`}
            >
              Sign In
            </button>
          </div>

          {authMode === 'register' && (
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm placeholder:text-slate-600 focus:border-rose-800 outline-none"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm placeholder:text-slate-600 focus:border-rose-800 outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm placeholder:text-slate-600 focus:border-rose-800 outline-none"
          />
          {authMode === 'register' && (
            <>
              <input
                type="password"
                placeholder="Your Gemini API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm placeholder:text-slate-600 focus:border-rose-800 outline-none"
              />
              {GEMINI_KEY_TUTORIAL_VIDEO_URL ? (
                <div className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  <p className="font-semibold text-slate-300 mb-1.5">How to get your free Gemini API key:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-rose-300 hover:text-rose-200 underline">aistudio.google.com/apikey</a></li>
                    <li>Sign in with your Google account</li>
                    <li>Click <strong className="text-slate-200">"Create API Key"</strong></li>
                    <li>Copy the key and paste it above</li>
                  </ol>
                  <a
                    href={GEMINI_KEY_TUTORIAL_VIDEO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rose-300 hover:text-rose-200 mt-2 inline-block"
                  >
                    ▶ Watch video tutorial
                  </a>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value as CompanionVoice)}
                  className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none"
                >
                  {HOORVIA_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <SearchableLanguagePicker
                  selectedLanguage={language}
                  onSelectLanguage={setLanguage}
                  compact={true}
                />
              </div>
            </>
          )}

          {errorMessage && (
            <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/40 rounded-xl px-3 py-2">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-medium text-sm transition-all disabled:opacity-60"
          >
            {isSubmitting ? 'Please wait…' : authMode === 'register' ? 'Start with Pari AI' : 'Sign In'}
          </button>
        </form>

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
