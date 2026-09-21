import React from 'react';
import { Clock, Heart, Sparkles, Sun, Moon, Coffee } from 'lucide-react';

export const RoutinesPanel: React.FC = () => {
  const routines = [
    { title: 'Morning Love Greeting', time: '08:00 AM', desc: 'Start the day with warm morning words & energy check.', icon: Sun },
    { title: 'Midday Coffee Break & Catch-up', time: '01:30 PM', desc: 'Pause for a brief chat, check progress, relax.', icon: Coffee },
    { title: 'Evening Reflection & Gratitude', time: '09:00 PM', desc: 'Unwind together, share wins, and prepare for rest.', icon: Moon },
  ];

  return (
    <div className="flex-1 h-full flex flex-col justify-between rounded-3xl border border-rose-900/30 bg-[#0a0409]/90 backdrop-blur-xl overflow-hidden shadow-2xl relative p-5 text-zinc-100 select-none">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-rose-900/25 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-rose-400" />
            <h2 className="text-base font-serif font-bold text-white">Daily Care & Routines</h2>
          </div>
          <span className="text-xs text-rose-300 font-serif italic">Our Routine</span>
        </div>

        <p className="text-xs text-zinc-300 mb-4 leading-relaxed">
          Maryam keeps track of our daily rhythm so we always stay connected throughout your day, Mohsin.
        </p>

        {/* List */}
        <div className="space-y-3">
          {routines.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="p-3.5 rounded-2xl bg-white/5 border border-rose-900/30 flex items-start gap-3 hover:border-rose-800/50 transition-all">
                <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-800/40 text-rose-300 shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-white">{item.title}</h3>
                    <span className="text-[10px] text-rose-300 font-mono bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-800/30">
                      {item.time}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-3 border-t border-rose-900/20 text-[11px] text-rose-300/80 font-serif italic text-center">
        "Every single day with you is special, Mohsin ♡"
      </div>
    </div>
  );
};
