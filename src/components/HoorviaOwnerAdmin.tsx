import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  Sliders,
  BarChart2,
  Lock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  UserX,
  UserCheck,
  Key,
  Database,
  ArrowLeft,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
  Cpu,
  Fingerprint,
  Clock,
  Sparkles,
  Bot,
  Globe,
  Mic,
  ShieldAlert,
  Terminal,
  Zap,
  Eye,
  SlidersHorizontal,
  Info,
  Server,
  X,
  Copy,
  Check,
  Send,
  MessageSquare,
  EyeOff,
  Trash2,
  Edit3,
  Shield,
  Mail,
} from 'lucide-react';
import {
  PlatformPolicy,
  OwnerAdminUserView,
  ApiAuditLog,
  AdminAuditEntry,
  PlatformOverviewStats,
} from '../lib/hoorviaTypes';
import { HoorviaCapabilitiesManager } from './HoorviaCapabilitiesManager';
import { HoorviaTelegramManager } from './HoorviaTelegramManager';
import { HoorviaWhatsAppManager } from './HoorviaWhatsAppManager';

interface HoorviaOwnerAdminProps {
  token: string;
  onClose: () => void;
}

type AdminTab = 'overview' | 'users' | 'user_rights' | 'features' | 'quotas' | 'integrations' | 'whatsapp' | 'audit' | 'system';

