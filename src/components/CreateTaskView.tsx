import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Globe,
  FileText,
  Shield,
  Sparkles,
  ArrowRight,
  Repeat,
} from 'lucide-react';
import { TaskType, TaskPriority, TaskApprovalMode, TaskScheduleConfig } from '../types/taskManagement';

interface CreateTaskViewProps {
  onTaskCreated: () => void;
  onNavigateToScheduled?: () => void;
  onCancel?: () => void;
  authToken?: string;
}

const DAYS_OF_WEEK = [
  { id: 'monday', label: 'Mon' },
  { id: 'tuesday', label: 'Tue' },
  { id: 'wednesday', label: 'Wed' },
  { id: 'thursday', label: 'Thu' },
  { id: 'friday', label: 'Fri' },
  { id: 'saturday', label: 'Sat' },
  { id: 'sunday', label: 'Sun' },
];

export const CreateTaskView: React.FC<CreateTaskViewProps> = ({
  onTaskCreated,
  onNavigateToScheduled,
  authToken,
}) => {
  const [taskName, setTaskName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('daily');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [approvalMode, setApprovalMode] = useState<TaskApprovalMode>('automatic');

  // Schedule fields
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('09:00');
  const [deadline, setDeadline] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>(['monday', 'friday']);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [customInterval, setCustomInterval] = useState<number>(2);
  const [customUnit, setCustomUnit] = useState<'days' | 'weeks'>('days');

  // Optional resources
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [taskNotes, setTaskNotes] = useState('');

  // UI status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!taskName.trim()) {
      setErrorMessage('Please provide a task name.');
      return;
    }
    if (!instructions.trim()) {
      setErrorMessage('Please describe the instructions for Maryam.');
      return;
    }

    const scheduleConfig: TaskScheduleConfig = {
      startDate,
      startTime,
      deadline: taskType === 'one_time' && deadline ? deadline : undefined,
      endDate: taskType !== 'one_time' && endDate ? endDate : undefined,
      daysOfWeek: taskType === 'weekly' ? selectedDays : undefined,
      dayOfMonth: taskType === 'monthly' ? dayOfMonth : undefined,
      customInterval: taskType === 'custom' ? customInterval : undefined,
      customUnit: taskType === 'custom' ? customUnit : undefined,
    };

    setIsSubmitting(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['x-hoorvia-token'] = authToken;
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/hoorvia/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          task_name: taskName.trim(),
          instructions: instructions.trim(),
          task_type: taskType,
          schedule: scheduleConfig,
          priority,
          approval_mode: approvalMode,
          resources: {
            websiteUrl: websiteUrl.trim() || undefined,
            notes: taskNotes.trim() || undefined,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server responded with ${res.status}`);
      }

      setSuccessMessage('Task Created Successfully! Maryam has registered the schedule.');
      setTaskName('');
      setInstructions('');
      setWebsiteUrl('');
      setTaskNotes('');
      onTaskCreated();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col rounded-3xl border border-rose-900/30 bg-[#0a0409]/95 backdrop-blur-xl shadow-2xl overflow-hidden text-zinc-100">
      {/* Top Header */}
      <div className="shrink-0 px-6 py-4 border-b border-rose-900/25 bg-[#120610]/90 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-rose-400" />
            Create Task for Maryam
          </h2>
          <p className="text-xs text-rose-300/80 font-serif italic">
            Define one-time or recurring tasks. Maryam is your dedicated autonomous executor.
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigateToScheduled}
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800/40 text-rose-200 transition-colors flex items-center gap-1.5"
        >
          <span>View Scheduled Tasks</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Form Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Success Banner */}
        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-xs font-medium">{successMessage}</p>
            </div>
            <button
              onClick={onNavigateToScheduled}
              className="text-xs text-emerald-300 underline font-semibold hover:text-white"
            >
              Open Scheduled Tasks
            </button>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-rose-200 flex items-center gap-2.5 animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <p className="text-xs font-medium">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Task Identity */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-rose-200 mb-1.5">
                Task Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="e.g. Daily SEO Optimization, Weekly Security Audit, Build Landing Page"
                className="w-full px-4 py-3 rounded-2xl bg-black/40 border border-rose-900/40 focus:border-rose-500 focus:outline-none text-white text-sm placeholder-zinc-500 transition-colors shadow-inner"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-rose-200 mb-1.5">
                Task Instructions for Maryam <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={4}
                placeholder="Describe exactly what Maryam must do. Example: Review website SEO, check metadata tags, inspect sitemap and robots.txt, identify technical indexing issues, and compile today's SEO report..."
                className="w-full px-4 py-3 rounded-2xl bg-black/40 border border-rose-900/40 focus:border-rose-500 focus:outline-none text-white text-sm placeholder-zinc-500 transition-colors shadow-inner resize-y min-h-[100px]"
                required
              />
            </div>
          </div>

          {/* Section 2: Task Type (Recurrence) */}
          <div className="space-y-3 pt-2 border-t border-rose-900/20">
            <label className="block text-xs font-semibold uppercase tracking-wider text-rose-200">
              Task Type & Recurrence
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: 'one_time', label: 'One-Time', desc: 'Runs once' },
                { id: 'daily', label: 'Daily', desc: 'Every day' },
                { id: 'weekly', label: 'Weekly', desc: 'Specific days' },
                { id: 'monthly', label: 'Monthly', desc: 'Day of month' },
                { id: 'custom', label: 'Custom', desc: 'Custom interval' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTaskType(t.id as TaskType)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    taskType === t.id
                      ? 'bg-rose-950/80 border-rose-500 text-white shadow-md shadow-rose-950/50'
                      : 'bg-black/30 border-white/10 text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                >
                  <p className="text-xs font-bold text-rose-100">{t.label}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Recurrence Configuration Fields */}
          <div className="p-4 rounded-2xl bg-black/30 border border-rose-900/30 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-rose-300/80 mb-1">
                  Start Date
                </label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/50 border border-rose-900/40 text-xs text-white">
                  <Calendar className="w-4 h-4 text-rose-400" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent focus:outline-none w-full text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-rose-300/80 mb-1">
                  Run Time
                </label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/50 border border-rose-900/40 text-xs text-white">
                  <Clock className="w-4 h-4 text-rose-400" />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bg-transparent focus:outline-none w-full text-white"
                    required
                  />
                </div>
              </div>
            </div>

            {/* ONE-TIME Specific */}
            {taskType === 'one_time' && (
              <div>
                <label className="block text-[11px] font-medium text-rose-300/80 mb-1">
                  Optional Deadline
                </label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/50 border border-rose-900/40 text-xs text-white">
                  <Calendar className="w-4 h-4 text-zinc-400" />
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="bg-transparent focus:outline-none w-full text-white"
                  />
                </div>
              </div>
            )}

            {/* WEEKLY Specific */}
            {taskType === 'weekly' && (
              <div>
                <label className="block text-[11px] font-medium text-rose-300/80 mb-2">
                  Select Days of Week
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((d) => {
                    const isSelected = selectedDays.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDay(d.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-900/40'
                            : 'bg-black/40 border border-white/10 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* MONTHLY Specific */}
            {taskType === 'monthly' && (
              <div>
                <label className="block text-[11px] font-medium text-rose-300/80 mb-1">
                  Day of Month (1 - 31)
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  className="w-32 px-3 py-2 rounded-xl bg-black/50 border border-rose-900/40 text-xs text-white focus:outline-none"
                />
              </div>
            )}

            {/* CUSTOM Specific */}
            {taskType === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-rose-300/80 mb-1">
                    Repeat Every
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={customInterval}
                    onChange={(e) => setCustomInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-rose-900/40 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-rose-300/80 mb-1">
                    Interval Unit
                  </label>
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as 'days' | 'weeks')}
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-rose-900/40 text-xs text-white focus:outline-none"
                  >
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                  </select>
                </div>
              </div>
            )}

            {/* Optional End Date for Recurring */}
            {taskType !== 'one_time' && (
              <div>
                <label className="block text-[11px] font-medium text-rose-300/80 mb-1">
                  Optional Recurrence End Date
                </label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/50 border border-rose-900/40 text-xs text-white">
                  <Calendar className="w-4 h-4 text-zinc-400" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent focus:outline-none w-full text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Priority & Approval Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-rose-900/20">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-rose-200 mb-2">
                Priority
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'normal', label: 'Normal', color: 'text-zinc-300' },
                  { id: 'high', label: 'High', color: 'text-amber-300' },
                  { id: 'critical', label: 'Critical', color: 'text-rose-400' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id as TaskPriority)}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all border ${
                      priority === p.id
                        ? 'bg-rose-950 border-rose-500 text-white shadow-md'
                        : 'bg-black/30 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className={p.color}>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-rose-200 mb-2">
                Approval Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'automatic', label: 'Automatic' },
                  { id: 'ask_owner', label: 'Ask Owner First' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setApprovalMode(m.id as TaskApprovalMode)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition-all border ${
                      approvalMode === m.id
                        ? 'bg-rose-950 border-rose-500 text-white shadow-md'
                        : 'bg-black/30 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/20 flex items-start gap-2 text-[11px] text-rose-300/80">
            <Shield className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>
              Security Boundary: Financial actions, sensitive credentials, and destructive operations will strictly follow existing owner approval requirements.
            </span>
          </div>

          {/* Section 5: Optional Resources */}
          <div className="space-y-3 pt-2 border-t border-rose-900/20">
            <label className="block text-xs font-semibold uppercase tracking-wider text-rose-200">
              Optional Target Resources
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-rose-300/80 mb-1 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-rose-400" /> Website / Target URL
                </label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-rose-900/40 text-xs text-white focus:outline-none placeholder-zinc-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-rose-300/80 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-rose-400" /> Reference Notes
                </label>
                <input
                  type="text"
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  placeholder="Additional context or key constraints"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-rose-900/40 text-xs text-white focus:outline-none placeholder-zinc-600"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-rose-900/20 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-rose-800 to-[#7b183e] hover:from-rose-700 hover:to-[#97204d] text-white shadow-lg shadow-black/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-rose-200" />
              <span>{isSubmitting ? 'Creating Task...' : 'CREATE TASK'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
