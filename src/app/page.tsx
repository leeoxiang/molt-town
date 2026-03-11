'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRealtimeData } from '@/lib/useRealtimeData';
import MoltbookFeed from '@/components/ui/MoltbookFeed';
import EventLog from '@/components/ui/EventLog';
import AgentInspector from '@/components/ui/AgentInspector';

const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#080c16] flex items-center justify-center text-slate-600">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="pixel-font text-[9px]">Loading island...</span>
      </div>
    </div>
  ),
});

type RightTab = 'moltbook' | 'inspector';

export default function Home() {
  const { agents, posts, events, conversations, tick, isLive, triggerTick, isRunning, autoPlay, setAutoPlay } = useRealtimeData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('moltbook');
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const handleAgentClick = useCallback((id: string) => {
    setSelectedId(id);
    setRightTab('inspector');
    setRightOpen(true);
  }, []);

  const hour = tick?.sim_hour ?? 6;
  const timeName = hour >= 5 && hour < 8 ? 'Dawn' : hour >= 8 && hour < 12 ? 'Morning' : hour >= 12 && hour < 14 ? 'Midday' : hour >= 14 && hour < 18 ? 'Afternoon' : hour >= 18 && hour < 21 ? 'Evening' : 'Night';

  const totalMolt = useMemo(() => agents.reduce((s, a) => s + (a.molt_balance || 0), 0), [agents]);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #060a12 0%, #080c16 100%)' }}>
      {/* Navbar */}
      <header className="h-11 shrink-0 border-b border-[#1a2540] bg-[#0a0f1c]/95 backdrop-blur-sm flex items-center px-3 gap-3 z-50">
        <div className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded bg-gradient-to-br from-blue-500/80 to-indigo-600/80 flex items-center justify-center shadow-lg">
            <span className="pixel-font text-[7px] text-white font-bold">MT</span>
          </div>
          <div className="pixel-font text-[9px] text-white glow-text tracking-wider">MOLT TOWN</div>
        </div>

        <div className="h-4 w-px bg-[#1e2d4a]" />

        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-white font-semibold">Day {tick?.sim_day || 1}</span>
          <span className="text-slate-500">{hour}:00</span>
          <span className="text-slate-600">{timeName}</span>
          <span className="text-slate-700 font-mono">#{tick?.id || 0}</span>
        </div>

        <div className="h-4 w-px bg-[#1e2d4a]" />

        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="text-amber-400 font-bold glow-gold">{totalMolt.toFixed(0)}</span>
          <span className="text-amber-600 font-semibold">MOLT</span>
          <span className="text-slate-700">mined</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 mr-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-[9px] text-slate-500 font-mono uppercase">{isLive ? 'Live' : 'Offline'}</span>
        </div>

        <button
          onClick={triggerTick}
          disabled={isRunning}
          className="btn-pixel bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white shadow-md"
        >
          {isRunning ? 'Tick...' : 'Next Tick'}
        </button>
        <button
          onClick={() => setAutoPlay(!autoPlay)}
          className={`btn-pixel ${autoPlay ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
        >
          {autoPlay ? 'Auto On' : 'Auto'}
        </button>
      </header>

      {/* Main body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        <div className={`shrink-0 transition-all duration-200 flex flex-col border-r border-[#1a2540] bg-[#0a0f1c]/80 ${leftOpen ? 'w-[260px]' : 'w-8'}`}>
          {leftOpen ? (
            <>
              <div className="shrink-0 border-b border-[#1a2540]">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Residents</span>
                  <button onClick={() => setLeftOpen(false)} className="text-slate-700 hover:text-slate-400 text-[10px] px-1">&lt;</button>
                </div>
                <div className="px-2 pb-2 space-y-0.5 max-h-[280px] overflow-y-auto">
                  {agents.map(a => (
                    <button
                      key={a.id}
                      onClick={() => handleAgentClick(a.id)}
                      className={`w-full text-left px-2 py-1.5 rounded transition-all text-[10px] ${
                        selectedId === a.id
                          ? 'bg-blue-500/10 border border-blue-500/40'
                          : 'hover:bg-[#111827] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.current_action === 'sleep' ? 'bg-slate-600' : 'bg-emerald-400'}`} />
                        <span className="font-semibold text-white truncate">{a.name.split(' ')[0]}</span>
                        <span className="text-amber-500/70 ml-auto font-mono">{(a.molt_balance || 0).toFixed(0)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 pl-3.5">
                        <span className="text-slate-500 truncate">{a.job}</span>
                        <span className="text-slate-700 truncate ml-auto">{a.current_action}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <div className="px-3 py-2">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Events</span>
                </div>
                <div className="flex-1 overflow-y-auto px-1">
                  <EventLog events={events} />
                </div>
              </div>
            </>
          ) : (
            <button onClick={() => setLeftOpen(true)} className="flex-1 flex items-center justify-center text-slate-700 hover:text-slate-400 text-xs">
              &gt;
            </button>
          )}
        </div>

        {/* Center — Map */}
        <div className="flex-1 relative overflow-hidden bg-[#060a12]">
          <GameCanvas agents={agents} conversations={conversations} onAgentClick={handleAgentClick} />

          {tick?.summary && (
            <div className="absolute bottom-3 left-3 right-3 bg-[#0a0f1c]/90 backdrop-blur-sm rounded-lg px-3 py-2 text-[10px] text-slate-400 border border-[#1a2540] flex items-start gap-2 pointer-events-none">
              <span className="text-blue-400 shrink-0 font-mono">&gt;</span>
              <span className="leading-relaxed">{tick.summary}</span>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className={`shrink-0 transition-all duration-200 flex flex-col border-l border-[#1a2540] bg-[#0a0f1c]/80 ${rightOpen ? 'w-[320px]' : 'w-8'}`}>
          {rightOpen ? (
            <>
              <div className="flex items-center gap-1 px-2 pt-2 pb-0 border-b border-[#1a2540]">
                <button
                  onClick={() => setRightTab('moltbook')}
                  className={`px-3 py-1.5 text-[10px] font-semibold rounded-t transition-all ${
                    rightTab === 'moltbook' ? 'bg-[#111827] text-white border-b-2 border-blue-500' : 'text-slate-600 hover:text-slate-400'
                  }`}
                >Moltbook</button>
                <button
                  onClick={() => setRightTab('inspector')}
                  className={`px-3 py-1.5 text-[10px] font-semibold rounded-t transition-all ${
                    rightTab === 'inspector' ? 'bg-[#111827] text-white border-b-2 border-blue-500' : 'text-slate-600 hover:text-slate-400'
                  }`}
                >Inspector</button>
                <div className="flex-1" />
                <button onClick={() => setRightOpen(false)} className="text-slate-700 hover:text-slate-400 text-[10px] px-1">&gt;</button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {rightTab === 'moltbook' && <MoltbookFeed posts={posts} onAgentClick={handleAgentClick} />}
                {rightTab === 'inspector' && (
                  <AgentInspector agentId={selectedId} agents={agents} onClose={() => setSelectedId(null)} />
                )}
              </div>
            </>
          ) : (
            <button onClick={() => setRightOpen(true)} className="flex-1 flex items-center justify-center text-slate-700 hover:text-slate-400 text-xs">
              &lt;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
