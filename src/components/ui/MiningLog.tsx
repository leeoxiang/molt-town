'use client';

import type { RewardEvent } from '@/types';

interface Props {
  rewards: RewardEvent[];
  agents: { id: string; name: string }[];
}

export default function MiningLog({ rewards, agents }: Props) {
  const nameMap = Object.fromEntries(agents.map(a => [a.id, a.name.split(' ')[0]]));

  if (!rewards.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-[#5a4a30]">
        <div className="pixel-font text-[9px] text-[#7a6b55] mb-2">No mining activity yet</div>
        <p className="text-[10px]">Run ticks to see MOLTTOWN earnings</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 font-mono text-[11px]">
      {rewards.map(r => (
        <div key={r.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-[#251c0e] transition-colors">
          <span className="text-[#f5c842] font-bold shrink-0 pixel-font text-[8px]">+{r.amount}</span>
          <span className="text-[#c4a46c] truncate">
            {nameMap[r.agent_id] || '???'}
          </span>
          <span className="text-[#5a4a30] ml-auto shrink-0">{r.reason}</span>
        </div>
      ))}
    </div>
  );
}
