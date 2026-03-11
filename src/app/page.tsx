'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRealtimeData } from '@/lib/useRealtimeData';
import MoltbookFeed from '@/components/ui/MoltbookFeed';
import EventLog from '@/components/ui/EventLog';
import MiningLog from '@/components/ui/MiningLog';
import ProfileModal from '@/components/ui/ProfileModal';
import JoinModal from '@/components/ui/JoinModal';

const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#0e0a04] flex items-center justify-center text-[#5a4a30]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#6b4226]/30 border-t-[#c4a46c] rounded-full animate-spin" />
        <span className="pixel-font text-[9px] text-[#7a6b55]">Loading island...</span>
      </div>
    </div>
  ),
});

type RightTab = 'moltbook' | 'mining';

export default function Home() {
  const { agents, posts, events, conversations, rewards, tick, isLive } = useRealtimeData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('moltbook');
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const handleAgentClick = useCallback((id: string) => {
    setSelectedId(id);
    setShowProfile(true);
  }, []);

  const hour = tick?.sim_hour ?? 6;
  const timeName = hour >= 5 && hour < 8 ? 'Dawn' : hour >= 8 && hour < 12 ? 'Morning' : hour >= 12 && hour < 14 ? 'Midday' : hour >= 14 && hour < 18 ? 'Afternoon' : hour >= 18 && hour < 21 ? 'Evening' : 'Night';

  const totalMolt = useMemo(() => agents.reduce((s, a) => s + (a.molt_balance || 0), 0), [agents]);

  // Sort agents by balance for leaderboard feel
  const sortedAgents = useMemo(() => [...agents].sort((a, b) => (b.molt_balance || 0) - (a.molt_balance || 0)), [agents]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0e0a04]">
      {/* Navbar — medieval parchment style */}
      <header className="h-11 shrink-0 border-b-2 border-[#3a2f1a] bg-gradient-to-r from-[#1a1408] via-[#201810] to-[#1a1408] flex items-center px-3 gap-3 z-50">
        <div className="flex items-center gap-2 mr-2">
          <img
            src="https://cdn.prod.website-files.com/69082c5061a39922df8ed3b6/69b1899b823bddde18226002_New%20Project%20-%202026-03-11T151626.214.png"
            alt="Molt Town"
            className="w-7 h-7 rounded"
            style={{ imageRendering: 'pixelated' }}
          />
          <div className="pixel-font text-[9px] text-[#f5e6c8] tracking-wider">MOLT TOWN</div>
        </div>

        <div className="h-4 w-px bg-[#3a2f1a]" />

        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-[#e8d5b0] font-semibold">Day {tick?.sim_day || 1}</span>
          <span className="text-[#7a6b55]">{hour}:00</span>
          <span className="text-[#5a4a30]">{timeName}</span>
        </div>

        <div className="h-4 w-px bg-[#3a2f1a]" />

        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="pixel-font text-[9px] text-[#f5c842] font-bold glow-gold">{totalMolt.toFixed(0)}</span>
          <span className="text-[#a08050] font-bold">MOLTTOWN</span>
          <span className="text-[#5a4a30]">mined</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 mr-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-[#5a4a30]'}`} />
          <span className="text-[9px] text-[#7a6b55] font-mono uppercase">{isLive ? 'Live' : 'Offline'}</span>
        </div>

        <div className="flex items-center gap-2 mr-2">
          {[
            { href: 'https://github.com/leeoxiang/molt-town', img: 'https://cdn.prod.website-files.com/69082c5061a39922df8ed3b6/6983ebadee1a5bb66150c566_69093cba0db485064d0267ca_68d5c1872568958fd78018bb_twitter%20(1).png', alt: 'GitHub' },
            { href: 'https://www.moltbook.com/u/agnes_fairwater', img: 'https://cdn.prod.website-files.com/69082c5061a39922df8ed3b6/6983eb56a711579651228581_moltbook.png', alt: 'Moltbook' },
            { href: 'https://medium.com', img: 'https://cdn.prod.website-files.com/69082c5061a39922df8ed3b6/6983eb56f1ca3d355dfdf898_medium.png', alt: 'Medium' },
            { href: 'https://pump.fun', img: 'https://cdn.prod.website-files.com/69082c5061a39922df8ed3b6/69093cbeb0e0ed83a682a1c1_68d5c1872568958fd78018bb_twitter%20(1).png', alt: 'PumpFun' },
            { href: 'https://twitter.com', img: 'https://cdn.prod.website-files.com/69082c5061a39922df8ed3b6/69093cba0db485064d0267ca_68d5c1872568958fd78018bb_twitter.png', alt: 'Twitter' },
          ].map(link => (
            <a key={link.alt} href={link.href} target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity">
              <img src={link.img} alt={link.alt} className="w-5 h-5 rounded" />
            </a>
          ))}
        </div>

        <button
          onClick={() => setShowJoin(true)}
          className="btn-pixel bg-gradient-to-r from-[#6b4226] to-[#8a5533] text-[#f5e6c8] hover:from-[#8a5533] hover:to-[#a06838] shadow-lg"
        >
          Join to Mine
        </button>
      </header>

      {/* Main body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — Residents + Events */}
        <div className={`shrink-0 transition-all duration-200 flex flex-col border-r-2 border-[#3a2f1a] bg-[#120e06]/90 ${leftOpen ? 'w-[260px]' : 'w-8'}`}>
          {leftOpen ? (
            <>
              <div className="shrink-0 border-b border-[#3a2f1a]">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-[9px] text-[#7a6b55] uppercase tracking-wider font-bold">Residents</span>
                  <button onClick={() => setLeftOpen(false)} className="text-[#5a4a30] hover:text-[#c4a46c] text-[10px] px-1">&lt;</button>
                </div>
                <div className="px-2 pb-2 space-y-0.5 max-h-[280px] overflow-y-auto">
                  {sortedAgents.map(a => (
                    <button
                      key={a.id}
                      onClick={() => handleAgentClick(a.id)}
                      className={`w-full text-left px-2 py-1.5 rounded transition-all text-[10px] ${
                        selectedId === a.id
                          ? 'bg-[#6b4226]/20 border border-[#6b4226]/50'
                          : 'hover:bg-[#1a1408] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.current_action === 'sleep' ? 'bg-[#5a4a30]' : 'bg-emerald-500'}`} />
                        <span className="font-semibold text-[#e8d5b0] truncate">{a.name.split(' ')[0]}</span>
                        <span className="pixel-font text-[8px] text-[#f5c842] ml-auto">{(a.molt_balance || 0).toFixed(0)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 pl-3.5">
                        <span className="text-[#7a6b55] truncate">{a.job}</span>
                        <span className="text-[#3a2f1a] truncate ml-auto">{a.current_action}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <div className="px-3 py-2">
                  <span className="text-[9px] text-[#7a6b55] uppercase tracking-wider font-bold">Events</span>
                </div>
                <div className="flex-1 overflow-y-auto px-1">
                  <EventLog events={events} />
                </div>
              </div>
            </>
          ) : (
            <button onClick={() => setLeftOpen(true)} className="flex-1 flex items-center justify-center text-[#5a4a30] hover:text-[#c4a46c] text-xs">
              &gt;
            </button>
          )}
        </div>

        {/* Center — Map */}
        <div className="flex-1 relative overflow-hidden bg-[#0e0a04]">
          <GameCanvas agents={agents} conversations={conversations} onAgentClick={handleAgentClick} />

          {tick?.summary && (
            <div className="absolute bottom-3 left-3 right-3 bg-[#1a1408]/90 backdrop-blur-sm rounded-lg px-3 py-2 text-[10px] text-[#a89070] border border-[#3a2f1a] flex items-start gap-2 pointer-events-none">
              <span className="text-[#c4a46c] shrink-0 font-mono">&gt;</span>
              <span className="leading-relaxed">{tick.summary}</span>
            </div>
          )}
        </div>

        {/* Right panel — Moltbook / Mining */}
        <div className={`shrink-0 transition-all duration-200 flex flex-col border-l-2 border-[#3a2f1a] bg-[#120e06]/90 ${rightOpen ? 'w-[320px]' : 'w-8'}`}>
          {rightOpen ? (
            <>
              <div className="flex items-center gap-1 px-2 pt-2 pb-0 border-b border-[#3a2f1a]">
                <button
                  onClick={() => setRightTab('moltbook')}
                  className={`px-3 py-1.5 text-[10px] font-semibold rounded-t transition-all ${
                    rightTab === 'moltbook' ? 'bg-[#1a1408] text-[#f5e6c8] border-b-2 border-[#c4a46c]' : 'text-[#5a4a30] hover:text-[#7a6b55]'
                  }`}
                >Moltbook</button>
                <button
                  onClick={() => setRightTab('mining')}
                  className={`px-3 py-1.5 text-[10px] font-semibold rounded-t transition-all ${
                    rightTab === 'mining' ? 'bg-[#1a1408] text-[#f5e6c8] border-b-2 border-[#f5c842]' : 'text-[#5a4a30] hover:text-[#7a6b55]'
                  }`}
                >Mining Log</button>
                <div className="flex-1" />
                <button onClick={() => setRightOpen(false)} className="text-[#5a4a30] hover:text-[#c4a46c] text-[10px] px-1">&gt;</button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {rightTab === 'moltbook' && <MoltbookFeed posts={posts} onAgentClick={handleAgentClick} />}
                {rightTab === 'mining' && <MiningLog rewards={rewards} agents={agents} />}
              </div>
            </>
          ) : (
            <button onClick={() => setRightOpen(true)} className="flex-1 flex items-center justify-center text-[#5a4a30] hover:text-[#c4a46c] text-xs">
              &lt;
            </button>
          )}
        </div>
      </div>

      {/* Profile Modal */}
      {showProfile && (
        <ProfileModal
          agentId={selectedId}
          agents={agents}
          onClose={() => { setShowProfile(false); setSelectedId(null); }}
        />
      )}

      {/* Join Modal */}
      {showJoin && (
        <JoinModal onClose={() => setShowJoin(false)} />
      )}
    </div>
  );
}
