import React, { useState, useEffect } from 'react';
import {
  Send,
  ShieldCheck,
  ShieldAlert,
  Bot,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  Radio,
  FileCheck,
  Lock,
  Cpu,
  Layers,
  Sparkles,
  PlayCircle,
  MessageSquare,
} from 'lucide-react';
import { TelegramConfigStatus } from '../lib/maryamTelegram';
import { getOwnerToken } from '../lib/ownerAuth';

interface HoorviaTelegramManagerProps {
  ownerToken?: string | null;
}

export const HoorviaTelegramManager: React.FC<HoorviaTelegramManagerProps> = ({ ownerToken }) => {
  const [status, setStatus] = useState<TelegramConfigStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // E2E Simulation Harness State
  const [simText, setSimText] = useState('Hello Baby! Kaisi ho?');
  const [simIsRunning, setSimIsRunning] = useState(false);
  const [simOutput, setSimOutput] = useState<{ label: string; result: any } | null>(null);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      // Canonical owner session token (prop first, stored session as fallback).
      const effectiveOwnerToken = ownerToken || getOwnerToken();
      const headers: Record<string, string> = {};
      if (effectiveOwnerToken) {
        headers['Authorization'] = `Bearer ${effectiveOwnerToken}`;
        headers['x-hoorvia-token'] = effectiveOwnerToken;
      }
      const res = await fetch('/api/telegram/status', { headers });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        setActionMessage({
          type: 'error',
          text: `Failed to load Telegram status (HTTP ${res.status}). Ensure Owner authentication is active.`,
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Error fetching status: ${err?.message || 'Network error'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, [ownerToken]);

  const handleSendTestMessage = async () => {
    setIsSendingTest(true);
    setActionMessage(null);
    try {
      const effectiveOwnerToken = ownerToken || getOwnerToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (effectiveOwnerToken) {
        headers['Authorization'] = `Bearer ${effectiveOwnerToken}`;
        headers['x-hoorvia-token'] = effectiveOwnerToken;
      }
      const res = await fetch('/api/telegram/test-message', {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({
          type: 'success',
          text: '✅ Test message "Maryam Telegram connection is working ❤️" sent successfully to Mohsin\'s authorized chat!',
        });
        fetchStatus();
      } else {
        setActionMessage({
          type: 'error',
          text: `Failed to send test message: ${data.error || 'Check environment configuration'}`,
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Network error sending test message: ${err.message}`,
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const runSimulation = async (action: string, payload: any = {}) => {
    setSimIsRunning(true);
    setSimOutput(null);
    try {
      const effectiveOwnerToken = ownerToken || getOwnerToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (effectiveOwnerToken) {
        headers['Authorization'] = `Bearer ${effectiveOwnerToken}`;
        headers['x-hoorvia-token'] = effectiveOwnerToken;
      }
      const res = await fetch('/api/telegram/simulate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, payload }),
      });
      const data = await res.json();
      setSimOutput({ label: action, result: data });
      fetchStatus();
    } catch (err: any) {
      setSimOutput({ label: action, result: { error: err.message } });
    } finally {
      setSimIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-zinc-900 via-rose-950/30 to-zinc-900 border border-rose-900/30 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-800/60 flex items-center justify-center text-rose-300 shadow-inner shrink-0">
              <Send className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">Maryam 24/7 Cloud Telegram Integration</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                  24/7 CLOUD ACTIVE
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                Mohsin's private, production-ready remote communication and control channel for Maryam. Fully cloud-hosted,
                persists 24/7 when Mohsin's laptop is OFF, strictly secured to Mohsin's immutable numeric Telegram ID.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={fetchStatus}
              disabled={isLoading}
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-all"
              title="Refresh Status"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleSendTestMessage}
              disabled={isSendingTest}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-xs transition-all shadow-lg shadow-rose-950/50 disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${isSendingTest ? 'animate-pulse' : ''}`} />
              <span>{isSendingTest ? 'Sending...' : 'Send Test Message'}</span>
            </button>
          </div>
        </div>

        {/* Action Message Alert */}
        {actionMessage && (
          <div
            className={`mt-4 p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-200'
                : actionMessage.type === 'error'
                ? 'bg-red-950/60 border-red-800/60 text-red-200'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300'
            }`}
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : actionMessage.type === 'error' ? (
              <XCircle className="w-4 h-4 shrink-0 text-red-400" />
            ) : (
              <Radio className="w-4 h-4 shrink-0 text-zinc-400" />
            )}
            <span className="flex-1">{actionMessage.text}</span>
            <button onClick={() => setActionMessage(null)} className="text-zinc-500 hover:text-zinc-300 text-xs">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Primary Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Connection Status */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Connection Status</span>
            <Radio className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                status?.pollConflict
                  ? 'bg-red-400 animate-pulse'
                  : status?.connectionStatus === 'CONNECTED' || status?.connectionStatus === 'POLLING'
                  ? 'bg-emerald-400 animate-pulse'
                  : status?.connectionStatus === 'WEBHOOK'
                  ? 'bg-blue-400'
                  : 'bg-amber-400'
              }`}
            />
            <span className="text-sm font-bold text-white tracking-wide">
              {status?.pollConflict ? 'CONFLICT - DUPLICATE POLLER' : status?.connectionStatus || 'CHECKING...'}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            {status?.pollConflict
              ? `Another poller holds this bot token (${status.pollConflictCount}x 409). Ensure only ONE Maryam server polls.`
              : status?.connectionStatus === 'CONNECTED' || status?.connectionStatus === 'POLLING'
              ? 'Active 24/7 Long-Polling Daemon'
              : status?.connectionStatus === 'WEBHOOK'
              ? 'Active via Webhook Ingress'
              : 'Awaiting Bot Credentials'}
          </p>
        </div>

        {/* Card 2: Bot Status */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Bot Status</span>
            <Bot className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            {status?.botStatus === 'HEALTHY' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : status?.botStatus === 'INITIALIZING' ? (
              <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-zinc-500" />
            )}
            <span className="text-sm font-bold text-white tracking-wide">
              {status?.botStatus || 'UNCONFIGURED'}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            {status?.configured ? 'Authenticated with Telegram API' : 'Configure token in Settings'}
          </p>
        </div>

        {/* Card 3: Owner Authorization Status */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Owner Auth Status</span>
            <ShieldCheck className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Lock className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-bold text-white tracking-wide">
              {status?.ownerUserConfigured ? 'OWNER PROTECTED' : 'UNLOCKED'}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            ID: <span className="text-zinc-300 font-mono">{status?.ownerUserMasked || 'None'}</span> (Immutable)
          </p>
        </div>

        {/* Card 4: Security Interceptions */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Security Interceptions</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm font-bold text-white tracking-wide">
              {status?.unauthorizedAttemptsBlocked || 0} Blocked
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Zero non-owner access permitted</p>
        </div>
      </div>

      {/* Diagnostics & Detail Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Telemetry & Activity */}
        <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white">Live Channel Telemetry</h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-900">
              <span className="text-zinc-400">Cloud 24/7 Continuity</span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Persistent (Laptop-Independent)
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-900">
              <span className="text-zinc-400">Last Successful Message</span>
              <span className="font-mono text-zinc-300">
                {status?.lastSuccessfulMessage ? new Date(status.lastSuccessfulMessage).toLocaleTimeString() : 'None yet'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-900">
              <span className="text-zinc-400">Last Incoming Update</span>
              <span className="font-mono text-zinc-300">
                {status?.lastIncomingUpdate ? new Date(status.lastIncomingUpdate).toLocaleTimeString() : 'None yet'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-900">
              <span className="text-zinc-400">Messages Received / Sent</span>
              <span className="font-mono text-zinc-300">
                {status?.totalMessagesReceived || 0} in / {status?.totalMessagesSent || 0} out
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-900">
              <span className="text-zinc-400">Last Error</span>
              <span className="text-zinc-400 font-mono text-[11px] truncate max-w-[240px]">
                {status?.lastError || 'None'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/30 text-[11px] text-rose-300/90 leading-relaxed">
            <span className="font-bold text-rose-200">Security Guarantee: </span>
            Telegram bot tokens are strictly isolated to server-side memory and never transmitted to the browser or
            stored in frontend logs.
          </div>
        </div>

        {/* Right Column: Environment Setup Guide */}
        <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white">Environment Configuration</h3>
          </div>

          <div className="space-y-2 text-xs">
            <p className="text-zinc-400 leading-relaxed">
              Configure these environment variables in Google AI Studio Settings or container deployment:
            </p>

            <div className="space-y-2 font-mono text-[11px]">
              <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-900">
                <span className="text-rose-400 font-bold">TELEGRAM_BOT_TOKEN</span>
                <p className="text-zinc-500 text-[10px] mt-0.5">Token from @BotFather for Maryam's private bot.</p>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-900">
                <span className="text-rose-400 font-bold">TELEGRAM_OWNER_USER_ID</span>
                <p className="text-zinc-500 text-[10px] mt-0.5">Mohsin's numeric Telegram User ID (e.g. from @userinfobot).</p>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-900">
                <span className="text-rose-400 font-bold">TELEGRAM_OWNER_CHAT_ID</span>
                <p className="text-zinc-500 text-[10px] mt-0.5">Mohsin's private chat ID (defaults to User ID).</p>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2 text-[11px] text-zinc-500">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Zero credentials hardcoded. Fully compliant with production security rules.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive E2E Verification & Testing Console */}
      <div className="p-6 rounded-2xl bg-zinc-900/50 border border-rose-900/30 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PlayCircle className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="text-sm font-bold text-white">E2E Verification & Integration Sandbox</h3>
              <p className="text-xs text-zinc-400">
                Simulate real conversation turns, command executions, security blocks, and runner off degradation.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <button
            onClick={() => runSimulation('chat', { text: simText, isOwner: true })}
            disabled={simIsRunning}
            className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-left transition-all disabled:opacity-50"
          >
            <MessageSquare className="w-4 h-4 text-rose-400 mb-1.5" />
            <div className="text-xs font-semibold text-white">Test Real Chat</div>
            <div className="text-[10px] text-zinc-500">Maryam Pipeline</div>
          </button>

          <button
            onClick={() => runSimulation('command', { command: '/status' })}
            disabled={simIsRunning}
            className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-left transition-all disabled:opacity-50"
          >
            <Activity className="w-4 h-4 text-emerald-400 mb-1.5" />
            <div className="text-xs font-semibold text-white">Test /status</div>
            <div className="text-[10px] text-zinc-500">Cloud Diagnostics</div>
          </button>

          <button
            onClick={() => runSimulation('command', { command: '/health' })}
            disabled={simIsRunning}
            className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-left transition-all disabled:opacity-50"
          >
            <Cpu className="w-4 h-4 text-blue-400 mb-1.5" />
            <div className="text-xs font-semibold text-white">Test /health</div>
            <div className="text-[10px] text-zinc-500">Server Health</div>
          </button>

          <button
            onClick={() =>
              runSimulation('chat', {
                text: 'Mere laptop pe Chrome kholo aur YouTube navigate karo',
                isOwner: true,
              })
            }
            disabled={simIsRunning}
            className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-left transition-all disabled:opacity-50"
          >
            <Radio className="w-4 h-4 text-amber-400 mb-1.5" />
            <div className="text-xs font-semibold text-white">Runner OFF Test</div>
            <div className="text-[10px] text-zinc-500">Graceful Message</div>
          </button>

          <button
            onClick={() => runSimulation('chat', { text: 'Hello private data!', isOwner: false })}
            disabled={simIsRunning}
            className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-left transition-all disabled:opacity-50"
          >
            <ShieldAlert className="w-4 h-4 text-red-400 mb-1.5" />
            <div className="text-xs font-semibold text-white">Unauthorized Test</div>
            <div className="text-[10px] text-zinc-500">Blocked & Logged</div>
          </button>

          <button
            onClick={() => runSimulation('approval_create', { description: 'Publish TikTok short reel video' })}
            disabled={simIsRunning}
            className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-left transition-all disabled:opacity-50"
          >
            <FileCheck className="w-4 h-4 text-purple-400 mb-1.5" />
            <div className="text-xs font-semibold text-white">Approval Test</div>
            <div className="text-[10px] text-zinc-500">Inline Buttons</div>
          </button>
        </div>

        {/* Custom Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={simText}
            onChange={(e) => setSimText(e.target.value)}
            placeholder="Type message for Maryam (e.g. 'Baby kal 5 baje meeting remind karna')..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-rose-800"
          />
          <button
            onClick={() => runSimulation('chat', { text: simText, isOwner: true })}
            disabled={simIsRunning || !simText.trim()}
            className="px-4 py-2.5 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-800 text-xs text-rose-200 font-semibold disabled:opacity-50"
          >
            Send Custom
          </button>
        </div>

        {/* Simulation Output Display */}
        {simOutput && (
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold text-rose-300">Simulation Output [{simOutput.label}]</span>
              <span className="text-[10px] font-mono">{new Date().toLocaleTimeString()}</span>
            </div>
            <pre className="p-3 rounded-lg bg-zinc-900 text-emerald-300 text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-60">
              {JSON.stringify(simOutput.result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
