import React, { useState, useEffect } from 'react';
import {
  Heart,
  Users,
  Activity,
  Mic,
  MessageCircle,
  AlertTriangle,
  ShieldCheck,
  Settings,
  Sparkles,
  Clock,
  ArrowLeft,
  RefreshCw,
  ChevronRight,
  Key,
  UserPlus,
  Ban,
} from 'lucide-react';
import { PlatformOverviewStats } from '../lib/hoorviaTypes';

interface PariOwnerDashboardProps {
  token: string;
  ownerName?: string;
  onClose: () => void;
  onOpenFullAdmin: () => void;
}

function greetingForHour(h: number): string {
  if (h >= 5 && h < 12) return 'Subah bakhair';
  if (h >= 12 && h < 17) return 'Dopahar bakhair';
  if (h >= 17 && h < 21) return 'Shaam bakhair';
  return 'Raat bakhair';
}

export const PariOwnerDashboard: React.FC<PariOwnerDashboardProps> = ({
  token,
  ownerName = 'Mohsin',
  onClose,
  onOpenFullAdmin,
}) => {
  const [stats, setStats] = useState<PlatformOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hoorvia/admin/stats', {
        headers: { 'X-Hoorvia-Token': token },
      });
      if (res.status === 403 || res.status === 401) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (res.ok && data.stats) setStats(data.stats);
    } catch {
      /* silent — wife doesn't panic */
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const hour = new Date().getHours();
  const greeting = greetingForHour(hour);
  const today = new Date().toLocaleDateString('en-PK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const attentionItems: Array<{ icon: React.ReactNode; text: string; tone: string }> = [];
  if (stats) {
    if (stats.suspendedUsers > 0)
      attentionItems.push({
        icon: <Ban size={16} />,
        text: `${stats.suspendedUsers} user${stats.suspendedUsers > 1 ? 's' : ''} suspended hain — ek nazar daal lein`,
        tone: 'amber',
      });
    if (stats.byokSummary.invalid > 0)
      attentionItems.push({
        icon: <Key size={16} />,
        text: `${stats.byokSummary.invalid} API key${stats.byokSummary.invalid > 1 ? 's' : ''} invalid hain`,
        tone: 'amber',
      });
    if (stats.byokSummary.missing > 0)
      attentionItems.push({
        icon: <AlertTriangle size={16} />,
        text: `${stats.byokSummary.missing} users ne abhi tak key connect nahi ki`,
        tone: 'slate',
      });
    if (attentionItems.length === 0)
      attentionItems.push({
        icon: <ShieldCheck size={16} />,
        text: 'Sab theek chal raha hai — koi fikar wali baat nahi',
        tone: 'green',
      });
  }

  const toneClasses: Record<string, string> = {
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    green: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-amber-50 to-orange-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-500 via-pink-500 to-rose-400 text-white px-6 pt-6 pb-16 rounded-b-[2rem] shadow-lg">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-white/90 hover:text-white text-sm font-medium"
          >
            <ArrowLeft size={18} /> Wapas
          </button>
          <button
            onClick={fetchStats}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="max-w-5xl mx-auto mt-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/25 backdrop-blur flex items-center justify-center shadow-inner">
            <Heart size={30} className="text-white" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {greeting}, {ownerName}! 💛
            </h1>
            <p className="text-white/85 text-sm mt-1">
              {today} — main ne ghar ka haal dekh liya hai, sab aap ke liye tayyar hai
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 -mt-8 pb-12">
        {unauthorized ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <ShieldCheck size={40} className="mx-auto text-rose-400 mb-3" />
            <p className="font-semibold text-slate-800">Ye darwaza sirf owner ke liye hai</p>
            <p className="text-sm text-slate-500 mt-1">Owner verification nahi hui — wapas ja kar dobara try karein</p>
          </div>
        ) : loading && !stats ? (
          <div className="bg-white rounded-2xl shadow p-12 text-center">
            <RefreshCw size={32} className="mx-auto text-rose-400 animate-spin mb-3" />
            <p className="text-slate-600 text-sm">Ghar ka haal dekh rahi hun… ek second</p>
          </div>
        ) : (
          <>
            {/* Ghar ka haal — stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  icon: <Users size={20} className="text-rose-500" />,
                  label: 'Hamare users',
                  value: stats?.totalUsers ?? 0,
                  sub: `${stats?.activeUsers ?? 0} active`,
                },
                {
                  icon: <Activity size={20} className="text-pink-500" />,
                  label: 'Live sessions',
                  value: stats?.activeSessions ?? 0,
                  sub: 'is waqt baat kar rahe',
                },
                {
                  icon: <MessageCircle size={20} className="text-amber-500" />,
                  label: 'Aaj ki baatein',
                  value: stats?.usageSummary.totalRequestsToday ?? 0,
                  sub: 'requests today',
                },
                {
                  icon: <Mic size={20} className="text-orange-500" />,
                  label: 'Voice minutes',
                  value: stats?.usageSummary.totalLiveMinutesToday ?? 0,
                  sub: 'aaj live voice',
                },
              ].map((c, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm border border-rose-100 p-5 hover:shadow-md transition">
                  <div className="flex items-center gap-2 mb-2">{c.icon}</div>
                  <div className="text-3xl font-bold text-slate-800">{c.value}</div>
                  <div className="text-sm font-medium text-slate-600 mt-0.5">{c.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{c.sub}</div>
                </div>
              ))}
            </div>

            {/* Tawajju chahiye */}
            <div className="bg-white rounded-2xl shadow-sm border border-rose-100 p-6 mt-6">
              <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                <Sparkles size={18} className="text-rose-500" />
                Tawajju chahiye
              </h2>
              <div className="space-y-3">
                {attentionItems.map((a, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${toneClasses[a.tone]}`}
                  >
                    {a.icon}
                    {a.text}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
              {/* Naye mehmaan */}
              <div className="bg-white rounded-2xl shadow-sm border border-rose-100 p-6">
                <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                  <UserPlus size={18} className="text-rose-500" />
                  Naye mehmaan
                </h2>
                {stats?.recentRegistrations?.length ? (
                  <div className="space-y-3">
                    {stats.recentRegistrations.slice(0, 5).map((u) => (
                      <div key={u.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold">
                            {(u.name || u.email || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-slate-800">{u.name || 'User'}</div>
                            <div className="text-xs text-slate-400">{u.email}</div>
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(u.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Abhi koi naya mehmaan nahi aaya</p>
                )}
              </div>

              {/* Quick actions */}
              <div className="bg-white rounded-2xl shadow-sm border border-rose-100 p-6">
                <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                  <Heart size={18} className="text-rose-500" fill="currentColor" />
                  Mere liye kuch karein?
                </h2>
                <div className="space-y-2">
                  <button
                    onClick={onOpenFullAdmin}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-medium hover:opacity-90 transition"
                  >
                    <span className="flex items-center gap-2">
                      <Settings size={16} /> Poora control room kholein
                    </span>
                    <ChevronRight size={16} />
                  </button>
                  <button
                    onClick={fetchStats}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-rose-50 text-rose-700 font-medium hover:bg-rose-100 transition"
                  >
                    <span className="flex items-center gap-2">
                      <RefreshCw size={16} /> Taza haal dekhein
                    </span>
                    <ChevronRight size={16} />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-4 leading-relaxed">
                  Gehre controls — users, keys, policies, audit logs — control room mein milenge. Ye dashboard sirf pyaar bhari nazar ke liye hai 💛
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
