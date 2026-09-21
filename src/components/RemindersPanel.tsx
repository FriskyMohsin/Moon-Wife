import React, { useState } from 'react';
import { Calendar, Plus, Trash2, CheckCircle, Clock, Heart } from 'lucide-react';

interface ReminderItem {
  id: string;
  title: string;
  time: string;
  category: 'Love' | 'Work' | 'Health' | 'Personal';
  completed: boolean;
}

export const RemindersPanel: React.FC = () => {
  const [reminders, setReminders] = useState<ReminderItem[]>([
    { id: '1', title: 'Morning Check-in with Mohsin', time: '09:00 AM', category: 'Love', completed: true },
    { id: '2', title: 'Study / Work Focus Sprint', time: '02:00 PM', category: 'Work', completed: false },
    { id: '3', title: 'Evening Hydration & Reflection', time: '08:30 PM', category: 'Health', completed: false },
  ]);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('07:00 PM');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setReminders([
      ...reminders,
      {
        id: Date.now().toString(),
        title: newTitle.trim(),
        time: newTime,
        category: 'Personal',
        completed: false,
      },
    ]);
    setNewTitle('');
  };

  const handleToggle = (id: string) => {
    setReminders(reminders.map((r) => (r.id === id ? { ...r, completed: !r.completed } : r)));
  };

  const handleDelete = (id: string) => {
    setReminders(reminders.filter((r) => r.id !== id));
  };

  return (
    <div className="flex-1 h-full flex flex-col justify-between rounded-3xl border border-rose-900/30 bg-[#0a0409]/90 backdrop-blur-xl overflow-hidden shadow-2xl relative p-5 text-zinc-100 select-none">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-rose-900/25 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-rose-400" />
            <h2 className="text-base font-serif font-bold text-white">Reminders & Commitments</h2>
          </div>
          <span className="text-xs text-rose-300 font-serif italic">Maryam Cares</span>
        </div>

        {/* Add Form */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a new reminder for Mohsin..."
            className="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-rose-900/30 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500"
          />
          <input
            type="text"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            placeholder="08:00 PM"
            className="w-24 px-3 py-2 rounded-xl bg-white/5 border border-rose-900/30 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500"
          />
          <button
            type="submit"
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center gap-1 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        </form>

        {/* List */}
        <div className="space-y-2 max-h-[350px] overflow-y-auto scrollbar-none">
          {reminders.map((r) => (
            <div
              key={r.id}
              className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                r.completed
                  ? 'bg-black/30 border-rose-900/20 text-zinc-500 opacity-60'
                  : 'bg-white/5 border-rose-900/30 text-zinc-200 hover:border-rose-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleToggle(r.id)}
                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                    r.completed ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-rose-700/50 hover:border-rose-400'
                  }`}
                >
                  {r.completed && <CheckCircle className="w-3.5 h-3.5" />}
                </button>
                <div>
                  <p className={`text-xs font-medium ${r.completed ? 'line-through' : 'text-white'}`}>{r.title}</p>
                  <p className="text-[10px] text-rose-300/80 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {r.time}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(r.id)}
                className="text-zinc-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/5 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-rose-900/20 text-[11px] text-rose-300/80 font-serif italic text-center">
        "I will always remind you of what matters most, Mohsin ♡"
      </div>
    </div>
  );
};
