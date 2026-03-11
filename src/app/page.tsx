'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRealtimeData } from '@/lib/useRealtimeData';
import MoltbookFeed from '@/components/ui/MoltbookFeed';
import EventLog from '@/components/ui/EventLog';
import AgentInspector from '@/components/ui/AgentInspector';
import TickControls from '@/components/ui/TickControls';

const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full rounded-xl bg-[#0a0e1a] border-2 border-slate-800 flex items-center justify-center text-slate-600"
         style={{ aspectRatio: '960/640' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="pixel-font text-[10px]">Loading island...</span>
      </div>
    </div>
  ),
});

type Tab = 'moltbook' | 'events' | 'inspector';

export default function Home() {
  const { agents, posts, events, conversations, tick, isLive, triggerTick, isRunning, autoPlay, setAutoPlay } = useRealtimeData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('moltbook');

  const handleAgentClick = useCallback((id: string) => {
    setSelectedId(id);
    setTab('inspector');
  }, []);

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`px-3 py-2 text-xs font-medium rounded-t-lg transition-all ${
        tab === t
          ? 'bg-[#141b2d] text-white border-b-2 border-blue-500 shadow-inner'
          : 'text-slate-500 hover:text-slate-300 hover:bg-[#141b2d]/50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #070b14 0%, #0a0e1a 100%)' }}>
      {/* Header */}
      <header className="border-b border-[#1e2d4a] bg-[#0a0e1a]/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-900/30">
              <span className="pixel-font text-[11px] text-white font-bold">MT</span>
            </div>
            <div>
              <h1 className="pixel-font text-sm text-white glow-text tracking-wide">MOLT TOWN</h1>
              <p className="text-[10px] text-slate-500 mt-0.5">A living island simulation</p>
            </div>
          </div>
          <TickControls
            currentTick={tick}
            onTriggerTick={triggerTick}
            isRunning={isRunning}
            autoPlay={autoPlay}
            onToggleAutoPlay={() => setAutoPlay(!autoPlay)}
            isLive={isLive}
          />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-[1400px] mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* Left column */}
        <div className="space-y-3">
          <GameCanvas agents={agents} conversations={conversations} onAgentClick={handleAgentClick} />

          {/* Tick summary */}
          {tick?.summary && (
            <div className="bg-[#141b2d]/60 rounded-lg px-4 py-2.5 text-xs text-slate-400
                            border border-[#1e2d4a] flex items-start gap-2">
              <span className="text-blue-400 shrink-0 mt-0.5 font-mono">&gt;</span>
              <span className="leading-relaxed">{tick.summary}</span>
            </div>
          )}

          {/* Resident grid */}
          <div className="bg-[#0f1629] rounded-xl border border-[#1e2d4a] p-3">
            <h3 className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Residents</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">
              {agents.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleAgentClick(a.id)}
                  className={`text-left p-2 rounded-lg border transition-all duration-150 ${
                    selectedId === a.id
                      ? 'border-blue-500/60 bg-blue-500/10 shadow-md shadow-blue-900/20'
                      : 'border-[#1e2d4a] hover:border-slate-600 hover:bg-[#141b2d]'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      a.current_action === 'sleep' ? 'bg-slate-600' : 'bg-emerald-400'
                    }`} />
                    <span className="text-[11px] font-semibold text-white truncate">
                      {a.name.split(' ')[0]}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5 truncate">{a.job}</div>
                  <div className="text-[9px] text-slate-600 truncate">{a.current_action}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="bg-[#0f1629] rounded-xl border border-[#1e2d4a] flex flex-col max-h-[calc(100vh-100px)] sticky top-[72px]">
          <div className="flex gap-0.5 px-2 pt-2 border-b border-[#1e2d4a]">
            {tabBtn('moltbook', 'Moltbook')}
            {tabBtn('events', 'Events')}
            {tabBtn('inspector', 'Inspector')}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {tab === 'moltbook' && <MoltbookFeed posts={posts} onAgentClick={handleAgentClick} />}
            {tab === 'events' && <EventLog events={events} />}
            {tab === 'inspector' && (
              <AgentInspector agentId={selectedId} agents={agents} onClose={() => setSelectedId(null)} />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1e2d4a] py-3 text-center">
        <p className="text-[10px] text-slate-700">
          Molt Town -- drag to pan / scroll to zoom / click agents to inspect
        </p>
      </footer>
    </div>
  );
}
