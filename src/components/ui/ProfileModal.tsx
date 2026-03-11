'use client';

import { useEffect, useState } from 'react';
import type { Agent, AgentMemory, AgentRelationship, MoltbookPost } from '@/types';
import SpriteAvatar from './SpriteAvatar';
import { MOLTBOOK_PROFILES } from '@/lib/config';

interface Detail {
  agent: Agent;
  memories: AgentMemory[];
  relationships: AgentRelationship[];
  posts: MoltbookPost[];
}

interface Props {
  agentId: string | null;
  agents: Agent[];
  onClose: () => void;
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[#7a6b55] w-14 font-semibold">{label}</span>
      <div className="flex-1 h-2 bg-[#3a3020] rounded-full overflow-hidden border border-[#5a4a30]">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] text-[#8a7b65] w-6 text-right font-mono">{value}</span>
    </div>
  );
}

export default function ProfileModal({ agentId, agents, onClose }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agentId) { setDetail(null); return; }
    setLoading(true);
    fetch(`/api/agents/${agentId}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [agentId]);

  if (!agentId) return null;

  if (loading || !detail) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center" onClick={onClose}>
        <div className="w-10 h-10 border-3 border-[#c4a46c]/30 border-t-[#c4a46c] rounded-full animate-spin" />
      </div>
    );
  }

  const { agent, memories, relationships, posts } = detail;
  const names = Object.fromEntries(agents.map(a => [a.id, a.name]));

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#1a1408] border-2 border-[#5a4a30] rounded-lg max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with sprite portrait */}
        <div className="bg-gradient-to-b from-[#2a1f10] to-[#1a1408] p-4 border-b border-[#5a4a30] relative">
          <button onClick={onClose} className="absolute top-3 right-3 text-[#7a6b55] hover:text-[#c4a46c] text-lg font-bold w-7 h-7 flex items-center justify-center rounded hover:bg-[#2a2015]">
            x
          </button>
          <div className="flex items-start gap-4">
            {/* Sprite avatar frame */}
            <SpriteAvatar spriteKey={agent.sprite_key} size={56} className="border-2 border-[#6b4226]" />
            <div className="min-w-0">
              <h3 className="pixel-font text-[12px] text-[#f5e6c8] leading-tight">{agent.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] px-2 py-0.5 bg-[#6b4226]/30 text-[#c4a46c] rounded-full font-semibold border border-[#6b4226]/50">
                  {agent.job}
                </span>
                <span className="text-[10px] text-[#7a6b55]">@ {agent.current_location_id}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="pixel-font text-[10px] text-[#f5c842] glow-gold">{(agent.molt_balance || 0).toFixed(0)}</span>
                <span className="text-[9px] text-[#a08050] font-bold">GOLD</span>
                <span className="text-[9px] text-[#5a4a30]">mined</span>
              </div>
              {MOLTBOOK_PROFILES[agent.id] && (
                <a
                  href={`https://www.moltbook.com/u/${MOLTBOOK_PROFILES[agent.id]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-[#c4a46c] hover:text-[#f5e6c8] transition font-semibold"
                >
                  <span className="text-[12px]">&#x1f99e;</span> moltbook.com/{MOLTBOOK_PROFILES[agent.id]}
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Current state */}
          <div className="bg-[#251c0e] rounded-lg p-3 border border-[#3a2f1a]">
            <div className="text-[9px] text-[#7a6b55] uppercase tracking-wider mb-1 font-bold">Current Action</div>
            <div className="text-sm text-[#e8d5b0] font-semibold">{agent.current_action}</div>
            <div className="text-[11px] text-[#a89070] italic mt-2 border-l-2 border-[#6b4226]/40 pl-2">
              &ldquo;{agent.current_thought}&rdquo;
            </div>
          </div>

          {/* Meters */}
          <div className="space-y-1.5">
            <div className="text-[9px] text-[#7a6b55] uppercase tracking-wider font-bold">Vitals</div>
            <Meter label="Energy" value={agent.energy} color="bg-emerald-600" />
            <Meter label="Stress" value={agent.stress} color="bg-red-700" />
            <Meter label="Social" value={agent.social} color="bg-blue-600" />
            <Meter label="Happy" value={agent.happiness} color="bg-yellow-600" />
            <Meter label="Anger" value={agent.anger} color="bg-orange-600" />
            <Meter label="Rep" value={agent.reputation} color="bg-purple-600" />
          </div>

          {/* Traits + Goals */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[9px] text-[#7a6b55] uppercase tracking-wider mb-1 font-bold">Personality</div>
              <div className="flex flex-wrap gap-1">
                {(agent.traits || []).map((t, i) => (
                  <span key={i} className="text-[10px] bg-[#2a1f10] text-[#c4a46c] px-1.5 py-0.5 rounded border border-[#5a4a30]">{t}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-[#7a6b55] uppercase tracking-wider mb-1 font-bold">Goals</div>
              {(agent.goals || []).slice(0, 3).map((g, i) => (
                <div key={i} className="text-[10px] text-[#a89070]">{g}</div>
              ))}
            </div>
          </div>

          {/* Moltbook posts */}
          <div>
            <div className="text-[9px] text-[#7a6b55] uppercase tracking-wider mb-1 font-bold">Recent Moltbook Posts</div>
            <p className="text-[10px] text-[#5a4a30] italic mb-2">{agent.moltbook_persona}</p>
            {!posts.length ? (
              <p className="text-[10px] text-[#3a2f1a]">No posts yet</p>
            ) : (
              <div className="space-y-1.5">
                {posts.slice(0, 4).map(p => (
                  <div key={p.id} className="bg-[#251c0e] rounded p-2 text-[11px] text-[#c4a46c] border border-[#3a2f1a]">
                    {p.content}
                    <div className="text-[9px] text-[#5a4a30] mt-1">#{p.tick_id}{p.likes > 0 ? ` / ${p.likes} likes` : ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Relationships */}
          {relationships.length > 0 && (
            <div>
              <div className="text-[9px] text-[#7a6b55] uppercase tracking-wider mb-1 font-bold">Relationships</div>
              <div className="space-y-1">
                {relationships.map(r => (
                  <div key={r.id} className="flex items-center justify-between text-[11px] py-0.5">
                    <span className="text-[#c4a46c]">{names[r.target_agent_id] || r.target_agent_id}</span>
                    <div className="flex gap-2 text-[10px] font-mono">
                      <span className="text-emerald-500/70" title="Trust">T{r.trust}</span>
                      <span className="text-blue-400/70" title="Friendship">F{r.friendship}</span>
                      {r.rivalry > 0 && <span className="text-red-400/70" title="Rivalry">R{r.rivalry}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Memories */}
          {memories.length > 0 && (
            <div>
              <div className="text-[9px] text-[#7a6b55] uppercase tracking-wider mb-1 font-bold">Recent Memories</div>
              <div className="space-y-1">
                {memories.slice(0, 6).map(m => (
                  <div key={m.id} className="text-[10px] text-[#7a6b55] border-l border-[#5a4a30] pl-2">
                    <span className="text-[#5a4a30]">[{m.source}]</span> {m.content}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
