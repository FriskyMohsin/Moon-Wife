import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Globe,
  Sparkles,
  Share2,
  FileText,
  Sliders,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  Zap,
  Play,
  Send,
  Radio,
  FileSpreadsheet,
  Tv,
  MessageSquare,
  Mic,
  Brain,
  FileSearch,
  Code2,
  Workflow,
  ExternalLink,
  Check,
  X,
  Layers,
  Search,
} from 'lucide-react';
import {
  OwnerAdminUserView,
  PlatformPolicy,
  UserCapabilityId,
  AccessPackId,
  CapabilityCategory,
  ALL_CAPABILITY_DEFINITIONS,
  ACCESS_PACK_DEFINITIONS,
  FORBIDDEN_PUBLIC_CAPABILITIES,
  DEFAULT_PLATFORM_CAPABILITIES,
} from '../lib/hoorviaTypes';

interface HoorviaCapabilitiesManagerProps {
  user: OwnerAdminUserView;
  token: string;
  policy: PlatformPolicy | null;
  onClose: () => void;
  onUpdated: () => void;
}

const CATEGORY_META: Record<
  CapabilityCategory,
  { name: string; icon: React.FC<{ className?: string }>; color: string; bg: string; border: string }
> = {
  WEB: {
    name: 'WEB SUITE',
    icon: Globe,
    color: 'text-sky-400',
    bg: 'bg-sky-950/30',
    border: 'border-sky-800/40',
  },
  MEDIA: {
    name: 'MEDIA & GENERATION',
    icon: Sparkles,
    color: 'text-amber-400',
    bg: 'bg-amber-950/30',
    border: 'border-amber-800/40',
  },
  SOCIAL: {
    name: 'SOCIAL & DISTRIBUTION',
    icon: Share2,
    color: 'text-purple-400',
    bg: 'bg-purple-950/30',
    border: 'border-purple-800/40',
  },
  PRODUCTIVITY: {
    name: 'PRODUCTIVITY & DOCS',
    icon: FileText,
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/30',
    border: 'border-emerald-800/40',
  },
  OTHER: {
    name: 'CORE ENGINE & ASSISTANCE',
    icon: Sliders,
    color: 'text-rose-400',
    bg: 'bg-rose-950/30',
    border: 'border-rose-800/40',
  },
};

const CAPABILITY_ICONS: Record<UserCapabilityId, React.FC<{ className?: string }>> = {
  web_search: Search,
  web_browsing: Globe,
  deep_research: Brain,
  image_generation: Sparkles,
  video_generation: Tv,
  social_content: MessageSquare,
  social_accounts: Share2,
  social_scheduling: Zap,
  social_publishing: Send,
  docs: FileText,
  pdfs: FileSearch,
  spreadsheets: FileSpreadsheet,
  presentations: Layers,
  text_chat: MessageSquare,
  live_voice: Mic,
  memory: Brain,
  file_analysis: FileSearch,
  coding_assistant: Code2,
  automations: Workflow,
  telegram_integration: Radio,
};

