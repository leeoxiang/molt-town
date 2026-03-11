'use client';

import { useEffect, useState } from 'react';
import type { Agent, AgentMemory, AgentRelationship, MoltbookPost } from '@/types';

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
      <span className="text-[10px] text-slate-500 w-14">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] text-slate-600 w-6 text-right font-mono">{value}</span>
    </div>
  );
}

export default function AgentInspector({ agentId, agents, onClose }: Props) {
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

  if (!agentId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <div className="w-10 h-10 rounded-full border-2 border-slate-700 flex items-center justify-center text-slate-600 text-sm font-mono mb-3">?</div>
        <p className="text-sm">Click an agent to inspect</p>
        <p className="text-xs text-slate-600 mt-1">See their thoughts, memories, and posts</p>
      </div>
    );
  }

  if (loading || !detail) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const { agent, memories, relationships, posts } = detail;
  const names = Object.fromEntries(agents.map(a => [a.id, a.name]));

  return (
    <div className="space-y-4 text-sm">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-white glow-text">{agent.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs px-2 py-0.5 bg-blue-500/15 text-blue-400 rounded-full font-medium">
              {agent.job}
            </span>
            <span className="text-[10px] text-slate-500">@ {agent.current_location_id}</span>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-600 hover:text-white text-sm px-2 py-1 rounded hover:bg-slate-800 transition">
          x
        </button>
      </div>

      {/* Current state */}
      <div className="bg-[#0f1629] rounded-lg p-3 border border-[#1e2d4a]">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Current Action</div>
        <div className="text-sm text-white">{agent.current_action}</div>
        <div className="text-[12px] text-slate-400 italic mt-2 border-l-2 border-blue-500/40 pl-2">
          &ldquo;{agent.current_thought}&rdquo;
        </div>
      </div>

      {/* Meters */}
      <div className="space-y-1.5">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">State</div>
        <Meter label="Energy" value={agent.energy} color="bg-emerald-500" />
        <Meter label="Stress" value={agent.stress} color="bg-red-500" />
        <Meter label="Social" value={agent.social} color="bg-blue-500" />
        <Meter label="Happy" value={agent.happiness} color="bg-yellow-500" />
        <Meter label="Anger" value={agent.anger} color="bg-orange-500" />
        <Meter label="Rep" value={agent.reputation} color="bg-purple-500" />
      </div>

      {/* Traits + Goals */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Traits</div>
          <div className="flex flex-wrap gap-1">
            {(agent.traits || []).map((t, i) => (
              <span key={i} className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{t}</span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Goals</div>
          {(agent.goals || []).slice(0, 3).map((g, i) => (
            <div key={i} className="text-[10px] text-slate-400">{g}</div>
          ))}
        </div>
      </div>

      {/* Moltbook */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Moltbook</div>
        <p className="text-[10px] text-slate-500 italic mb-2">{agent.moltbook_persona}</p>
        {!posts.length ? (
          <p className="text-[10px] text-slate-700">No posts yet</p>
        ) : (
          <div className="space-y-1.5">
            {posts.slice(0, 4).map(p => (
              <div key={p.id} className="bg-[#0f1629] rounded p-2 text-[11px] text-slate-300 border border-[#1e2d4a]">
                {p.content}
                <div className="text-[9px] text-slate-600 mt-1">#{p.tick_id}{p.likes > 0 ? ` / ${p.likes} likes` : ''}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Relationships */}
      {relationships.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Relationships</div>
          <div className="space-y-1">
            {relationships.map(r => (
              <div key={r.id} className="flex items-center justify-between text-[11px] py-0.5">
                <span className="text-slate-300">{names[r.target_agent_id] || r.target_agent_id}</span>
                <div className="flex gap-2 text-[10px] font-mono">
                  <span className="text-emerald-400/60" title="Trust">T{r.trust}</span>
                  <span className="text-blue-400/60" title="Friendship">F{r.friendship}</span>
                  {r.rivalry > 0 && <span className="text-red-400/60" title="Rivalry">R{r.rivalry}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Memories */}
      {memories.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Recent Memories</div>
          <div className="space-y-1">
            {memories.slice(0, 6).map(m => (
              <div key={m.id} className="text-[10px] text-slate-500 border-l border-slate-700 pl-2">
                <span className="text-slate-600">[{m.source}]</span> {m.content}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
