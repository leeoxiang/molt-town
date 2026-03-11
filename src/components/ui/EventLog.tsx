'use client';

import type { WorldEvent } from '@/types';

const typeIcon: Record<string, string> = {
  movement: '>',
  interaction: '*',
  moltbook: '#',
  job: '+',
};

const typeColor: Record<string, string> = {
  movement: 'text-emerald-500/80',
  interaction: 'text-[#f5c842]/80',
  moltbook: 'text-[#c4a46c]/80',
  job: 'text-orange-400/80',
};

export default function EventLog({ events }: { events: WorldEvent[] }) {
  if (!events.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#5a4a30]">
        <p className="text-sm text-[#7a6b55]">No events yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5 font-mono text-[11px]">
      {events.map((e) => (
        <div key={e.id} className="flex gap-2 py-1.5 px-2 rounded hover:bg-[#1a1408] transition-colors">
          <span className="text-[#5a4a30] font-bold shrink-0">{typeIcon[e.event_type] || '~'}</span>
          <span className={typeColor[e.event_type] || 'text-[#7a6b55]'}>
            {e.description}
          </span>
        </div>
      ))}
    </div>
  );
}