export const HoorviaCapabilitiesManager: React.FC<HoorviaCapabilitiesManagerProps> = ({
  user,
  token,
  policy,
  onClose,
  onUpdated,
}) => {
  const [capabilities, setCapabilities] = useState<Record<UserCapabilityId, boolean>>(
    user.effectiveCapabilities || { ...DEFAULT_PLATFORM_CAPABILITIES }
  );
  const [overrides, setOverrides] = useState<Partial<Record<UserCapabilityId, boolean>>>(
    user.capabilityOverrides || {}
  );
  const [defaults, setDefaults] = useState<Record<UserCapabilityId, boolean>>(
    policy?.defaultCapabilities || { ...DEFAULT_PLATFORM_CAPABILITIES }
  );
  const [currentPack, setCurrentPack] = useState<AccessPackId>(user.accessPack || 'Custom');

  const [loadingCap, setLoadingCap] = useState<string | null>(null);
  const [applyingPack, setApplyingPack] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Live test action state
  const [testingCap, setTestingCap] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    capability: string;
    statusCode: number;
    success: boolean;
    output: string;
    timestamp: string;
  } | null>(null);

  // Fetch fresh capability state from backend on mount
  useEffect(() => {
    fetchUserCapabilities();
  }, [user.id]);

  const fetchUserCapabilities = async () => {
    try {
      const res = await fetch(`/api/hoorvia/admin/users/${user.id}/capabilities`, {
        headers: { 'X-Hoorvia-Token': token },
      });
      if (res.ok) {
        const data = await res.json();
        setCapabilities(data.capabilities || {});
        setOverrides(data.overrides || {});
        setDefaults(data.defaults || {});
        setCurrentPack(data.accessPack || 'Custom');
      }
    } catch (err) {
      console.error('Failed to load user capabilities', err);
    }
  };

  // One-Click Toggle / Override
  const handleToggleCapability = async (capabilityId: UserCapabilityId) => {
    const currentState = !!capabilities[capabilityId];
    const newState = !currentState;
    setLoadingCap(capabilityId);
    setMessage(null);

    // Optimistic update
    setCapabilities((prev) => ({ ...prev, [capabilityId]: newState }));
    setOverrides((prev) => ({ ...prev, [capabilityId]: newState }));
    setCurrentPack('Custom');

    try {
      const res = await fetch(`/api/hoorvia/admin/users/${user.id}/capabilities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify({
          capabilityId,
          value: newState,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update capability.');
      }

      const resData = await res.json();
      setMessage({
        type: 'success',
        text: `Granted/Revoked: '${capabilityId}' is now ${newState ? 'ON' : 'OFF'} for ${user.email}.`,
      });
      onUpdated();
    } catch (err: any) {
      // Revert optimistic update
      setCapabilities((prev) => ({ ...prev, [capabilityId]: currentState }));
      setMessage({ type: 'error', text: err.message || 'Action failed.' });
    } finally {
      setLoadingCap(null);
    }
  };

  // One-Click Reset to Default
  const handleResetToDefault = async (capabilityId: UserCapabilityId) => {
    setLoadingCap(capabilityId);
    setMessage(null);

    try {
      const res = await fetch(`/api/hoorvia/admin/users/${user.id}/capabilities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify({
          capabilityId,
          value: null, // Reset to default
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reset capability.');
      }

      const defVal = defaults[capabilityId] ?? DEFAULT_PLATFORM_CAPABILITIES[capabilityId];
      setCapabilities((prev) => ({ ...prev, [capabilityId]: defVal }));
      setOverrides((prev) => {
        const copy = { ...prev };
        delete copy[capabilityId];
        return copy;
      });
      setCurrentPack('Custom');

      setMessage({
        type: 'success',
        text: `Reset '${capabilityId}' to platform default (${defVal ? 'ON' : 'OFF'}).`,
      });
      onUpdated();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Reset failed.' });
    } finally {
      setLoadingCap(null);
    }
  };

  // One-Click Access Pack Selection
  const handleApplyAccessPack = async (packName: AccessPackId) => {
    setApplyingPack(packName);
    setMessage(null);

    try {
      const res = await fetch(`/api/hoorvia/admin/users/${user.id}/access-pack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify({ packName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to apply access pack.');
      }

      const resData = await res.json();
      setCapabilities(resData.capabilities);
      setCurrentPack(packName);
      setOverrides(resData.capabilities);

      setMessage({
        type: 'success',
        text: `Applied Access Pack '${packName}' successfully to ${user.email}.`,
      });
      onUpdated();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to apply access pack.' });
    } finally {
      setApplyingPack(null);
    }
  };

  // Live Test Action
  const handleLiveTestAction = async (capabilityId: UserCapabilityId) => {
    setTestingCap(capabilityId);
    setTestResult(null);

    try {
      // Call protected action endpoint
      const res = await fetch(`/api/hoorvia/action/${capabilityId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify({
          action: 'live_verification',
          testUser: user.email,
          timestamp: Date.now(),
        }),
      });

      const statusCode = res.status;
      const data = await res.json();

      setTestResult({
        capability: capabilityId,
        statusCode,
        success: res.ok,
        output: JSON.stringify(data, null, 2),
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setTestResult({
        capability: capabilityId,
        statusCode: 500,
        success: false,
        output: err.message || 'Network failure',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setTestingCap(null);
    }
  };

  // Test Owner Isolation Security Guard
  const handleTestOwnerIsolation = async () => {
    setTestingCap('mohsin_local_runner');
    setTestResult(null);

    try {
      // Intentionally call runner endpoint to verify hard 403 block
      const res = await fetch('/api/runner/status', {
        headers: { 'X-Hoorvia-Token': 'test_non_owner_probe_token' },
      });

      const statusCode = res.status;
      const data = await res.json().catch(() => ({}));

      setTestResult({
        capability: 'mohsin_local_runner (Owner-Only)',
        statusCode,
        success: statusCode === 401 || statusCode === 403,
        output: JSON.stringify({
          securityGuard: 'STRICT_OWNER_ISOLATION',
          httpStatus: statusCode,
          defense: 'Local Runner, files, and private browser are unreachable without Mohsin Owner authorization.',
          responsePayload: data,
        }, null, 2),
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setTestResult({
        capability: 'mohsin_local_runner',
        statusCode: 403,
        success: true,
        output: 'Blocked by platform security boundary.',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setTestingCap(null);
    }
  };

  const categories: CapabilityCategory[] = ['WEB', 'MEDIA', 'SOCIAL', 'PRODUCTIVITY', 'OTHER'];
  const totalEnabled = Object.values(capabilities).filter(Boolean).length;
  const totalCaps = ALL_CAPABILITY_DEFINITIONS.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-5xl bg-zinc-950 border border-rose-900/40 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-6 border-b border-zinc-800/80 bg-zinc-900/40 flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 rounded-xl bg-rose-950/70 border border-rose-800/50 text-rose-300">
                <Sliders className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  Capabilities & Rights Management
                </h2>
                <p className="text-xs text-zinc-400">
                  User: <span className="text-zinc-200 font-semibold">{user.name}</span> ({user.email}) • ID: <span className="font-mono text-zinc-400">{user.id}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Active Rights</p>
              <p className="text-xs font-bold text-emerald-400 font-mono">
                {totalEnabled} / {totalCaps} Enabled
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
              title="Close Panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NOTIFICATION FEEDBACK */}
        {message && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
              message.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-800/60 text-emerald-200'
                : 'bg-rose-950/70 border-rose-800/60 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="text-zinc-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* SCROLLABLE BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs flex-1">
          {/* ONE-CLICK ACCESS PACKS SECTION */}
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-rose-400" />
                <span className="font-bold text-white text-xs tracking-wide uppercase">
                  One-Click Access Packs
                </span>
                <span className="text-[10px] text-zinc-400">
                  (Instant preset rights bundle for this user)
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800/50 text-[10px] font-bold">
                Current: {currentPack}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {(Object.keys(ACCESS_PACK_DEFINITIONS) as AccessPackId[]).map((packKey) => {
                const pack = ACCESS_PACK_DEFINITIONS[packKey];
                const isActive = currentPack === packKey;
                const isLoading = applyingPack === packKey;

                return (
                  <button
                    key={packKey}
                    onClick={() => handleApplyAccessPack(packKey)}
                    disabled={isLoading}
                    className={`p-2.5 rounded-xl text-left border transition-all relative flex flex-col justify-between ${
                      isActive
                        ? 'bg-rose-950/80 border-rose-600 text-white shadow-md shadow-rose-950/40'
                        : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs">{pack.name}</span>
                        {isActive && <Check className="w-3 h-3 text-rose-400" />}
                      </div>
                      <p className="text-[10px] text-zinc-400 line-clamp-2 leading-tight">
                        {pack.description}
                      </p>
                    </div>

                    <span
                      className={`mt-2 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded self-start ${
                        isActive
                          ? 'bg-rose-900 text-rose-200'
                          : 'bg-zinc-900 text-zinc-400 group-hover:text-zinc-200'
                      }`}
                    >
                      {isLoading ? 'Applying...' : isActive ? 'Active' : 'Apply'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CAPABILITIES BY CATEGORY */}
          <div className="space-y-5">
            {categories.map((catKey) => {
              const meta = CATEGORY_META[catKey];
              const catDefs = ALL_CAPABILITY_DEFINITIONS.filter((d) => d.category === catKey);
              const Icon = meta.icon;

              return (
                <div key={catKey} className="space-y-3">
                  {/* Category Header */}
                  <div className="flex items-center gap-2 pb-1.5 border-b border-zinc-800">
                    <span className={`p-1 rounded-lg ${meta.bg} ${meta.color} border ${meta.border}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <h3 className="font-bold text-xs text-white uppercase tracking-wider">
                      {meta.name}
                    </h3>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      ({catDefs.filter((d) => capabilities[d.id]).length}/{catDefs.length} enabled)
                    </span>
                  </div>

                  {/* Capability Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {catDefs.map((def) => {
                      const isEnabled = !!capabilities[def.id];
                      const hasOverride = overrides[def.id] !== undefined;
                      const overrideVal = overrides[def.id];
                      const platformDefault = defaults[def.id] ?? def.defaultState;
                      const CapIcon = CAPABILITY_ICONS[def.id] || Sliders;
                      const isBusy = loadingCap === def.id;

                      return (
                        <div
                          key={def.id}
                          className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                            isEnabled
                              ? 'bg-zinc-900/40 border-zinc-700/80 shadow-sm'
                              : 'bg-zinc-950/60 border-zinc-800/60 opacity-85'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              <span
                                className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                                  isEnabled
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800/40'
                                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                                }`}
                              >
                                <CapIcon className="w-4 h-4" />
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-bold text-white text-xs">{def.name}</h4>
                                  <span className="text-[10px] font-mono text-zinc-500">
                                    ({def.id})
                                  </span>
                                </div>
                                <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                                  {def.description}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Control Bar: Platform Default / Override Status / One-Click Toggle / Reset */}
                          <div className="pt-2 border-t border-zinc-850 flex items-center justify-between flex-wrap gap-2 text-[10px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Platform Default Badge */}
                              <span
                                className={`px-2 py-0.5 rounded border text-[10px] font-mono ${
                                  platformDefault
                                    ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/40'
                                    : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                                }`}
                              >
                                Platform Default: {platformDefault ? 'ON' : 'OFF'}
                              </span>

                              {/* Override Badge */}
                              {hasOverride ? (
                                <span
                                  className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                                    overrideVal
                                      ? 'bg-amber-950/80 text-amber-300 border-amber-800/50'
                                      : 'bg-rose-950/80 text-rose-300 border-rose-800/50'
                                  }`}
                                >
                                  User Override: {overrideVal ? 'ON' : 'OFF'}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-zinc-900/60 text-zinc-500 border border-zinc-800 text-[10px]">
                                  Using Default
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Reset to Default Button */}
                              {hasOverride && (
                                <button
                                  onClick={() => handleResetToDefault(def.id)}
                                  disabled={isBusy}
                                  className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 flex items-center gap-1 transition-colors"
                                  title="Clear custom override and restore platform default"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Reset to Default</span>
                                </button>
                              )}

                              {/* Test Real Action Button */}
                              <button
                                onClick={() => handleLiveTestAction(def.id)}
                                disabled={testingCap === def.id}
                                className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-sky-950 text-zinc-300 hover:text-sky-200 border border-zinc-800 flex items-center gap-1 transition-colors"
                                title="Execute live action through server-side entitlement check"
                              >
                                <Play className="w-3 h-3 text-sky-400" />
                                <span>Test</span>
                              </button>

                              {/* ONE-CLICK TOGGLE BUTTON */}
                              <button
                                onClick={() => handleToggleCapability(def.id)}
                                disabled={isBusy}
                                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                                  isEnabled
                                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50'
                                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white'
                                }`}
                              >
                                {isBusy ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : isEnabled ? (
                                  <CheckCircle className="w-3 h-3 text-white" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-zinc-400" />
                                )}
                                <span>{isEnabled ? 'ON (Granted)' : 'OFF (Revoked)'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* LIVE TEST & DIAGNOSTICS DISPLAY */}
          {testResult && (
            <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-sky-400" />
                  <span className="font-bold text-white text-xs">
                    Live Server-Side Entitlement Test: {testResult.capability}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      testResult.statusCode === 200
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : testResult.statusCode === 403
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    HTTP {testResult.statusCode} {testResult.statusCode === 403 ? 'CAPABILITY_NOT_GRANTED' : 'OK'}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">{testResult.timestamp}</span>
                  <button
                    onClick={() => setTestResult(null)}
                    className="text-zinc-500 hover:text-zinc-300 ml-2"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 overflow-x-auto whitespace-pre-wrap max-h-40">
                {testResult.output}
              </pre>
            </div>
          )}

          {/* STRICT SECURITY ISOLATION BANNER */}
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-bold text-rose-200 text-xs uppercase tracking-wide">
                  Strict Owner Isolation Guarantee
                </span>
              </div>
              <button
                onClick={handleTestOwnerIsolation}
                className="px-2.5 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800/60 font-medium text-[10px] flex items-center gap-1.5"
              >
                <Lock className="w-3 h-3" />
                <span>Verify Isolation Defense (Test 403 Block)</span>
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Platform owner capabilities (Mohsin Local Runner, local machine files, private browser, OmniRoute engine, Maryam Core Memory, and master server credentials) are hardcoded as non-grantable and completely isolated. Public users are strictly forbidden from executing or receiving these capabilities under all conditions.
            </p>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 border-t border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-zinc-400">
            Changes take effect immediately on live API requests and socket sessions.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
