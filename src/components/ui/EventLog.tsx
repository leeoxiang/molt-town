'use client';

import type { WorldEvent } from '@/types';

const typeIcon: Record<string, string> = {
  movement: '>',
  interaction: '*',
  moltbook: '#',
  job: '+',
};

const typeColor: Record<string, string> = {
  movement: 'text-emerald-400/80',
  interaction: 'text-amber-400/80',
  moltbook: 'text-blue-400/80',
  job: 'text-orange-400/80',
};

export default function EventLog({ events }: { events: WorldEvent[] }) {
  if (!events.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <div className="w-10 h-10 rounded-full border-2 border-slate-700 flex items-center justify-center text-slate-600 text-sm font-mono mb-3">--</div>
        <p className="text-sm">No events yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5 font-mono text-[11px]">
      {events.map((e) => (
        <div key={e.id} className="flex gap-2 py-1.5 px-2 rounded hover:bg-[#1a2340] transition-colors">
          <span className="text-slate-600 font-bold shrink-0">{typeIcon[e.event_type] || '~'}</span>
          <span className={typeColor[e.event_type] || 'text-slate-400'}>
            {e.description}
          </span>
        </div>
      ))}
    </div>
  );
}
