import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarClock,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Sparkles,
  Info,
  X,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  ChevronRight,
  Shield,
} from 'lucide-react';
import {
  ScheduledTask,
  TaskRunHistory,
  TaskSummaryCounts,
  TaskStatus,
} from '../types/taskManagement';

interface ScheduledTasksViewProps {
  onNavigateToCreate: () => void;
  authToken?: string;
}

type FilterStatus = 'ALL' | 'SCHEDULED' | 'PENDING' | 'IN PROGRESS' | 'COMPLETED' | 'FAILED' | 'PAUSED';

export const ScheduledTasksView: React.FC<ScheduledTasksViewProps> = ({
  onNavigateToCreate,
  authToken,
}) => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [summary, setSummary] = useState<TaskSummaryCounts>({
    total: 0,
    scheduled: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
    paused: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('ALL');

  // Selected task for details modal
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<{
    task: ScheduledTask;
    runs: TaskRunHistory[];
  } | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Action status state
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['x-hoorvia-token'] = authToken;
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/hoorvia/tasks', { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTasks(data.tasks || []);
      setSummary(data.summary || {
        total: 0,
        scheduled: 0,
        in_progress: 0,
        completed: 0,
        failed: 0,
        paused: 0,
      });
    } catch (err: any) {
      console.error('Failed fetching tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const loadTaskDetails = async (taskId: string) => {
    setSelectedTaskId(taskId);
    setIsLoadingDetails(true);
    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['x-hoorvia-token'] = authToken;
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/hoorvia/tasks/${taskId}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSelectedTaskDetails(data);
    } catch (err: any) {
      console.error('Failed fetching task details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleRunNow = async (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActionInProgressId(taskId);
    setNotification(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['x-hoorvia-token'] = authToken;
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/hoorvia/tasks/${taskId}/run`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNotification({
        type: 'success',
        message: `Task execution finished: ${data.run?.status || 'COMPLETED'}`,
      });
      await fetchTasks();
      if (selectedTaskId === taskId) {
        await loadTaskDetails(taskId);
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Run execution failed.' });
    } finally {
      setActionInProgressId(null);
    }
  };

  const handlePause = async (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActionInProgressId(taskId);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['x-hoorvia-token'] = authToken;
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/hoorvia/tasks/${taskId}/pause`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchTasks();
      if (selectedTaskId === taskId) {
        await loadTaskDetails(taskId);
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Pause failed.' });
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleResume = async (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActionInProgressId(taskId);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['x-hoorvia-token'] = authToken;
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/hoorvia/tasks/${taskId}/resume`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchTasks();
      if (selectedTaskId === taskId) {
        await loadTaskDetails(taskId);
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Resume failed.' });
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleCancel = async (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActionInProgressId(taskId);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['x-hoorvia-token'] = authToken;
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/hoorvia/tasks/${taskId}/cancel`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchTasks();
      if (selectedTaskId === taskId) {
        await loadTaskDetails(taskId);
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Cancel failed.' });
    } finally {
      setActionInProgressId(null);
    }
  };

  const formatScheduleText = (task: ScheduledTask): string => {
    const { task_type, schedule } = task;
    const time = schedule.startTime || '09:00';
    if (task_type === 'one_time') {
      return `One-Time on ${schedule.startDate || 'scheduled date'} at ${time}`;
    }
    if (task_type === 'daily') {
      return `Every day at ${time}`;
    }
    if (task_type === 'weekly') {
      const days = (schedule.daysOfWeek || ['friday']).map((d) => d.slice(0, 3).toUpperCase()).join(', ');
      return `Every ${days} at ${time}`;
    }
    if (task_type === 'monthly') {
      return `Day ${schedule.dayOfMonth || 1} of month at ${time}`;
    }
    if (task_type === 'custom') {
      return `Every ${schedule.customInterval || 1} ${schedule.customUnit || 'days'} at ${time}`;
    }
    return `Scheduled at ${time}`;
  };

  const formatIsoDate = (iso: string | null | undefined): string => {
    if (!iso) return '—';
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

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'SCHEDULED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-950/70 text-blue-300 border border-blue-600/40">SCHEDULED</span>;
      case 'IN PROGRESS':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-950/70 text-amber-300 border border-amber-600/40 animate-pulse">IN PROGRESS</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-600/40">COMPLETED</span>;
      case 'FAILED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-950/70 text-rose-300 border border-rose-600/40">FAILED</span>;
      case 'PAUSED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-800/70 text-zinc-300 border border-zinc-600/40">PAUSED</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-900 text-zinc-500 border border-zinc-700/40">CANCELLED</span>;
      case 'PENDING':
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-950/70 text-purple-300 border border-purple-600/40">PENDING</span>;
    }
  };

  const getPriorityBadge = (priority: ScheduledTask['priority']) => {
    switch (priority) {
      case 'critical':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-950/60 text-rose-300 border border-rose-800/40">Critical</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/40">High</span>;
      case 'normal':
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-800/60 text-zinc-400 border border-zinc-700/40">Normal</span>;
    }
  };

  // Filter & search
  const filteredTasks = tasks.filter((t) => {
    const matchesFilter = activeFilter === 'ALL' || t.status === activeFilter;
    const matchesSearch = !searchQuery.trim() || t.task_name.toLowerCase().includes(searchQuery.toLowerCase()) || t.instructions.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col rounded-3xl border border-rose-900/30 bg-[#0a0409]/95 backdrop-blur-xl shadow-2xl overflow-hidden text-zinc-100">
      {/* Top Header */}
      <div className="shrink-0 px-6 py-4 border-b border-rose-900/25 bg-[#120610]/90 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-rose-400" />
            Scheduled Tasks & Operations
          </h2>
          <p className="text-xs text-rose-300/80 font-serif italic">
            Mohsin's Autonomous Task Control Center. Maryam executes scheduled and recurring jobs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchTasks}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-rose-900/30 transition-all"
            title="Refresh Tasks"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-rose-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onNavigateToCreate}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-rose-700 to-violet-800 hover:from-rose-600 hover:to-violet-700 text-white shadow-md shadow-rose-950/40 flex items-center gap-1.5 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Notification Toast */}
        {notification && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-medium flex items-center justify-between animate-fadeIn ${
              notification.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/80 border border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-zinc-400 hover:text-white text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Real Summary Counts Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'TOTAL', count: summary.total, color: 'text-white' },
            { label: 'SCHEDULED', count: summary.scheduled, color: 'text-blue-300' },
            { label: 'IN PROGRESS', count: summary.in_progress, color: 'text-amber-300' },
            { label: 'COMPLETED', count: summary.completed, color: 'text-emerald-300' },
            { label: 'FAILED', count: summary.failed, color: 'text-rose-400' },
            { label: 'PAUSED', count: summary.paused, color: 'text-zinc-400' },
          ].map((s) => (
            <div
              key={s.label}
              className="p-3.5 rounded-2xl bg-black/40 border border-rose-900/30 flex flex-col justify-between shadow-inner"
            >
              <span className="text-[10px] font-bold tracking-wider text-rose-300/70">{s.label}</span>
              <span className={`text-2xl font-bold font-serif ${s.color} mt-1`}>{s.count}</span>
            </div>
          ))}
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-black/40 border border-rose-900/30">
            {(
              [
                'ALL',
                'SCHEDULED',
                'IN PROGRESS',
                'COMPLETED',
                'FAILED',
                'PAUSED',
              ] as FilterStatus[]
            ).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                  activeFilter === filter
                    ? 'bg-rose-950 border border-rose-600/50 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {filter === 'ALL' ? 'All' : filter.charAt(0) + filter.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-rose-900/30 text-xs text-white focus:outline-none placeholder-zinc-500"
            />
          </div>
        </div>

        {/* Task List Table/Cards */}
        {isLoading ? (
          <div className="p-12 text-center text-zinc-400 text-xs flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 text-rose-400 animate-spin" />
            <span>Loading scheduled tasks...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-black/20 border border-rose-900/20 text-zinc-400 space-y-3">
            <CalendarClock className="w-8 h-8 text-rose-500/50 mx-auto" />
            <p className="text-sm font-medium text-zinc-300">No scheduled tasks match your filter.</p>
            <button
              onClick={onNavigateToCreate}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-950/60 border border-rose-700/40 text-rose-200 hover:text-white transition-all"
            >
              Create New Task for Maryam
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const isActionRunning = actionInProgressId === task.task_id;
              const isRecurring = task.task_type !== 'one_time';

              return (
                <div
                  key={task.task_id}
                  onClick={() => loadTaskDetails(task.task_id)}
                  className="p-4 rounded-2xl bg-black/40 hover:bg-black/60 border border-rose-900/30 hover:border-rose-700/50 transition-all cursor-pointer shadow-md group space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                      <div>
                        <h3 className="text-sm font-serif font-bold text-white group-hover:text-rose-200 transition-colors flex items-center gap-2">
                          {task.task_name}
                          {getPriorityBadge(task.priority)}
                        </h3>
                        <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                          {task.instructions}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getStatusBadge(task.status)}
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-rose-900/20 text-[11px] text-zinc-400">
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Schedule:</span>
                      <span className="text-rose-200/90">{formatScheduleText(task)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Next Run:</span>
                      <span className="text-zinc-200">{formatIsoDate(task.next_run_at)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Last Run:</span>
                      <span className="text-zinc-300">{formatIsoDate(task.last_run_at)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Execution State:</span>
                      <span className="text-emerald-300 font-medium">{task.progress || 'Idle'}</span>
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex items-center justify-between pt-2 border-t border-rose-900/10" onClick={(e) => e.stopPropagation()}>
                    <div className="text-[10px] text-zinc-500 font-serif italic">
                      Runs: {task.execution_count} execution{task.execution_count === 1 ? '' : 's'}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Run Now / Retry */}
                      <button
                        type="button"
                        disabled={isActionRunning}
                        onClick={(e) => handleRunNow(task.task_id, e)}
                        className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-rose-950/60 hover:bg-rose-900/80 border border-rose-700/40 text-rose-200 hover:text-white flex items-center gap-1 transition-all disabled:opacity-50"
                        title="Run Task Immediately"
                      >
                        <Play className="w-3 h-3 text-rose-400 fill-rose-400" />
                        <span>{task.status === 'FAILED' ? 'Retry' : 'Run Now'}</span>
                      </button>

                      {/* Pause / Resume for Recurring */}
                      {isRecurring && task.status === 'SCHEDULED' && (
                        <button
                          type="button"
                          disabled={isActionRunning}
                          onClick={(e) => handlePause(task.task_id, e)}
                          className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/40 text-zinc-300 hover:text-white flex items-center gap-1 transition-all disabled:opacity-50"
                          title="Pause Recurrence"
                        >
                          <Pause className="w-3 h-3" />
                          <span>Pause</span>
                        </button>
                      )}

                      {isRecurring && task.status === 'PAUSED' && (
                        <button
                          type="button"
                          disabled={isActionRunning}
                          onClick={(e) => handleResume(task.task_id, e)}
                          className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-blue-950/60 hover:bg-blue-900/80 border border-blue-700/40 text-blue-200 hover:text-white flex items-center gap-1 transition-all disabled:opacity-50"
                          title="Resume Recurrence"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Resume</span>
                        </button>
                      )}

                      {/* Cancel if active */}
                      {task.status !== 'CANCELLED' && task.status !== 'COMPLETED' && (
                        <button
                          type="button"
                          disabled={isActionRunning}
                          onClick={(e) => handleCancel(task.task_id, e)}
                          className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-black/40 hover:bg-rose-950/60 border border-white/10 hover:border-rose-800/40 text-zinc-400 hover:text-rose-200 transition-all disabled:opacity-50"
                          title="Cancel Task"
                        >
                          Cancel
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => loadTaskDetails(task.task_id)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
                        title="View Details"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Task Details Modal */}
      {selectedTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-2xl max-h-[85vh] bg-[#11050e] border border-rose-900/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-zinc-100">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-rose-900/30 bg-[#190815] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CalendarClock className="w-5 h-5 text-rose-400" />
                <div>
                  <h3 className="text-base font-serif font-bold text-white">
                    {selectedTaskDetails?.task?.task_name || 'Task Details'}
                  </h3>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ID: {selectedTaskId}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedTaskId(null);
                  setSelectedTaskDetails(null);
                }}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {isLoadingDetails || !selectedTaskDetails ? (
                <div className="p-8 text-center text-zinc-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-rose-400 animate-spin" />
                  <span className="text-xs">Loading execution records...</span>
                </div>
              ) : (
                <>
                  {/* Status & Priority Overview */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/40 border border-rose-900/30">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(selectedTaskDetails.task.status)}
                      {getPriorityBadge(selectedTaskDetails.task.priority)}
                    </div>
                    <div className="text-right text-[11px] text-zinc-400">
                      <span>Approval Mode: </span>
                      <span className="font-semibold text-rose-200">
                        {selectedTaskDetails.task.approval_mode === 'ask_owner'
                          ? 'Ask Owner First'
                          : 'Automatic'}
                      </span>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-200 mb-1">
                      Instructions for Maryam
                    </h4>
                    <div className="p-3.5 rounded-2xl bg-black/40 border border-rose-900/30 text-xs text-zinc-300 leading-relaxed">
                      {selectedTaskDetails.task.instructions}
                    </div>
                  </div>

                  {/* Schedule & Targets */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-2xl bg-black/30 border border-rose-900/20">
                      <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Schedule</span>
                      <span className="font-medium text-white">
                        {formatScheduleText(selectedTaskDetails.task)}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-black/30 border border-rose-900/20">
                      <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Next Scheduled Run</span>
                      <span className="font-medium text-zinc-200">
                        {formatIsoDate(selectedTaskDetails.task.next_run_at)}
                      </span>
                    </div>
                  </div>

                  {/* Latest Result / Error */}
                  {selectedTaskDetails.task.latest_result && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-300 mb-1">
                        Latest Execution Result
                      </h4>
                      <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200">
                        {selectedTaskDetails.task.latest_result}
                      </div>
                    </div>
                  )}

                  {selectedTaskDetails.task.latest_error && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-300 mb-1">
                        Latest Error
                      </h4>
                      <div className="p-3 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-200">
                        {selectedTaskDetails.task.latest_error}
                      </div>
                    </div>
                  )}

                  {/* Run History List */}
                  <div className="space-y-2 pt-2 border-t border-rose-900/30">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-200 flex items-center justify-between">
                      <span>Execution Run History</span>
                      <span className="text-[10px] text-zinc-500 lowercase font-normal">
                        ({selectedTaskDetails.runs.length} logged runs)
                      </span>
                    </h4>

                    {selectedTaskDetails.runs.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic p-3">No executions recorded yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {selectedTaskDetails.runs.map((run) => (
                          <div
                            key={run.run_id}
                            className="p-3 rounded-xl bg-black/40 border border-rose-900/20 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-white flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                                {formatIsoDate(run.started_at)}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                  run.status === 'COMPLETED'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/30'
                                    : run.status === 'FAILED'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-600/30'
                                    : 'bg-amber-950 text-amber-300 border border-amber-600/30 animate-pulse'
                                }`}
                              >
                                {run.status}
                              </span>
                            </div>
                            {run.result_summary && (
                              <p className="text-[11px] text-zinc-300 mt-1">{run.result_summary}</p>
                            )}
                            {run.error && (
                              <p className="text-[11px] text-rose-300 mt-1">Error: {run.error}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer Controls */}
            {selectedTaskDetails && (
              <div className="px-6 py-3 border-t border-rose-900/30 bg-[#190815] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={actionInProgressId === selectedTaskDetails.task.task_id}
                    onClick={() => handleRunNow(selectedTaskDetails.task.task_id)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-700 to-violet-800 text-white shadow-md flex items-center gap-1.5 hover:from-rose-600 hover:to-violet-700 transition-all disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Now</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedTaskId(null);
                    setSelectedTaskDetails(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-zinc-300 transition-all"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