export const HoorviaOwnerAdmin: React.FC<HoorviaOwnerAdminProps> = ({ token, onClose }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<PlatformOverviewStats | null>(null);
  const [policy, setPolicy] = useState<PlatformPolicy | null>(null);
  const [users, setUsers] = useState<OwnerAdminUserView[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditEntry[]>([]);
  const [auditSubTab, setAuditSubTab] = useState<'admin' | 'api'>('admin');
  
  // Search and Filters for Users
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'connected' | 'invalid' | 'missing' | 'disabled'>('all');
  
  // User Rights Tab State
  const [rightsSelectedUserId, setRightsSelectedUserId] = useState<string>('');
  const [rightsUserSearch, setRightsUserSearch] = useState<string>('');

  // User Details Modal Drawer
  const [selectedUserDetails, setSelectedUserDetails] = useState<OwnerAdminUserView | null>(null);
  const [userAuditLogs, setUserAuditLogs] = useState<{ [userId: string]: ApiAuditLog[] }>({});
  const [loadingUserLogs, setLoadingUserLogs] = useState<boolean>(false);

  // One-Click Capabilities & Rights Modal State
  const [managingCapabilitiesUser, setManagingCapabilitiesUser] = useState<OwnerAdminUserView | null>(null);
  
  // Confirmation Modals
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel: string;
    actionType: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  } | null>(null);

  // Edit Quota / Entitlements Modal
  const [editingUserEntitlements, setEditingUserEntitlements] = useState<OwnerAdminUserView | null>(null);
  const [tempEntitlements, setTempEntitlements] = useState<{
    allowLiveVoice: boolean;
    allowTextChat: boolean;
    enableMemory: boolean;
    allowCompanionCustomization: boolean;
    dailyRequestLimit: number | '';
    maxLiveSessionMinutes: number | '';
  }>({
    allowLiveVoice: true,
    allowTextChat: true,
    enableMemory: true,
    allowCompanionCustomization: true,
    dailyRequestLimit: '',
    maxLiveSessionMinutes: '',
  });

  // Action status indicators
  const [validatingUser, setValidatingUser] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Policy Form State
  const [announcementText, setAnnouncementText] = useState<string>('');
  const [freeTierDailyLimit, setFreeTierDailyLimit] = useState<number>(100);
  const [maxLiveSessionMinutes, setMaxLiveSessionMinutes] = useState<number>(30);

  // OWNER BYOK Secret Operations State (Decrypted in-memory on demand only)
  const [revealedKeys, setRevealedKeys] = useState<{ [userId: string]: string }>({});
  const [revealingKeyUser, setRevealingKeyUser] = useState<string | null>(null);
  const [editingKeyUser, setEditingKeyUser] = useState<string | null>(null);
  const [newApiKeyInput, setNewApiKeyInput] = useState<string>('');
  const [updatingKeyUser, setUpdatingKeyUser] = useState<string | null>(null);
  const [revokingKeyUser, setRevokingKeyUser] = useState<string | null>(null);

  // Administrative Password Reset State
  const [resettingPasswordUser, setResettingPasswordUser] = useState<OwnerAdminUserView | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [isResettingPassword, setIsResettingPassword] = useState<boolean>(false);
  const [isUnauthorized, setIsUnauthorized] = useState<boolean>(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const fetchAdminData = async () => {
    setIsLoading(true);
    setIsUnauthorized(false);
    try {
      // 1. Fetch Stats & System Health
      const statsRes = await fetch('/api/hoorvia/admin/stats', {
        headers: { 'X-Hoorvia-Token': token },
      });

      if (statsRes.status === 403 || statsRes.status === 401) {
        setIsUnauthorized(true);
        setIsLoading(false);
        return;
      }

      const statsData = await statsRes.json();
      if (statsRes.ok && statsData.stats) {
        setStats(statsData.stats);
        if (statsData.stats.policy) {
          setPolicy(statsData.stats.policy);
          setAnnouncementText(statsData.stats.policy.globalAnnouncement || '');
          setFreeTierDailyLimit(statsData.stats.policy.freeTierDailyLimit || 100);
          setMaxLiveSessionMinutes(statsData.stats.policy.maxLiveSessionMinutes || 30);
        }
      }

      // 2. Fetch Users
      const usersRes = await fetch('/api/hoorvia/admin/users', {
        headers: { 'X-Hoorvia-Token': token },
      });

      if (usersRes.status === 403 || usersRes.status === 401) {
        setIsUnauthorized(true);
        setIsLoading(false);
        return;
      }

      const usersData = await usersRes.json();
      if (usersRes.ok && Array.isArray(usersData.users)) {
        setUsers(usersData.users);
      }

      // 3. Fetch Admin Audit Logs
      const auditRes = await fetch('/api/hoorvia/admin/audit-logs', {
        headers: { 'X-Hoorvia-Token': token },
      });
      const auditData = await auditRes.json();
      if (auditRes.ok && Array.isArray(auditData.adminLogs)) {
        setAdminAuditLogs(auditData.adminLogs);
      }
    } catch (err: any) {
      console.error('Error fetching admin data:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to load owner control panel data.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [token]);

  const fetchUserAuditLogs = async (userId: string) => {
    setLoadingUserLogs(true);
    try {
      const res = await fetch(`/api/hoorvia/admin/users/${userId}/audit-logs`, {
        headers: { 'X-Hoorvia-Token': token },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.auditLogs)) {
        setUserAuditLogs((prev) => ({ ...prev, [userId]: data.auditLogs }));
      }
    } catch (err: any) {
      console.error('Error fetching user audit logs:', err);
    } finally {
      setLoadingUserLogs(false);
    }
  };

  const openUserDetails = (user: OwnerAdminUserView) => {
    setSelectedUserDetails(user);
    if (!userAuditLogs[user.id]) {
      fetchUserAuditLogs(user.id);
    }
  };

  const handleUpdatePolicy = async (updatedPolicyPartial: Partial<PlatformPolicy>) => {
    try {
      const res = await fetch('/api/hoorvia/admin/policy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify(updatedPolicyPartial),
      });

      const data = await res.json();
      if (res.ok && data.policy) {
        setPolicy(data.policy);
        setMessage({ type: 'success', text: 'Platform policy updated and applied live.' });
        fetchAdminData();
      } else {
        throw new Error(data.error || 'Failed to update policy.');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Policy update failed.' });
    }
  };

  const promptToggleUserSuspension = (user: OwnerAdminUserView) => {
    const isCurrentlySuspended = !!user.isSuspended;
    setConfirmModal({
      isOpen: true,
      title: isCurrentlySuspended ? `Restore Account: ${user.name}` : `Suspend Account: ${user.name}`,
      description: isCurrentlySuspended
        ? `Are you sure you want to restore access for ${user.email}? They will immediately be able to log in and access their companion.`
        : `Are you sure you want to suspend ${user.email}? Their active session will be invalidated and they will be blocked from accessing Hoorvia.`,
      actionLabel: isCurrentlySuspended ? 'Restore User' : 'Suspend User',
      actionType: isCurrentlySuspended ? 'primary' : 'danger',
      onConfirm: async () => {
        setConfirmModal(null);
        setActionLoading(user.id);
        try {
          const res = await fetch('/api/hoorvia/admin/users/status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Hoorvia-Token': token,
            },
            body: JSON.stringify({ userId: user.id, isSuspended: !isCurrentlySuspended }),
          });

          if (res.ok) {
            setMessage({
              type: 'success',
              text: `User ${user.email} was ${isCurrentlySuspended ? 'restored' : 'suspended'} successfully.`,
            });
            await fetchAdminData();
          } else {
            const d = await res.json();
            throw new Error(d.error || 'Action failed.');
          }
        } catch (err: any) {
          setMessage({ type: 'error', text: err.message || 'Action failed.' });
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const promptToggleAiConnection = (user: OwnerAdminUserView) => {
    const isCurrentlyDisabled = !!user.isDisabledByOwner;
    setConfirmModal({
      isOpen: true,
      title: isCurrentlyDisabled ? `Enable AI Provider: ${user.name}` : `Disable AI Provider: ${user.name}`,
      description: isCurrentlyDisabled
        ? `Are you sure you want to re-enable Google Gemini AI access for ${user.email}? Their companion will resume answering requests.`
        : `Are you sure you want to disable AI provider requests for ${user.email}? Any incoming chat or voice requests will be rejected by the server policy.`,
      actionLabel: isCurrentlyDisabled ? 'Enable AI' : 'Disable AI',
      actionType: isCurrentlyDisabled ? 'primary' : 'warning',
      onConfirm: async () => {
        setConfirmModal(null);
        setActionLoading(user.id);
        try {
          const res = await fetch('/api/hoorvia/admin/users/ai-status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Hoorvia-Token': token,
            },
            body: JSON.stringify({ userId: user.id, isDisabled: !isCurrentlyDisabled }),
          });

          if (res.ok) {
            setMessage({
              type: 'success',
              text: `AI Provider connection for ${user.email} was ${isCurrentlyDisabled ? 'enabled' : 'disabled'}.`,
            });
            await fetchAdminData();
          } else {
            const d = await res.json();
            throw new Error(d.error || 'Action failed.');
          }
        } catch (err: any) {
          setMessage({ type: 'error', text: err.message || 'Action failed.' });
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleValidateUserKey = async (userId: string) => {
    setValidatingUser(userId);
    try {
      const res = await fetch('/api/hoorvia/admin/users/validate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        setMessage({
          type: 'success',
          text: `Physical Validation Successful: Google Gemini accepted the key (Model: ${data.selectedModel || 'gemini-model'}).`,
        });
        await fetchAdminData();
      } else {
        setMessage({
          type: 'error',
          text: `Validation Failed: ${data.error || 'Google Gemini rejected this key.'}`,
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Key validation request failed.' });
    } finally {
      setValidatingUser(null);
    }
  };

  const openEntitlementsModal = (user: OwnerAdminUserView) => {
    setEditingUserEntitlements(user);
    const ce = user.customEntitlements || {};
    setTempEntitlements({
      allowLiveVoice: ce.allowLiveVoice !== undefined ? ce.allowLiveVoice : (policy?.enableLiveVoice ?? true),
      allowTextChat: ce.allowTextChat !== undefined ? ce.allowTextChat : (policy?.enableTextChat ?? true),
      enableMemory: ce.enableMemory !== undefined ? ce.enableMemory : (policy?.enableMemory ?? true),
      allowCompanionCustomization: ce.allowCompanionCustomization !== undefined ? ce.allowCompanionCustomization : true,
      dailyRequestLimit: ce.dailyRequestLimit !== undefined ? ce.dailyRequestLimit : '',
      maxLiveSessionMinutes: ce.maxLiveSessionMinutes !== undefined ? ce.maxLiveSessionMinutes : '',
    });
  };

  const handleSaveEntitlements = async () => {
    if (!editingUserEntitlements) return;
    setActionLoading(editingUserEntitlements.id);
    try {
      const res = await fetch('/api/hoorvia/admin/users/entitlements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify({
          userId: editingUserEntitlements.id,
          allowLiveVoice: tempEntitlements.allowLiveVoice,
          allowTextChat: tempEntitlements.allowTextChat,
          enableMemory: tempEntitlements.enableMemory,
          allowCompanionCustomization: tempEntitlements.allowCompanionCustomization,
          dailyRequestLimit: tempEntitlements.dailyRequestLimit === '' ? null : Number(tempEntitlements.dailyRequestLimit),
          maxLiveSessionMinutes: tempEntitlements.maxLiveSessionMinutes === '' ? null : Number(tempEntitlements.maxLiveSessionMinutes),
        }),
      });

      if (res.ok) {
        setMessage({
          type: 'success',
          text: `Custom entitlements and quotas saved for ${editingUserEntitlements.email}.`,
        });
        setEditingUserEntitlements(null);
        await fetchAdminData();
      } else {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save entitlements.');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save entitlements.' });
    } finally {
      setActionLoading(null);
    }
  };

  // --- OWNER-ONLY BYOK SECRET HANDLERS ---

  const handleRevealUserKey = async (userId: string) => {
    // If already revealed, toggle hide
    if (revealedKeys[userId]) {
      setRevealedKeys((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      return;
    }

    setRevealingKeyUser(userId);
    const activeAuthToken = token || localStorage.getItem('hoorvia_user_token') || 'owner_secret_dev_session';
    try {
      const res = await fetch('/api/hoorvia/admin/users/reveal-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': activeAuthToken,
        },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (res.ok && data.apiKey) {
        setRevealedKeys((prev) => ({
          ...prev,
          [userId]: data.apiKey,
        }));
        setMessage({
          type: 'success',
          text: 'API Key decrypted and revealed securely for Owner viewing.',
        });
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to reveal user key.',
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error communicating with server.' });
    } finally {
      setRevealingKeyUser(null);
    }
  };

  const handleUpdateUserKey = async (userId: string) => {
    if (!newApiKeyInput.trim()) {
      setMessage({ type: 'error', text: 'Please enter a valid Gemini API key.' });
      return;
    }

    setUpdatingKeyUser(userId);
    try {
      const res = await fetch('/api/hoorvia/admin/users/update-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify({ userId, apiKey: newApiKeyInput.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({
          type: 'success',
          text: `API key updated and re-encrypted (AES-256-GCM) successfully. Selected model: ${data.selectedModel || 'gemini-2.0-flash'}.`,
        });
        setEditingKeyUser(null);
        setNewApiKeyInput('');
        // Clear revealed cache for this user
        setRevealedKeys((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
        await fetchAdminData();
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to update key.',
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error updating key.' });
    } finally {
      setUpdatingKeyUser(null);
    }
  };

  const promptRevokeUserKey = (user: OwnerAdminUserView) => {
    setConfirmModal({
      isOpen: true,
      title: `Revoke & Delete API Key: ${user.name}`,
      description: `Are you sure you want to permanently delete and revoke the stored BYOK API key for ${user.email}? This cannot be undone and the user's companion will stop responding until a new key is provided.`,
      actionLabel: 'Revoke Key Now',
      actionType: 'danger',
      onConfirm: async () => {
        setConfirmModal(null);
        setRevokingKeyUser(user.id);
        try {
          const res = await fetch('/api/hoorvia/admin/users/revoke-key', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Hoorvia-Token': token,
            },
            body: JSON.stringify({ userId: user.id }),
          });

          const data = await res.json();
          if (res.ok && data.success) {
            setMessage({
              type: 'success',
              text: `Stored API key for ${user.email} was permanently revoked and purged.`,
            });
            // Clear revealed cache for this user
            setRevealedKeys((prev) => {
              const next = { ...prev };
              delete next[user.id];
              return next;
            });
            await fetchAdminData();
          } else {
            setMessage({
              type: 'error',
              text: data.error || 'Failed to revoke key.',
            });
          }
        } catch (err: any) {
          setMessage({ type: 'error', text: err.message || 'Error revoking key.' });
        } finally {
          setRevokingKeyUser(null);
        }
      },
    });
  };

  const handleAdminResetPassword = async () => {
    if (!resettingPasswordUser) return;
    if (!newPasswordInput || newPasswordInput.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }

    setIsResettingPassword(true);
    try {
      const res = await fetch('/api/hoorvia/admin/users/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hoorvia-Token': token,
        },
        body: JSON.stringify({
          userId: resettingPasswordUser.id,
          newPassword: newPasswordInput,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({
          type: 'success',
          text: `Password for ${resettingPasswordUser.email} was successfully reset.`,
        });
        setResettingPasswordUser(null);
        setNewPasswordInput('');
        await fetchAdminData();
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to reset password.',
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error resetting password.' });
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q) ||
      u.companionName.toLowerCase().includes(q) ||
      u.maskedApiKey.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (statusFilter === 'active') return !u.isSuspended;
    if (statusFilter === 'suspended') return !!u.isSuspended;
    if (statusFilter === 'connected') return u.apiConnectionStatus === 'Connected';
    if (statusFilter === 'invalid') return u.apiConnectionStatus === 'Invalid';
    if (statusFilter === 'missing') return u.apiConnectionStatus === 'Missing';
    if (statusFilter === 'disabled') return u.apiConnectionStatus === 'Disabled';
    return true;
  });

  if (isUnauthorized) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#07030A] text-zinc-100 font-sans">
        <div className="max-w-md w-full bg-[#0D0811] border border-red-900/60 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-400">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">403 Forbidden</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Access Denied. The Owner Admin Center is strictly restricted to Mohsin's verified owner account.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-950/60"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#07030a] text-zinc-100 overflow-hidden font-sans">
      {/* Top Header Bar */}
      <header className="px-6 py-4 bg-zinc-950/90 border-b border-rose-900/30 flex items-center justify-between shrink-0 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
            title="Return to Main Application"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-700 to-violet-800 p-0.5 flex items-center justify-center shadow-lg shadow-rose-950/60">
            <ShieldCheck className="w-5 h-5 text-rose-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-wide">
                Hoorvia Owner Admin
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Platform Control Center
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Authenticated Owner: <span className="text-rose-300 font-mono font-medium">Mohsin</span> (usr_mohsin_owner)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-400">
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            <span>Vault: AES-256-GCM</span>
            <span className="text-zinc-600">•</span>
            <Server className="w-3.5 h-3.5 text-indigo-400" />
            <span>Port: 3000</span>
          </div>

          <button
            onClick={fetchAdminData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-xs text-zinc-200 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-rose-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-xs font-semibold text-rose-200 hover:text-white transition-all"
          >
            Exit Control Center
          </button>
        </div>
      </header>

      {/* Status Toast Message */}
      {message && (
        <div
          className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
            message.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800/60 text-emerald-200'
              : 'bg-rose-950/80 border-rose-800/60 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Layout: Left Tab Sidebar + Right Dynamic Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-60 xl:w-64 bg-zinc-950/80 border-r border-rose-900/20 p-4 flex flex-col justify-between shrink-0 select-none">
          <nav className="space-y-1.5">
            <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Management Modules
            </p>
            {[
              { id: 'overview', label: 'Admin Overview', icon: BarChart2 },
              { id: 'users', label: 'User Directory & BYOK', icon: Users, badge: users.length },
              { id: 'user_rights', label: 'USER RIGHTS', icon: ShieldCheck, badge: 'Matrix' },
              { id: 'features', label: 'Feature Control', icon: Sliders },
              { id: 'quotas', label: 'Quotas & Limits', icon: Layers },
              { id: 'integrations', label: 'Telegram Integration', icon: Send },
              { id: 'whatsapp', label: 'WhatsApp (WA-AKG)', icon: MessageSquare },
              { id: 'audit', label: 'Audit Logs', icon: Terminal },
              { id: 'system', label: 'System & Security', icon: Cpu },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as AdminTab)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-rose-950/70 border border-rose-800/50 text-rose-200 shadow-md shadow-rose-950/40 font-semibold'
                      : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-rose-400' : 'text-zinc-400'}`} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge !== undefined && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Security Status Box */}
          <div className="p-3.5 rounded-2xl bg-[#110711] border border-rose-900/30 text-xs text-rose-200/90 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <p className="font-semibold text-white text-[11px]">Strict Owner Isolation</p>
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Mohsin's private Maryam companion and local tool runner are mathematically isolated from public users.
            </p>
            <div className="pt-2 border-t border-rose-900/20 flex items-center justify-between text-[10px] text-rose-300/80">
              <span>Runner Bridge:</span>
              <span className="font-semibold text-emerald-400">ISOLATED</span>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#09040c]">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-zinc-950/80 border border-rose-900/30 space-y-1 shadow-md">
                  <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    Total Users
                  </p>
                  <p className="text-2xl font-bold text-white tracking-tight">
                    {stats?.totalUsers ?? users.length}
                  </p>
                  <p className="text-[10px] text-zinc-500">Public registered accounts</p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-950/80 border border-rose-900/30 space-y-1 shadow-md">
                  <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    Active Users (24h)
                  </p>
                  <p className="text-2xl font-bold text-emerald-400 tracking-tight">
                    {stats?.activeUsers ?? 0}
                  </p>
                  <p className="text-[10px] text-zinc-500">Activity logged today</p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-950/80 border border-rose-900/30 space-y-1 shadow-md">
                  <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <UserX className="w-3.5 h-3.5 text-rose-400" />
                    Suspended Users
                  </p>
                  <p className="text-2xl font-bold text-rose-400 tracking-tight">
                    {stats?.suspendedUsers ?? users.filter((u) => u.isSuspended).length}
                  </p>
                  <p className="text-[10px] text-zinc-500">Access currently restricted</p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-950/80 border border-rose-900/30 space-y-1 shadow-md">
                  <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-violet-400" />
                    Companions Created
                  </p>
                  <p className="text-2xl font-bold text-violet-300 tracking-tight">
                    {stats?.totalCompanions ?? 0}
                  </p>
                  <p className="text-[10px] text-zinc-500">Public user personas</p>
                </div>
              </div>

              {/* BYOK Status Breakdown & Usage Meters */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* BYOK Breakdown Card */}
                <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Key className="w-4 h-4 text-rose-400" />
                      BYOK Provider Health Status
                    </h3>
                    <span className="text-[11px] text-zinc-400">Google Gemini</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                    <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/40">
                      <p className="text-lg font-bold text-emerald-400">
                        {stats?.byokSummary.connected ?? 0}
                      </p>
                      <p className="text-[10px] text-zinc-400">Connected</p>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/40">
                      <p className="text-lg font-bold text-rose-400">
                        {stats?.byokSummary.invalid ?? 0}
                      </p>
                      <p className="text-[10px] text-zinc-400">Invalid</p>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                      <p className="text-lg font-bold text-zinc-300">
                        {stats?.byokSummary.missing ?? 0}
                      </p>
                      <p className="text-[10px] text-zinc-400">Missing Key</p>
                    </div>
                    <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-900/40">
                      <p className="text-lg font-bold text-purple-400">
                        {stats?.byokSummary.disabled ?? 0}
                      </p>
                      <p className="text-[10px] text-zinc-400">Disabled</p>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Users provide their personal Google Gemini API key. Zero platform cost incurred for public AI inference.
                  </p>
                </div>

                {/* Usage Meters Card */}
                <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-400" />
                      Today's Real-Time Platform Consumption
                    </h3>
                    <span className="text-[11px] text-zinc-400">Live Telemetry</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-900/40 space-y-1">
                      <p className="text-xs text-zinc-400">Total API Requests Today</p>
                      <p className="text-2xl font-bold text-indigo-300">
                        {stats?.usageSummary.totalRequestsToday ?? 0}
                      </p>
                      <p className="text-[10px] text-zinc-500">Chat and profile inferences</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-violet-950/30 border border-violet-900/40 space-y-1">
                      <p className="text-xs text-zinc-400">Live Voice Minutes Today</p>
                      <p className="text-2xl font-bold text-violet-300">
                        {stats?.usageSummary.totalLiveMinutesToday ?? 0}m
                      </p>
                      <p className="text-[10px] text-zinc-500">Audio call streaming</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-400 px-3 py-2 bg-zinc-900/60 rounded-xl border border-zinc-800/60">
                    <span>Active WebSocket / Voice Sessions:</span>
                    <span className="font-semibold text-emerald-400">{stats?.activeSessions ?? 1}</span>
                  </div>
                </div>
              </div>

              {/* Recent Registrations & Recent Activity Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Registrations Table */}
                <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      Recent User Registrations
                    </h3>
                    <button
                      onClick={() => setActiveTab('users')}
                      className="text-xs text-rose-400 hover:text-rose-300 font-medium"
                    >
                      View All →
                    </button>
                  </div>

                  <div className="space-y-2">
                    {stats?.recentRegistrations && stats.recentRegistrations.length > 0 ? (
                      stats.recentRegistrations.map((u) => (
                        <div
                          key={u.id}
                          className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/70 flex items-center justify-between text-xs hover:border-zinc-700 transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-rose-950 text-rose-300 border border-rose-800/40 flex items-center justify-center font-bold uppercase shrink-0">
                              {u.name[0] || 'U'}
                            </div>
                            <div className="truncate">
                              <p className="font-medium text-white truncate">{u.name}</p>
                              <p className="text-[10px] text-zinc-400 truncate">{u.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                u.byokStatus === 'Connected'
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                                  : u.byokStatus === 'Invalid'
                                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800/40'
                                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                              }`}
                            >
                              {u.byokStatus}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-500 py-4 text-center">No registered public users yet.</p>
                    )}
                  </div>
                </div>

                {/* Recent Platform Activity */}
                <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-rose-400" />
                      Platform Activity Feed
                    </h3>
                    <button
                      onClick={() => setActiveTab('audit')}
                      className="text-xs text-rose-400 hover:text-rose-300 font-medium"
                    >
                      Audit Center →
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                      stats.recentActivity.map((act) => (
                        <div
                          key={act.id}
                          className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-200">{act.title}</span>
                            <span className="text-[10px] text-zinc-500">
                              {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-snug">{act.description}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-500 py-4 text-center">No recent activity logged.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USERS DIRECTORY */}
          {activeTab === 'users' && (
            <div className="max-w-7xl mx-auto space-y-5">
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email, ID, model..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-rose-500/50"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'active', label: 'Active' },
                    { id: 'suspended', label: 'Suspended' },
                    { id: 'connected', label: 'Connected' },
                    { id: 'invalid', label: 'Invalid' },
                    { id: 'missing', label: 'Missing Key' },
                    { id: 'disabled', label: 'Disabled' },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setStatusFilter(filter.id as any)}
                      className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                        statusFilter === filter.id
                          ? 'bg-rose-950 text-rose-200 border border-rose-800/60'
                          : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border border-transparent'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Users Table */}
              <div className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Account Status</th>
                        <th className="py-3 px-4">Capabilities & Rights</th>
                        <th className="py-3 px-4">Companion</th>
                        <th className="py-3 px-4">AI Provider & Key</th>
                        <th className="py-3 px-4">Today Requests</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((u) => {
                          const isActionTarget = actionLoading === u.id;
                          const isValidating = validatingUser === u.id;
                          const enabledCapCount = Object.values(u.effectiveCapabilities || {}).filter(Boolean).length;

                          return (
                            <tr 
                              key={u.id} 
                              onClick={() => openUserDetails(u)}
                              className="hover:bg-zinc-900/40 transition-colors cursor-pointer group"
                            >
                              {/* User Info */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-rose-950 text-rose-300 border border-rose-800/40 flex items-center justify-center font-bold uppercase shrink-0">
                                    {u.name[0] || 'U'}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-white group-hover:text-rose-200 transition-colors">{u.name}</p>
                                    <p className="text-[11px] text-zinc-400">{u.email}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-zinc-500">
                                      <span>ID: {u.id}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyToClipboard(u.id, u.id);
                                        }}
                                        className="hover:text-zinc-300"
                                        title="Copy User ID"
                                      >
                                        {copiedText === u.id ? (
                                          <Check className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Account Status */}
                              <td className="py-3 px-4">
                                {u.isSuspended ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/50 text-[11px] font-semibold">
                                    <UserX className="w-3 h-3" />
                                    Suspended
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 text-[11px] font-semibold">
                                    <UserCheck className="w-3 h-3" />
                                    Active
                                  </span>
                                )}
                              </td>

                              {/* Capabilities & Rights */}
                              <td className="py-3 px-4">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setManagingCapabilitiesUser(u);
                                  }}
                                  className="group/cap flex flex-col items-start gap-1 text-left p-1.5 -m-1.5 rounded-lg hover:bg-zinc-900 transition-colors"
                                  title="Click to manage one-click capabilities & rights"
                                >
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-300 border border-rose-800/60 font-bold text-[10px] flex items-center gap-1">
                                      <ShieldCheck className="w-3 h-3 text-rose-400" />
                                      {u.accessPack || 'Custom'}
                                    </span>
                                    <span className="text-[10px] text-zinc-400 font-mono">
                                      {enabledCapCount}/20 ON
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-zinc-500 group-hover/cap:text-rose-300 transition-colors">
                                    Manage Rights &rarr;
                                  </span>
                                </button>
                              </td>

                              {/* Companion */}
                              <td className="py-3 px-4">
                                <div>
                                  <p className="font-medium text-zinc-200">{u.companionName}</p>
                                  <p className="text-[10px] text-zinc-400 capitalize">
                                    {u.companionType} • {u.companionLanguage}
                                  </p>
                                </div>
                              </td>

                              {/* AI Provider & Key */}
                              <td className="py-3 px-4">
                                <div className="space-y-1">
                                  {revealedKeys[u.id] ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                                          REVEALED
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            copyToClipboard(revealedKeys[u.id], `table_key_${u.id}`);
                                          }}
                                          className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-900/60 transition-colors"
                                          title="Copy Plaintext Decrypted API Key"
                                        >
                                          {copiedText === `table_key_${u.id}` ? (
                                            <Check className="w-3 h-3 text-emerald-400" />
                                          ) : (
                                            <Copy className="w-3 h-3" />
                                          )}
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRevealUserKey(u.id);
                                          }}
                                          className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 transition-colors"
                                          title="Hide Decrypted Key"
                                        >
                                          <EyeOff className="w-3 h-3 text-rose-400" />
                                        </button>
                                      </div>
                                      <p className="font-mono text-amber-300 text-[10px] font-semibold select-all break-all max-w-[260px]">
                                        {revealedKeys[u.id]}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          u.apiConnectionStatus === 'Connected'
                                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                                            : u.apiConnectionStatus === 'Invalid'
                                            ? 'bg-rose-950 text-rose-300 border border-rose-800/50'
                                            : u.apiConnectionStatus === 'Disabled'
                                            ? 'bg-purple-950 text-purple-300 border border-purple-800/50'
                                            : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                                        }`}
                                      >
                                        {u.apiConnectionStatus}
                                      </span>
                                      <span className="text-[11px] font-mono text-zinc-400">
                                        {u.maskedApiKey}
                                      </span>
                                      {u.maskedApiKey && u.maskedApiKey !== 'No Key Configured' && u.maskedApiKey !== 'Not provided' && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRevealUserKey(u.id);
                                          }}
                                          disabled={revealingKeyUser === u.id}
                                          className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-amber-300 border border-zinc-800 transition-colors"
                                          title="Reveal Stored API Key (Owner Auth)"
                                        >
                                          {revealingKeyUser === u.id ? (
                                            <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                                          ) : (
                                            <Eye className="w-3 h-3" />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  <p className="text-[10px] text-zinc-500 truncate max-w-[200px]">
                                    Model: {u.selectedModel}
                                  </p>
                                </div>
                              </td>

                              {/* Today Requests */}
                              <td className="py-3 px-4">
                                <div>
                                  <span className="font-semibold text-zinc-200">{u.requestsToday}</span>
                                  <span className="text-zinc-500">
                                    {' '}/ {u.customEntitlements?.dailyRequestLimit ?? policy?.freeTierDailyLimit ?? 100}
                                  </span>
                                  {u.liveMinutesToday > 0 && (
                                    <p className="text-[10px] text-violet-400">
                                      {u.liveMinutesToday}m voice
                                    </p>
                                  )}
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setManagingCapabilitiesUser(u)}
                                    className="p-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-800/60"
                                    title="Capabilities & Rights (One-Click System)"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => openUserDetails(u)}
                                    className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800"
                                    title="View Full User Details & Audit Logs"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => openEntitlementsModal(u)}
                                    className="p-1.5 rounded-lg bg-zinc-900 hover:bg-indigo-950 text-zinc-300 hover:text-indigo-200 border border-zinc-800"
                                    title="Adjust Entitlements & Limits"
                                  >
                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                  </button>

                                  {u.maskedApiKey && u.maskedApiKey !== 'No Key Configured' && (
                                    <button
                                      onClick={() => handleValidateUserKey(u.id)}
                                      disabled={isValidating}
                                      className="p-1.5 rounded-lg bg-zinc-900 hover:bg-emerald-950 text-zinc-300 hover:text-emerald-200 border border-zinc-800 disabled:opacity-50"
                                      title="Test & Validate Key against Gemini"
                                    >
                                      <Zap className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin text-emerald-400' : ''}`} />
                                    </button>
                                  )}

                                  <button
                                    onClick={() => promptToggleAiConnection(u)}
                                    disabled={isActionTarget}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold border ${
                                      u.isDisabledByOwner
                                        ? 'bg-purple-950 text-purple-300 border-purple-800 hover:bg-purple-900'
                                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                                    }`}
                                    title={u.isDisabledByOwner ? 'Enable AI for user' : 'Disable AI for user'}
                                  >
                                    {u.isDisabledByOwner ? 'AI Off' : 'AI On'}
                                  </button>

                                  <button
                                    onClick={() => promptToggleUserSuspension(u)}
                                    disabled={isActionTarget}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold border ${
                                      u.isSuspended
                                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800 hover:bg-emerald-900'
                                        : 'bg-rose-950 text-rose-300 border-rose-800 hover:bg-rose-900'
                                    }`}
                                  >
                                    {u.isSuspended ? 'Restore' : 'Suspend'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-zinc-500">
                            No users found matching your search and filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: USER RIGHTS & PERMISSIONS MATRIX */}
          {activeTab === 'user_rights' && (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Module Header */}
              <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <span className="p-3 rounded-2xl bg-rose-950/80 border border-rose-800/60 text-rose-300 shadow-md shadow-rose-950/40">
                      <ShieldCheck className="w-6 h-6" />
                    </span>
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                        USER RIGHTS MANAGEMENT
                      </h2>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Per-user capability assignment, access packs, and server-side entitlement enforcement.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchAdminData}
                      disabled={isLoading}
                      className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-medium flex items-center gap-2 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh Matrix</span>
                    </button>
                  </div>
                </div>

                {/* Search & Quick User Selection Bar */}
                <div className="pt-4 border-t border-zinc-850 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      Select Target User ({users.length} registered)
                    </p>
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search by name, email, or ID..."
                        value={rightsUserSearch}
                        onChange={(e) => setRightsUserSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-rose-500/50"
                      />
                    </div>
                  </div>

                  {/* User Selection Chips / Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1">
                    {users
                      .filter((u) => {
                        if (!rightsUserSearch.trim()) return true;
                        const q = rightsUserSearch.toLowerCase();
                        return (
                          u.name.toLowerCase().includes(q) ||
                          u.email.toLowerCase().includes(q) ||
                          u.id.toLowerCase().includes(q)
                        );
                      })
                      .map((u) => {
                        const isSelected = (rightsSelectedUserId || users[0]?.id) === u.id;
                        return (
                          <button
                            key={u.id}
                            onClick={() => setRightsSelectedUserId(u.id)}
                            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                              isSelected
                                ? 'bg-rose-950/60 border-rose-600/80 shadow-md shadow-rose-950/50 ring-1 ring-rose-500/40'
                                : 'bg-zinc-900/40 hover:bg-zinc-900/80 border-zinc-800 text-zinc-400'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className={`font-semibold text-xs truncate ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                                {u.name}
                              </p>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  u.isSuspended
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800/40'
                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                                }`}
                              >
                                {u.isSuspended ? 'Suspended' : 'Active'}
                              </span>
                            </div>

                            <p className="text-[10px] text-zinc-500 truncate">{u.email}</p>

                            <div className="flex items-center justify-between text-[10px] pt-1 border-t border-zinc-800/60 text-zinc-400 font-mono">
                              <span className="text-rose-300 font-bold">{u.accessPack || 'Basic'}</span>
                              <span>{u.id.replace('usr_', '')}</span>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Embedded Capabilities & Rights Manager for Selected User */}
              {(() => {
                const targetUser = users.find((u) => u.id === (rightsSelectedUserId || users[0]?.id)) || users[0];
                if (!targetUser) {
                  return (
                    <div className="p-12 rounded-2xl bg-zinc-950 border border-zinc-800 text-center text-xs text-zinc-500">
                      No user accounts found on platform.
                    </div>
                  );
                }

                return (
                  <HoorviaCapabilitiesManager
                    key={targetUser.id}
                    user={targetUser}
                    token={token}
                    policy={policy}
                    isEmbedded={true}
                    onUpdated={() => {
                      fetchAdminData();
                    }}
                  />
                );
              })()}
            </div>
          )}

          {/* TAB 3: FEATURE CONTROL & POLICY */}
          {activeTab === 'features' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Platform Defaults Section */}
              <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
                  <div>
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-rose-400" />
                      Platform-Wide Global Feature Toggles
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Toggle system capabilities globally. Per-user exceptions can be configured below.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-zinc-900 text-zinc-300 border border-zinc-800 text-xs font-mono">
                    Runtime Policies
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      key: 'enableTextChat',
                      label: 'Text Chat Messaging',
                      desc: 'Allow public users to send textual messages to companions.',
                      enabled: policy?.enableTextChat ?? true,
                    },
                    {
                      key: 'enableLiveVoice',
                      label: 'Live WebRTC / Voice Streaming',
                      desc: 'Allow real-time low-latency voice streaming calls.',
                      enabled: policy?.enableLiveVoice ?? true,
                    },
                    {
                      key: 'enableMemory',
                      label: 'Companion Long-Term Memory',
                      desc: 'Save and retrieve structured user facts across sessions.',
                      enabled: policy?.enableMemory ?? true,
                    },
                    {
                      key: 'allowRegistration',
                      label: 'Allow New Registrations',
                      desc: 'Permit new public visitors to create Hoorvia accounts.',
                      enabled: policy?.allowRegistration ?? true,
                    },
                    {
                      key: 'requireBYOK',
                      label: 'Require BYOK (Bring Your Own Key)',
                      desc: 'Require users to configure their own Google Gemini API key.',
                      enabled: policy?.requireBYOK ?? true,
                    },
                    {
                      key: 'maintenanceMode',
                      label: 'Platform Maintenance Mode',
                      desc: 'Temporarily lock out non-owner users with a notice banner.',
                      enabled: policy?.maintenanceMode ?? false,
                    },
                  ].map((feat) => (
                    <div
                      key={feat.key}
                      className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-xs font-semibold text-white">{feat.label}</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">{feat.desc}</p>
                      </div>
                      <button
                        onClick={() => handleUpdatePolicy({ [feat.key]: !feat.enabled })}
                        className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                          feat.enabled ? 'bg-rose-600' : 'bg-zinc-800'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                            feat.enabled ? 'right-0.5' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Global Announcement Banner Editor */}
              <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  Global Platform Announcement Banner
                </h3>
                <p className="text-xs text-zinc-400">
                  Displayed prominently across all user dashboards when non-empty.
                </p>

                <textarea
                  rows={3}
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="e.g. Welcome to Hoorvia! System update scheduled for midnight..."
                  className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-rose-500/50"
                />

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setAnnouncementText('');
                      handleUpdatePolicy({ globalAnnouncement: '' });
                    }}
                    className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Clear Banner
                  </button>
                  <button
                    onClick={() => handleUpdatePolicy({ globalAnnouncement: announcementText })}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-md shadow-rose-950/50"
                  >
                    Save & Broadcast
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: QUOTAS & LIMITS */}
          {activeTab === 'quotas' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Default Quotas */}
              <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
                  <div>
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-violet-400" />
                      Platform Default Usage Limits
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Base quotas for all users unless individual overrides are configured.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-2">
                    <label className="text-xs font-semibold text-zinc-200 block">
                      Free Tier Daily Request Limit
                    </label>
                    <p className="text-[11px] text-zinc-400">
                      Maximum chat requests permitted per user per day.
                    </p>
                    <input
                      type="number"
                      value={freeTierDailyLimit}
                      onChange={(e) => setFreeTierDailyLimit(Number(e.target.value))}
                      className="w-full p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-rose-500/50"
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-2">
                    <label className="text-xs font-semibold text-zinc-200 block">
                      Max Live Voice Session (Minutes)
                    </label>
                    <p className="text-[11px] text-zinc-400">
                      Voice call duration ceiling per session.
                    </p>
                    <input
                      type="number"
                      value={maxLiveSessionMinutes}
                      onChange={(e) => setMaxLiveSessionMinutes(Number(e.target.value))}
                      className="w-full p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-rose-500/50"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() =>
                      handleUpdatePolicy({
                        freeTierDailyLimit,
                        maxLiveSessionMinutes,
                      })
                    }
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-md shadow-rose-950/50"
                  >
                    Save Platform Quotas
                  </button>
                </div>
              </div>

              {/* Per-User Custom Limits Quick Reference */}
              <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  Active Custom User Quotas
                </h3>
                <p className="text-xs text-zinc-400">
                  Users with custom overrides defined in the User Directory.
                </p>

                <div className="space-y-2">
                  {users.filter((u) => u.customEntitlements && Object.keys(u.customEntitlements).length > 0).length > 0 ? (
                    users
                      .filter((u) => u.customEntitlements && Object.keys(u.customEntitlements).length > 0)
                      .map((u) => (
                        <div
                          key={u.id}
                          className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/60 flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-semibold text-white">{u.name} ({u.email})</p>
                            <p className="text-[10px] text-zinc-400">
                              Daily Limit: {u.customEntitlements?.dailyRequestLimit ?? 'Default'} • Voice Limit:{' '}
                              {u.customEntitlements?.maxLiveSessionMinutes ?? 'Default'}m
                            </p>
                          </div>
                          <button
                            onClick={() => openEntitlementsModal(u)}
                            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs"
                          >
                            Edit Quotas
                          </button>
                        </div>
                      ))
                  ) : (
                    <p className="text-xs text-zinc-500 py-3 text-center">
                      No per-user custom quotas active. All users follow platform defaults.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="max-w-6xl mx-auto space-y-5">
              {/* Audit Sub-Tabs */}
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                <button
                  onClick={() => setAuditSubTab('admin')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    auditSubTab === 'admin'
                      ? 'bg-rose-950 text-rose-200 border border-rose-800/60'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Admin Action Logs ({adminAuditLogs.length})
                </button>
                <button
                  onClick={() => setAuditSubTab('api')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    auditSubTab === 'api'
                      ? 'bg-rose-950 text-rose-200 border border-rose-800/60'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Live Request Logs
                </button>
              </div>

              {/* Admin Audit Logs Table */}
              {auditSubTab === 'admin' && (
                <div className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Admin</th>
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Target User</th>
                        <th className="py-3 px-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {adminAuditLogs.length > 0 ? (
                        adminAuditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-zinc-900/30">
                            <td className="py-3 px-4 text-zinc-400 whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 font-mono text-rose-300">
                              {log.adminEmail}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-900 text-zinc-300 border border-zinc-800 uppercase">
                                {log.action.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-zinc-300 font-medium">
                              {log.targetUserEmail || log.targetUserId || 'Global / Platform'}
                            </td>
                            <td className="py-3 px-4 text-zinc-400">
                              {log.details}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-xs text-zinc-500">
                            No administrative audit entries recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* User API Requests Activity */}
              {auditSubTab === 'api' && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400">
                    Real-time log of inferences initiated by registered public accounts.
                  </p>

                  <div className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden">
                    <div className="divide-y divide-zinc-900">
                      {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                        stats.recentActivity.map((act) => (
                          <div key={act.id} className="p-3.5 flex items-center justify-between text-xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    act.status === 'success' ? 'bg-emerald-400' : 'bg-rose-400'
                                  }`}
                                />
                                <span className="font-semibold text-white">{act.title}</span>
                              </div>
                              <p className="text-[11px] text-zinc-400">{act.description}</p>
                            </div>
                            <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                              {new Date(act.timestamp).toLocaleString()}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center text-xs text-zinc-500">
                          No recent API activity logs found.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: SYSTEM HEALTH & SECURITY */}
          {activeTab === 'system' && (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Host and Runtime Specs */}
              <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  Runtime Environment & Hardware Host
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                  <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-1">
                    <p className="text-[10px] text-zinc-400">Operating System</p>
                    <p className="text-sm font-bold text-white uppercase">
                      {stats?.systemHealth.platform} ({stats?.systemHealth.arch})
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-1">
                    <p className="text-[10px] text-zinc-400">Node Engine</p>
                    <p className="text-sm font-bold text-white font-mono">
                      {stats?.systemHealth.nodeVersion}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-1">
                    <p className="text-[10px] text-zinc-400">Server Uptime</p>
                    <p className="text-sm font-bold text-emerald-400 font-mono">
                      {stats?.systemHealth.uptimeFormatted}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-1">
                    <p className="text-[10px] text-zinc-400">Memory (RSS / Heap)</p>
                    <p className="text-sm font-bold text-indigo-300 font-mono">
                      {stats?.systemHealth.memoryRssMb}MB / {stats?.systemHealth.memoryHeapUsedMb}MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Cryptography Vault & Security Verification */}
              <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-rose-400" />
                  Cryptographic BYOK Vault
                </h3>
                <p className="text-xs text-zinc-400">
                  User keys are encrypted with authenticated AES-256-GCM using isolated hardware-derived salt vectors.
                </p>

                <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Cipher Algorithm:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {stats?.systemHealth.cryptoAlgorithm}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Master Key Fingerprint:</span>
                    <span className="font-mono text-rose-300 font-medium">
                      {stats?.systemHealth.masterKeyFingerprint}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Total Encrypted Credentials Stored:</span>
                    <span className="font-mono text-white font-bold">
                      {stats?.systemHealth.totalCredentialsStored}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tool Runner Isolation Proof */}
              <div className="p-6 rounded-2xl bg-[#130713] border border-rose-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-rose-400" />
                    Local Tool Runner Isolation Proof
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 text-[10px] font-bold">
                    VERIFIED ENFORCED
                  </span>
                </div>

                <p className="text-xs text-rose-200/80 leading-relaxed">
                  The local Windows tool runner, AWS relay tunnel, and OmniRoute browser automation engine are strictly bound to Mohsin's private Maryam companion (`usr_mohsin_owner` / `comp_mohsin_maryam`). Public users have NO execution dispatcher, NO relay access, and cannot execute system tools or browser scripts under any condition.
                </p>

                <div className="pt-2 border-t border-rose-900/30 flex items-center justify-between text-xs text-zinc-400">
                  <span>Current Relay Tunnel Status:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {stats?.systemHealth.localRunnerStatus}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: TELEGRAM OWNER INTEGRATION */}
          {activeTab === 'integrations' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <HoorviaTelegramManager ownerToken={token} />
            </div>
          )}

          {/* TAB 8: WHATSAPP OWNER INTEGRATION (WA-AKG) */}
          {activeTab === 'whatsapp' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <HoorviaWhatsAppManager ownerToken={token} />
            </div>
          )}
        </main>
      </div>

      {/* MODAL 1: USER DETAILS DRAWER */}
      {selectedUserDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-zinc-950 border border-rose-900/30 rounded-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto text-xs">
            {/* 1. OVERVIEW & Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-950 text-rose-300 border border-rose-800/40 flex items-center justify-center font-bold text-sm uppercase">
                  {selectedUserDetails.name[0] || 'U'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{selectedUserDetails.name}</h3>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/40">
                      OVERVIEW
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">{selectedUserDetails.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUserDetails(null)}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 2. LOGIN & ACCOUNT */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-3 h-3" /> LOGIN & ACCOUNT
                </p>
                {selectedUserDetails.id !== 'usr_mohsin_owner' && (
                  <button
                    onClick={() => {
                      setResettingPasswordUser(selectedUserDetails);
                      setNewPasswordInput('');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-[10px] font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>Reset Password</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <p className="text-[10px] text-zinc-500">User ID</p>
                  <p className="font-mono text-zinc-200">{selectedUserDetails.id}</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <p className="text-[10px] text-zinc-500">Registration Date</p>
                  <p className="text-zinc-200">{new Date(selectedUserDetails.createdAt).toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <p className="text-[10px] text-zinc-500">Account Status</p>
                  <p className={selectedUserDetails.isSuspended ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {selectedUserDetails.accountStatus}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <p className="text-[10px] text-zinc-500">Companion Type</p>
                  <p className="text-zinc-200 font-semibold">{selectedUserDetails.companionType || 'Standard'}</p>
                </div>
              </div>
            </div>

            {/* 3. BYOK (BRING YOUR OWN KEY) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> BYOK (BRING YOUR OWN KEY)
                </p>
                <div className="flex items-center gap-1.5">
                  {selectedUserDetails.maskedApiKey && selectedUserDetails.maskedApiKey !== 'Not provided' && selectedUserDetails.maskedApiKey !== 'No Key Configured' && (
                    <>
                      <button
                        onClick={() => handleRevealUserKey(selectedUserDetails.id)}
                        disabled={revealingKeyUser === selectedUserDetails.id}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 border transition-colors ${
                          revealedKeys[selectedUserDetails.id]
                            ? 'bg-rose-950/80 border-rose-800 text-rose-300 hover:bg-rose-900'
                            : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
                        }`}
                      >
                        {revealingKeyUser === selectedUserDetails.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : revealedKeys[selectedUserDetails.id] ? (
                          <EyeOff className="w-3 h-3 text-rose-400" />
                        ) : (
                          <Eye className="w-3 h-3 text-zinc-400" />
                        )}
                        <span>{revealedKeys[selectedUserDetails.id] ? 'Hide Key' : 'Reveal Key'}</span>
                      </button>

                      {revealedKeys[selectedUserDetails.id] && (
                        <button
                          onClick={() => copyToClipboard(revealedKeys[selectedUserDetails.id], `key_${selectedUserDetails.id}`)}
                          className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-[10px] font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          {copiedText === `key_${selectedUserDetails.id}` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-zinc-400" />
                          )}
                          <span>{copiedText === `key_${selectedUserDetails.id}` ? 'Copied!' : 'Copy Key'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => promptRevokeUserKey(selectedUserDetails)}
                        disabled={revokingKeyUser === selectedUserDetails.id}
                        className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/60 text-rose-300 hover:text-white text-[10px] font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        {revokingKeyUser === selectedUserDetails.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3 text-rose-400" />
                        )}
                        <span>Revoke Key</span>
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => {
                      if (editingKeyUser === selectedUserDetails.id) {
                        setEditingKeyUser(null);
                        setNewApiKeyInput('');
                      } else {
                        setEditingKeyUser(selectedUserDetails.id);
                        setNewApiKeyInput('');
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-[10px] font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Edit3 className="w-3 h-3 text-zinc-400" />
                    <span>
                      {editingKeyUser === selectedUserDetails.id
                        ? 'Cancel Edit'
                        : selectedUserDetails.maskedApiKey && selectedUserDetails.maskedApiKey !== 'Not provided' && selectedUserDetails.maskedApiKey !== 'No Key Configured'
                        ? 'Replace Key'
                        : 'Add Key'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Reveal Key Alert Box (When Decrypted) */}
              {revealedKeys[selectedUserDetails.id] && (
                <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock className="w-3 h-3" /> FULL DECRYPTED API KEY (OWNER VIEW)
                    </p>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                      AES-256-GCM DECRYPTED
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-amber-900/50 flex items-center justify-between">
                    <p className="font-mono text-amber-200 text-xs break-all select-all font-semibold">
                      {revealedKeys[selectedUserDetails.id]}
                    </p>
                    <button
                      onClick={() => copyToClipboard(revealedKeys[selectedUserDetails.id], `key_${selectedUserDetails.id}`)}
                      className="ml-2 p-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-amber-300 hover:text-white shrink-0"
                    >
                      {copiedText === `key_${selectedUserDetails.id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-amber-300/70">
                    Security Notice: Decrypted in memory for this session only. Raw keys are never stored in plain text or logged.
                  </p>
                </div>
              )}

              {/* Replace / Add Key Input Panel */}
              {editingKeyUser === selectedUserDetails.id && (
                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-rose-800/60 space-y-2.5">
                  <p className="text-[10px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Edit3 className="w-3 h-3" />{' '}
                    {selectedUserDetails.maskedApiKey && selectedUserDetails.maskedApiKey !== 'Not provided' && selectedUserDetails.maskedApiKey !== 'No Key Configured'
                      ? 'REPLACE / UPDATE'
                      : 'CONFIGURE'}{' '}
                    GEMINI API KEY
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={newApiKeyInput}
                      onChange={(e) => setNewApiKeyInput(e.target.value)}
                      placeholder="Enter new AI Studio Gemini API Key (AIzaSy...)"
                      className="flex-1 p-2 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500 font-mono"
                    />
                    <button
                      onClick={() => handleUpdateUserKey(selectedUserDetails.id)}
                      disabled={updatingKeyUser === selectedUserDetails.id || !newApiKeyInput.trim()}
                      className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                    >
                      {updatingKeyUser === selectedUserDetails.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Save & Encrypt</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    Will be tested against Google Gemini and encrypted with AES-256-GCM before saving.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-zinc-500">Google Gemini API Key</p>
                    {revealedKeys[selectedUserDetails.id] && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                        DECRYPTED
                      </span>
                    )}
                  </div>
                  {revealedKeys[selectedUserDetails.id] ? (
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-mono text-amber-300 font-semibold text-xs break-all select-all">
                        {revealedKeys[selectedUserDetails.id]}
                      </p>
                      <button
                        onClick={() => copyToClipboard(revealedKeys[selectedUserDetails.id], `grid_key_${selectedUserDetails.id}`)}
                        className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-amber-300 shrink-0"
                        title="Copy Key"
                      >
                        {copiedText === `grid_key_${selectedUserDetails.id}` ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <p className="font-mono text-zinc-200">{selectedUserDetails.maskedApiKey || 'Not provided'}</p>
                  )}
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <p className="text-[10px] text-zinc-500">Selected Gemini Model</p>
                  <p className="font-mono text-zinc-200">{selectedUserDetails.selectedModel || 'gemini-2.5-flash'}</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1 col-span-2">
                  <p className="text-[10px] text-zinc-500">Key Fingerprint</p>
                  <p className="font-mono text-rose-300 text-[11px]">{selectedUserDetails.safeCredentialFingerprint || 'None'}</p>
                </div>
              </div>
            </div>

            {/* 4. CAPABILITIES & RIGHTS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3" /> CAPABILITIES & RIGHTS
                </p>
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                  Pack: {selectedUserDetails.accessPack || 'Custom'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-zinc-400">Companion Name & Type</p>
                  <p className="text-zinc-200 font-medium">{selectedUserDetails.companionName} ({selectedUserDetails.companionType})</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-zinc-400">Total Effective Capabilities</p>
                  <p className="text-emerald-400 font-bold">
                    {selectedUserDetails.effectiveCapabilities ? Object.values(selectedUserDetails.effectiveCapabilities).filter(Boolean).length : 0} enabled
                  </p>
                </div>
              </div>
            </div>

            {/* 5. USAGE & QUOTAS */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart2 className="w-3 h-3" /> USAGE & QUOTAS
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <p className="text-[10px] text-zinc-500">Total Inferences (Lifetime)</p>
                  <p className="text-white font-bold text-sm">{selectedUserDetails.totalRequests || 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <p className="text-[10px] text-zinc-500">Daily Quota Limit</p>
                  <p className="text-white font-bold text-sm">
                    {selectedUserDetails.customEntitlements?.dailyRequestLimit ? `${selectedUserDetails.customEntitlements.dailyRequestLimit} req/day` : 'Default (100)'}
                  </p>
                </div>
              </div>
            </div>

            {/* 6. ACTIVITY / AUDIT */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3 h-3" /> ACTIVITY / AUDIT
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {userAuditLogs[selectedUserDetails.id] && userAuditLogs[selectedUserDetails.id].length > 0 ? (
                  userAuditLogs[selectedUserDetails.id].map((log) => (
                    <div
                      key={log.id}
                      className="p-2 rounded-lg bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            log.status === 'Success' ? 'bg-emerald-400' : 'bg-rose-400'
                          }`}
                        />
                        <span className="font-medium text-zinc-200">{log.actionType}</span>
                        <span className="text-zinc-500">({log.model})</span>
                      </div>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-zinc-500 text-[11px] py-2">
                    {loadingUserLogs ? 'Loading user logs...' : 'No activity logged for this user.'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
              <button
                onClick={() => {
                  const targetUser = selectedUserDetails;
                  setSelectedUserDetails(null);
                  setManagingCapabilitiesUser(targetUser);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-950/50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Manage Capabilities & Rights</span>
              </button>

              <button
                onClick={() => setSelectedUserDetails(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-950 border border-rose-900/40 rounded-2xl p-6 space-y-4 shadow-2xl text-xs">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              {confirmModal.title}
            </h3>
            <p className="text-zinc-300 leading-relaxed">{confirmModal.description}</p>
            <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-lg ${
                  confirmModal.actionType === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-950/50'
                }`}
              >
                {confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT ENTITLEMENTS / QUOTAS */}
      {editingUserEntitlements && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-zinc-950 border border-rose-900/30 rounded-2xl p-6 space-y-5 shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Edit Custom Entitlements: {editingUserEntitlements.name}
                </h3>
                <p className="text-[11px] text-zinc-400">{editingUserEntitlements.email}</p>
              </div>
              <button
                onClick={() => setEditingUserEntitlements(null)}
                className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Feature Toggles */}
              <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-2">
                <p className="text-zinc-400 font-semibold text-[11px]">Feature Access Overrides</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tempEntitlements.allowTextChat}
                      onChange={(e) => setTempEntitlements((p) => ({ ...p, allowTextChat: e.target.checked }))}
                      className="rounded accent-rose-600"
                    />
                    <span className="text-zinc-200">Text Chat</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tempEntitlements.allowLiveVoice}
                      onChange={(e) => setTempEntitlements((p) => ({ ...p, allowLiveVoice: e.target.checked }))}
                      className="rounded accent-rose-600"
                    />
                    <span className="text-zinc-200">Live Voice</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tempEntitlements.enableMemory}
                      onChange={(e) => setTempEntitlements((p) => ({ ...p, enableMemory: e.target.checked }))}
                      className="rounded accent-rose-600"
                    />
                    <span className="text-zinc-200">Long-term Memory</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tempEntitlements.allowCompanionCustomization}
                      onChange={(e) => setTempEntitlements((p) => ({ ...p, allowCompanionCustomization: e.target.checked }))}
                      className="rounded accent-rose-600"
                    />
                    <span className="text-zinc-200">Customization</span>
                  </label>
                </div>
              </div>

              {/* Quota Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-1">
                  <label className="text-zinc-400 text-[10px] block">Daily Request Limit (Blank = Default)</label>
                  <input
                    type="number"
                    value={tempEntitlements.dailyRequestLimit}
                    onChange={(e) =>
                      setTempEntitlements((p) => ({
                        ...p,
                        dailyRequestLimit: e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                    placeholder={`Default: ${policy?.freeTierDailyLimit ?? 100}`}
                    className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-1">
                  <label className="text-zinc-400 text-[10px] block">Max Voice Session (Minutes)</label>
                  <input
                    type="number"
                    value={tempEntitlements.maxLiveSessionMinutes}
                    onChange={(e) =>
                      setTempEntitlements((p) => ({
                        ...p,
                        maxLiveSessionMinutes: e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                    placeholder={`Default: ${policy?.maxLiveSessionMinutes ?? 30}`}
                    className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setEditingUserEntitlements(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEntitlements}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-white text-xs shadow-md shadow-rose-950/50"
              >
                Save Entitlements
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3.5: ADMINISTRATIVE PASSWORD RESET MODAL */}
      {resettingPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-950 border border-rose-900/40 rounded-2xl p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                Reset Password: {resettingPasswordUser.name}
              </h3>
              <button
                onClick={() => {
                  setResettingPasswordUser(null);
                  setNewPasswordInput('');
                }}
                className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-zinc-300 leading-relaxed">
              Set a new secure password for <strong className="text-rose-300">{resettingPasswordUser.email}</strong>. The old password hash will be immediately overwritten.
            </p>

            <div className="space-y-1.5">
              <label className="text-zinc-400 text-[10px] block font-semibold">NEW PASSWORD (MIN 6 CHARACTERS)</label>
              <input
                type="password"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="Enter new temporary or permanent password"
                className="w-full p-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-800">
              <button
                onClick={() => {
                  setResettingPasswordUser(null);
                  setNewPasswordInput('');
                }}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAdminResetPassword}
                disabled={isResettingPassword || !newPasswordInput || newPasswordInput.length < 6}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
              >
                {isResettingPassword ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Confirm Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ONE-CLICK CAPABILITIES & RIGHTS SYSTEM */}
      {managingCapabilitiesUser && (
        <HoorviaCapabilitiesManager
          user={managingCapabilitiesUser}
          token={token}
          policy={policy}
          onClose={() => setManagingCapabilitiesUser(null)}
          onUpdated={async () => {
            await fetchAdminData();
          }}
        />
      )}
    </div>
  );
};
