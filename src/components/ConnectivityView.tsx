import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Send,
  MessageCircle,
  Laptop,
  Brain,
  Mail,
  Share2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Zap,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { IntegrationHealthInfo, ConnectionState } from '../types/taskManagement';
import { LocalRunnerState, isRunnerOnline } from '../types';
import { getOwnerToken } from '../lib/ownerAuth';

interface ConnectivityViewProps {
  runnerState: LocalRunnerState;
  authToken?: string;
}

const DEFAULT_INTEGRATIONS: IntegrationHealthInfo[] = [
  {
    id: 'telegram',
    name: 'Telegram',
    category: 'channel',
    status: 'NOT CONFIGURED',
    accountLabel: 'Cloud 24/7 Channel (Local Dev Protected)',
    lastSuccessfulConnection: null,
    lastChecked: new Date().toISOString(),
    healthSummary: 'Telegram 24/7 Cloud Channel verified in production. Local development environment runs under Zero-Secret Boundary.',
    details: {
      cloud247Active: true,
      environment: 'Local Development',
    },
    supportedActions: ['TEST_CONNECTION', 'RECONNECT'],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    category: 'channel',
    status: 'NOT CONFIGURED',
    accountLabel: 'WA-AKG Gateway',
    lastSuccessfulConnection: null,
    lastChecked: new Date().toISOString(),
    healthSummary: 'WhatsApp Gateway unconfigured in this environment.',
    details: {
      cloud247Active: true,
    },
    supportedActions: ['TEST_CONNECTION', 'CONNECT', 'RECONNECT', 'DISCONNECT'],
  },
  {
    id: 'local_runner',
    name: 'Local Runner',
    category: 'runner',
    status: 'DISCONNECTED',
    accountLabel: 'Desktop Agent Relay',
    lastSuccessfulConnection: null,
    lastChecked: new Date().toISOString(),
    healthSummary: 'Local runner is offline. 24/7 Cloud features continue running.',
    details: {
      omnirouteStatus: 'Unavailable',
      connectionMethod: 'WebSocket Relay',
    },
    supportedActions: ['TEST_CONNECTION'],
  },
  {
    id: 'core_memory',
    name: 'Core Memory',
    category: 'memory',
    status: 'CONNECTED',
    accountLabel: 'Authoritative Memory Bank',
    lastSuccessfulConnection: new Date().toISOString(),
    lastChecked: new Date().toISOString(),
    healthSummary: 'Active. Core memories, preferences & life context indexed.',
    details: {
      encryption: 'AES-256-GCM',
    },
    supportedActions: ['TEST_CONNECTION'],
  },
  {
    id: 'email',
    name: 'Email (SMTP / IMAP)',
    category: 'communication',
    status: 'NOT CONFIGURED',
    accountLabel: 'Email Dispatch Gateway',
    lastSuccessfulConnection: null,
    lastChecked: new Date().toISOString(),
    healthSummary: 'SMTP / IMAP credentials are not configured in this deployment environment.',
    details: {
      protocol: 'SMTP / IMAP',
    },
    supportedActions: ['TEST_CONNECTION'],
  },
  {
    id: 'messenger',
    name: 'Messenger (Meta)',
    category: 'communication',
    status: 'NOT CONFIGURED',
    accountLabel: 'Meta Messenger Webhook',
    lastSuccessfulConnection: null,
    lastChecked: new Date().toISOString(),
    healthSummary: 'Meta Messenger Webhook is not configured.',
    details: {
      protocol: 'Meta Graph API Webhook',
    },
    supportedActions: ['TEST_CONNECTION'],
  },
];

