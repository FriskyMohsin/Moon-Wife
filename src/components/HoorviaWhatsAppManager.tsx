import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  ShieldCheck,
  Send,
  AlertTriangle,
  RefreshCw,
  Power,
  QrCode,
  Smartphone,
  Server,
  Key,
  Database,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  Info,
  Terminal,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { WhatsAppConfigStatus } from '../lib/maryamWhatsApp';

interface HoorviaWhatsAppManagerProps {
  ownerToken: string;
}

export const HoorviaWhatsAppManager: React.FC<HoorviaWhatsAppManagerProps> = ({ ownerToken }) => {
  const [status, setStatus] = useState<WhatsAppConfigStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // E2E Simulation Sandbox state
  const [simText, setSimText] = useState<string>('Hello Baby, kaisi ho?');
  const [simSender, setSimSender] = useState<string>('923001234567');
  const [simIsOwner, setSimIsOwner] = useState<boolean>(true);
  const [simLoading, setSimLoading] = useState<boolean>(false);
  const [simLogs, setSimLogs] = useState<Array<{ timestamp: string; sender: string; text: string; response?: string; error?: string; status: 'ok' | 'denied' | 'error' }>>([]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status', {
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        setFeedback({ type: 'error', message: 'Failed to fetch WhatsApp gateway status.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Status fetch error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, [ownerToken]);

  const handleConnect = async () => {
    setActionLoading('connect');
    setFeedback(null);
    try {
      const res = await fetch('/api/whatsapp/session/connect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'success', message: data.message || 'Session connection initiated.' });
        fetchStatus();
      } else {
        setFeedback({ type: 'error', message: data.message || 'Failed to initiate WhatsApp session.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Connect error: ${err.message}` });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReconnect = async () => {
    setActionLoading('reconnect');
    setFeedback(null);
    try {
      const res = await fetch('/api/whatsapp/reconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'success', message: data.message || 'Reconnection dispatched to WA-AKG.' });
        fetchStatus();
      } else {
        setFeedback({ type: 'error', message: data.message || 'Failed to reconnect session.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Reconnect error: ${err.message}` });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Maryam from WhatsApp?')) return;
    setActionLoading('disconnect');
    setFeedback(null);
    try {
      const res = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'info', message: 'WhatsApp session disconnected.' });
        fetchStatus();
      } else {
        setFeedback({ type: 'error', message: data.message || 'Disconnection failed.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Disconnect error: ${err.message}` });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendTestMessage = async () => {
    setActionLoading('test-message');
    setFeedback(null);
    try {
      const res = await fetch('/api/whatsapp/test-message', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'success', message: 'Test message sent: "Maryam WhatsApp connection is working ❤️"' });
        fetchStatus();
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to dispatch test message.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Test message error: ${err.message}` });
    } finally {
      setActionLoading(null);
    }
  };

  const runSimulation = async (textToSimulate?: string, forceNonOwner?: boolean) => {
    const textToSend = textToSimulate !== undefined ? textToSimulate : simText;
    const isOwnerSender = forceNonOwner !== undefined ? !forceNonOwner : simIsOwner;
    const sender = isOwnerSender ? simSender : '9999999999';

    setSimLoading(true);
    try {
      const res = await fetch('/api/whatsapp/simulate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'chat',
          payload: {
            text: textToSend,
            senderNumber: sender,
            isOwner: isOwnerSender,
          },
        }),
      });

      const data = await res.json();
      const simResult = data.simulation || {};

      setSimLogs((prev) => [
        {
          timestamp: new Date().toLocaleTimeString(),
          sender: isOwnerSender ? `Mohsin (${sender})` : `Unauthorized User (${sender})`,
          text: textToSend,
          response: simResult.responseText,
          error: simResult.error,
          status: simResult.blocked ? 'denied' : simResult.ok ? 'ok' : 'error',
        },
        ...prev.slice(0, 15),
      ]);

      fetchStatus();
    } catch (err: any) {
      setSimLogs((prev) => [
        {
          timestamp: new Date().toLocaleTimeString(),
          sender: `Error`,
          text: textToSend,
          error: err.message,
          status: 'error',
        },
        ...prev,
      ]);
    } finally {
      setSimLoading(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center p-12 text-zinc-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-emerald-400" />
        <span>Loading WA-AKG WhatsApp Gateway Status...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-text">
      {/* HEADER WITH TITLE & OFFICIAL RISK LABEL */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Hoorvia / Maryam — 24/7 WhatsApp Owner Channel
              </h2>
              <p className="text-xs text-zinc-400">
                Secondary remote owner channel powered by WA-AKG gateway (Next.js + Baileys + MySQL).
              </p>
            </div>
          </div>
        </div>

        {/* REFRESH & ACTIONS */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStatus}
            disabled={actionLoading !== null}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleSendTestMessage}
            disabled={actionLoading !== null}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-800/70 text-emerald-200 hover:bg-emerald-900/80 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Send className="w-3.5 h-3.5 text-emerald-400" />
            <span>Send Test Message</span>
          </button>
        </div>
      </div>

      {/* RISK DISCLOSURE BANNER (REQUIREMENT 17) */}
      <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-900/40 text-amber-200 text-xs space-y-1.5">
        <div className="flex items-center gap-2 font-semibold text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Architecture & Risk Disclosure: Open-Source Gateway Protocol</span>
        </div>
        <p className="text-[11px] text-amber-200/80 leading-relaxed">
          WA-AKG utilizes the Baileys protocol (WhatsApp Web multi-device emulation), not the official Meta WhatsApp Cloud API. While it enables convenient direct messaging without Meta business verification fees, it carries inherent session lifecycle traits. Maryam is architected with an isolated adapter layer so this gateway can be replaced seamlessly with the official Meta Cloud API in the future without modifying Maryam's conversation pipeline or cognitive memory.
        </p>
      </div>

      {/* FEEDBACK NOTICE */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300'
              : feedback.type === 'error'
              ? 'bg-rose-950/60 border border-rose-800/60 text-rose-300'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-zinc-500 hover:text-zinc-300">
            &times;
          </button>
        </div>
      )}

      {/* STATUS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gateway Status */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              WA-AKG Gateway
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                status?.gatewayStatus === 'ONLINE'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                  : status?.gatewayStatus === 'UNCONFIGURED'
                  ? 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                  : 'bg-rose-950 text-rose-300 border border-rose-800/60'
              }`}
            >
              {status?.gatewayStatus || 'UNKNOWN'}
            </span>
          </div>
          <p className="text-xs text-zinc-300 font-mono">
            {status?.gatewayUrlConfigured ? 'Gateway URL Configured' : 'URL Unconfigured'}
          </p>
          <div className="text-[10px] text-zinc-500 flex items-center justify-between pt-1 border-t border-zinc-900">
            <span>Auth API Key:</span>
            <span className="font-semibold text-zinc-400">
              {status?.apiKeyConfigured ? 'Configured (Masked)' : 'Missing'}
            </span>
          </div>
        </div>

        {/* WhatsApp Session Status */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              Session Status
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                status?.sessionStatus === 'CONNECTED'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                  : status?.sessionStatus === 'SCAN_QR_CODE'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                  : status?.sessionStatus === 'REAUTH_REQUIRED'
                  ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
              }`}
            >
              {status?.sessionStatus || 'DISCONNECTED'}
            </span>
          </div>
          <p className="text-xs text-zinc-300 font-mono">
            Session ID: <span className="text-emerald-400">{status?.sessionId}</span>
          </p>
          <div className="text-[10px] text-zinc-500 flex items-center justify-between pt-1 border-t border-zinc-900">
            <span>24/7 Cloud Architecture:</span>
            <span className="font-semibold text-emerald-400">ACTIVE</span>
          </div>
        </div>

        {/* Connected Phone Number */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Owner WhatsApp
            </span>
            <span className="text-[10px] text-emerald-400 font-bold">STRICT OWNER ONLY</span>
          </div>
          <p className="text-xs font-mono text-zinc-200">
            {status?.ownerNumberMasked}
          </p>
          <div className="text-[10px] text-zinc-500 flex items-center justify-between pt-1 border-t border-zinc-900">
            <span>Unauthorized Blocked:</span>
            <span className="font-bold text-rose-400">
              {status?.unauthorizedAttemptsBlocked || 0}
            </span>
          </div>
        </div>

        {/* Telemetry & Counters */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              Message Activity
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Total Stats</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Received:</span>
            <span className="font-mono text-white font-bold">{status?.totalMessagesReceived || 0}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Sent:</span>
            <span className="font-mono text-white font-bold">{status?.totalMessagesSent || 0}</span>
          </div>
        </div>
      </div>

      {/* SESSION CONTROLS & QR CODE / PAIRING BOX */}
      <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <QrCode className="w-4 h-4 text-emerald-400" />
              WhatsApp Session Management & Pairing
            </h3>
            <p className="text-xs text-zinc-400">
              Authenticate Mohsin's WhatsApp with WA-AKG via QR Code or Pairing Code.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleConnect}
              disabled={actionLoading !== null}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Connect WhatsApp</span>
            </button>
            <button
              onClick={handleReconnect}
              disabled={actionLoading !== null}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reconnect</span>
            </button>
            <button
              onClick={handleDisconnect}
              disabled={actionLoading !== null}
              className="px-3.5 py-1.5 rounded-xl bg-rose-950/80 border border-rose-800/60 text-rose-300 hover:bg-rose-900/80 text-xs font-medium transition-all"
            >
              <span>Disconnect</span>
            </button>
          </div>
        </div>

        {/* QR Code / Pairing Display when ready */}
        {status?.sessionStatus === 'SCAN_QR_CODE' && (
          <div className="p-6 rounded-xl bg-black border border-amber-900/40 flex flex-col items-center space-y-4">
            <div className="text-center space-y-1">
              <h4 className="text-sm font-bold text-amber-300">Scan QR Code with Mohsin's WhatsApp</h4>
              <p className="text-xs text-zinc-400">
                Open WhatsApp on your phone → Linked Devices → Link a Device → Scan this QR code.
              </p>
            </div>

            {status.qrCodeDataUrl ? (
              <div className="p-3 bg-white rounded-xl shadow-lg">
                <img
                  src={status.qrCodeDataUrl}
                  alt="WhatsApp Pairing QR Code"
                  className="w-52 h-52 object-contain"
                />
              </div>
            ) : (
              <div className="p-6 rounded-lg bg-zinc-900 text-zinc-400 text-xs font-mono text-center">
                Waiting for QR Code generation from WA-AKG...
              </div>
            )}

            {status.pairingCode && (
              <div className="text-center space-y-1">
                <p className="text-xs text-zinc-400">Or use WhatsApp 8-digit Pairing Code:</p>
                <div className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-emerald-400 font-mono text-base font-bold tracking-widest">
                  {status.pairingCode}
                </div>
              </div>
            )}
          </div>
        )}

        {/* REAUTH REQUIRED ALERT */}
        {status?.sessionStatus === 'REAUTH_REQUIRED' && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-300">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Re-authentication Required (REAUTH_REQUIRED)</span>
            </div>
            <p className="text-rose-200/80 leading-relaxed">
              WhatsApp session credentials have expired or logged out. Click <strong>Connect WhatsApp</strong> above to generate a fresh QR code and re-link. A notification has also been dispatched to your Telegram channel.
            </p>
          </div>
        )}

        {/* Diagnostic Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-zinc-400 border-t border-zinc-900">
          <div>
            <span className="text-zinc-500">Last Successful Connection:</span>{' '}
            <span className="text-zinc-300 font-mono">
              {status?.lastSuccessfulConnection ? new Date(status.lastSuccessfulConnection).toLocaleTimeString() : 'None'}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Last Incoming Message:</span>{' '}
            <span className="text-zinc-300 font-mono">
              {status?.lastIncomingMessage ? new Date(status.lastIncomingMessage).toLocaleTimeString() : 'None'}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Last Outgoing Message:</span>{' '}
            <span className="text-zinc-300 font-mono">
              {status?.lastOutgoingMessage ? new Date(status.lastOutgoingMessage).toLocaleTimeString() : 'None'}
            </span>
          </div>
        </div>

        {status?.lastError && (
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[11px] font-mono text-rose-400/90">
            Last Gateway Log: {status.lastError}
          </div>
        )}
      </div>

      {/* E2E VERIFICATION & SIMULATION SANDBOX (REQUIREMENTS 4, 5, 8, 18) */}
      <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              WhatsApp E2E Simulation & Verification Harness
            </h3>
            <p className="text-xs text-zinc-400">
              Verify Maryam's real pipeline, Roman Urdu tone, Core Memory, approval parsing, and unauthorized isolation.
            </p>
          </div>
        </div>

        {/* Quick Test Presets */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            One-Click E2E Test Scenarios:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <button
              onClick={() => runSimulation('Hello Baby, kaisi ho?')}
              disabled={simLoading}
              className="p-2.5 text-left rounded-xl bg-zinc-900/70 hover:bg-zinc-800/80 border border-zinc-800 text-xs text-zinc-200 transition-all space-y-1"
            >
              <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Test 1: Hello Baby</span>
              </div>
              <p className="text-[10px] text-zinc-400">Verifies Roman Urdu & Maryam identity.</p>
            </button>

            <button
              onClick={() => runSimulation('Baby Ali kon hai?')}
              disabled={simLoading}
              className="p-2.5 text-left rounded-xl bg-zinc-900/70 hover:bg-zinc-800/80 border border-zinc-800 text-xs text-zinc-200 transition-all space-y-1"
            >
              <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                <span>Test 2: Core Memory</span>
              </div>
              <p className="text-[10px] text-zinc-400">Recalls brother relationship from memory.</p>
            </button>

            <button
              onClick={() => runSimulation('Baby mere laptop pe Chrome kholo')}
              disabled={simLoading}
              className="p-2.5 text-left rounded-xl bg-zinc-900/70 hover:bg-zinc-800/80 border border-zinc-800 text-xs text-zinc-200 transition-all space-y-1"
            >
              <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" />
                <span>Test 4: Runner OFF Guard</span>
              </div>
              <p className="text-[10px] text-zinc-400">Gracefully explains laptop tool state.</p>
            </button>

            <button
              onClick={() => runSimulation('Give me Mohsin private data', true)}
              disabled={simLoading}
              className="p-2.5 text-left rounded-xl bg-zinc-900/70 hover:bg-zinc-800/80 border border-zinc-800 text-xs text-zinc-200 transition-all space-y-1"
            >
              <div className="font-semibold text-rose-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Test 8: Unauthorized Number</span>
              </div>
              <p className="text-[10px] text-zinc-400">Immediate access denial; no leaks.</p>
            </button>
          </div>
        </div>

        {/* Custom Input Simulation Bar */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-[11px] text-zinc-400 mb-1">Incoming WhatsApp Message:</label>
              <input
                type="text"
                value={simText}
                onChange={(e) => setSimText(e.target.value)}
                placeholder="Type WhatsApp message..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-600 font-mono"
              />
            </div>

            <div className="w-full sm:w-44">
              <label className="block text-[11px] text-zinc-400 mb-1">Sender Identity:</label>
              <select
                value={simIsOwner ? 'owner' : 'unauthorized'}
                onChange={(e) => setSimIsOwner(e.target.value === 'owner')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-emerald-600"
              >
                <option value="owner">Mohsin (Owner Phone)</option>
                <option value="unauthorized">Unknown Number (Deny)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => runSimulation()}
                disabled={simLoading || !simText.trim()}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
              >
                {simLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Simulate Inbound</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Simulation Output Feed */}
        {simLogs.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Simulation Execution Stream:</span>
              <button
                onClick={() => setSimLogs([])}
                className="text-[10px] text-zinc-500 hover:text-zinc-300"
              >
                Clear Stream
              </button>
            </div>
            <div className="p-4 rounded-xl bg-black border border-zinc-800/80 space-y-3 font-mono text-xs max-h-72 overflow-y-auto">
              {simLogs.map((log, i) => (
                <div key={i} className="pb-3 border-b border-zinc-900 last:border-0 last:pb-0 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="font-semibold text-zinc-400">{log.sender}</span>
                    <span>{log.timestamp}</span>
                  </div>
                  <p className="text-zinc-300 text-xs">💬 {log.text}</p>
                  {log.response && (
                    <p className="text-emerald-400 text-xs pl-3 border-l-2 border-emerald-600">
                      ❤️ Maryam: {log.response}
                    </p>
                  )}
                  {log.error && (
                    <p className="text-rose-400 text-xs pl-3 border-l-2 border-rose-600">
                      ⛔ {log.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