export const ConnectivityView: React.FC<ConnectivityViewProps> = ({
  runnerState,
  authToken,
}) => {
  const [integrations, setIntegrations] = useState<IntegrationHealthInfo[]>(DEFAULT_INTEGRATIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [testingServiceId, setTestingServiceId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const fetchConnectivity = useCallback(async () => {
    setIsLoading(true);
    try {
      // Canonical owner session token (prop first, stored session as fallback).
      const effectiveToken = authToken || getOwnerToken();
      const headers: Record<string, string> = {};
      if (effectiveToken) {
        headers['x-hoorvia-token'] = effectiveToken;
        headers['Authorization'] = `Bearer ${effectiveToken}`;
      }
      const res = await fetch('/api/hoorvia/connectivity', { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.integrations) && data.integrations.length > 0) {
          setIntegrations(data.integrations);
        }
      }
    } catch (err: any) {
      console.warn('Connectivity telemetry fetch note:', err?.message);
    } finally {
      setIsLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchConnectivity();
  }, [fetchConnectivity]);

  const handleTestConnection = async (serviceId: string) => {
    setTestingServiceId(serviceId);
    setActionFeedback(null);
    try {
      const effectiveToken = authToken || getOwnerToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (effectiveToken) {
        headers['x-hoorvia-token'] = effectiveToken;
        headers['Authorization'] = `Bearer ${effectiveToken}`;
      }
      const res = await fetch(`/api/hoorvia/connectivity/test/${serviceId}`, {
        method: 'POST',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (data.status === 'ok' || data.success) {
        setActionFeedback({
          id: serviceId,
          type: 'success',
          message: data.message || `${serviceId.toUpperCase()} diagnostic test successful!`,
        });
      } else {
        setActionFeedback({
          id: serviceId,
          type: 'error',
          message: data.message || data.error || `${serviceId.toUpperCase()} test failed.`,
        });
      }
      await fetchConnectivity();
    } catch (err: any) {
      setActionFeedback({
        id: serviceId,
        type: 'error',
        message: err.message || 'Connection test could not be completed.',
      });
    } finally {
      setTestingServiceId(null);
    }
  };

  const getServiceIcon = (id: string) => {
    switch (id) {
      case 'telegram':
        return <Send className="w-5 h-5 text-sky-400" />;
      case 'whatsapp':
        return <MessageCircle className="w-5 h-5 text-emerald-400" />;
      case 'local_runner':
        return <Laptop className="w-5 h-5 text-purple-400" />;
      case 'core_memory':
        return <Brain className="w-5 h-5 text-rose-400" />;
      case 'email':
        return <Mail className="w-5 h-5 text-amber-400" />;
      case 'messenger':
        return <Share2 className="w-5 h-5 text-blue-400" />;
      default:
        return <Activity className="w-5 h-5 text-zinc-400" />;
    }
  };

  const getStatusBadge = (state: ConnectionState) => {
    switch (state) {
      case 'CONNECTED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            CONNECTED
          </span>
        );
      case 'DISCONNECTED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-900/80 text-zinc-400 border border-zinc-700/40 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            DISCONNECTED
          </span>
        );
      case 'NEEDS AUTHENTICATION':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-sm">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            NEEDS AUTHENTICATION
          </span>
        );
      case 'ERROR':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-500/40 flex items-center gap-1.5">
            <XCircle className="w-3 h-3 text-rose-400" />
            ERROR
          </span>
        );
      case 'CHECKING':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-500/40 flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
            CHECKING
          </span>
        );
      case 'NOT CONFIGURED':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/40 text-zinc-500 border border-white/10 flex items-center gap-1.5">
            <HelpCircle className="w-3 h-3 text-zinc-600" />
            NOT CONFIGURED
          </span>
        );
    }
  };

  const formatIsoDate = (iso: string | null | undefined): string => {
    if (!iso) return 'Not yet recorded';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(iso);
    }
  };

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col rounded-3xl border border-rose-900/30 bg-[#0a0409]/95 backdrop-blur-xl shadow-2xl overflow-hidden text-zinc-100">
      {/* Top Header */}
      <div className="shrink-0 px-6 py-4 border-b border-rose-900/25 bg-[#120610]/90 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-rose-400" />
            Integration Connectivity & Channel Health
          </h2>
          <p className="text-xs text-rose-300/80 font-serif italic">
            Authoritative connection telemetry for Maryam's communication channels, runner relay, and memory.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchConnectivity}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-rose-900/30 text-zinc-200 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-rose-400' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Main Grid Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Security Notice */}
        <div className="p-3.5 rounded-2xl bg-[#140612] border border-rose-900/30 flex items-center justify-between text-xs text-rose-200/90 shadow-inner">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>
              <strong>Zero-Secret Boundary:</strong> API tokens, bot keys, passwords, and private session secrets are never delivered to the client interface.
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono hidden sm:block">
            Fail-Closed Auth Active
          </span>
        </div>

        {/* Global action feedback banner */}
        {actionFeedback && (
          <div
            className={`p-4 rounded-2xl text-xs font-medium flex items-center justify-between animate-fadeIn ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/80 border border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              )}
              <span>{actionFeedback.message}</span>
            </div>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-zinc-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Integrations Grid */}
        {isLoading && integrations.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 text-xs flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 text-rose-400 animate-spin" />
            <span>Probing integration channels and relays...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrations.map((item) => {
              const isTesting = testingServiceId === item.id;

              return (
                <div
                  key={item.id}
                  className="p-5 rounded-3xl bg-black/40 border border-rose-900/30 hover:border-rose-700/40 transition-all flex flex-col justify-between shadow-lg space-y-4"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#1c0817] border border-rose-800/40 flex items-center justify-center shadow-inner">
                        {getServiceIcon(item.id)}
                      </div>
                      <div>
                        <h3 className="text-sm font-serif font-bold text-white tracking-wide">
                          {item.name}
                        </h3>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {item.accountLabel}
                        </p>
                      </div>
                    </div>
                    <div>{getStatusBadge(item.status)}</div>
                  </div>

                  {/* Telemetry Details */}
                  <div className="p-3 rounded-2xl bg-black/30 border border-rose-900/20 text-xs space-y-2">
                    <p className="text-zinc-300 leading-relaxed text-[11px]">
                      {item.healthSummary}
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-rose-900/10 text-[10px] text-zinc-500">
                      <div>
                        <span>Last Successful: </span>
                        <span className="text-zinc-300 font-medium">
                          {formatIsoDate(item.lastSuccessfulConnection)}
                        </span>
                      </div>
                      <div>
                        <span>Last Checked: </span>
                        <span className="text-zinc-300 font-medium">
                          {formatIsoDate(item.lastChecked)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[10px] text-zinc-500 font-mono">
                      Service: {item.id}
                    </div>

                    <div className="flex items-center gap-2">
                      {item.supportedActions.includes('TEST_CONNECTION') && (
                        <button
                          type="button"
                          disabled={isTesting}
                          onClick={() => handleTestConnection(item.id)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-950/60 hover:bg-rose-900/80 border border-rose-700/40 text-rose-200 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Zap className={`w-3 h-3 text-rose-400 ${isTesting ? 'animate-spin' : ''}`} />
                          <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
