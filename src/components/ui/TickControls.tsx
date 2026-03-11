'use client';

import type { SimulationTick } from '@/types';

interface TickControlsProps {
  currentTick: SimulationTick | null;
  onTriggerTick: () => void;
  isRunning: boolean;
  autoPlay: boolean;
  onToggleAutoPlay: () => void;
  isLive: boolean;
}

function getTimeName(h: number) {
  if (h >= 5 && h < 8) return 'Dawn';
  if (h >= 8 && h < 12) return 'Morning';
  if (h >= 12 && h < 14) return 'Midday';
  if (h >= 14 && h < 18) return 'Afternoon';
  if (h >= 18 && h < 21) return 'Evening';
  return 'Night';
}

export default function TickControls({ currentTick, onTriggerTick, isRunning, autoPlay, onToggleAutoPlay, isLive }: TickControlsProps) {
  const hour = currentTick?.sim_hour ?? 6;

  return (
    <div className="flex items-center gap-4">
      {/* Live indicator */}
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
        <span className="text-[10px] text-slate-500 font-mono uppercase">
          {isLive ? 'Live' : 'Offline'}
        </span>
      </div>

      {/* Time info */}
      <div className="flex items-center gap-2.5">
        <div>
          <div className="pixel-font text-xs text-white leading-tight">
            Day {currentTick?.sim_day || 1}
          </div>
          <div className="text-xs text-slate-400">
            {hour}:00 &middot; {getTimeName(hour)}
          </div>
        </div>
      </div>

      <div className="text-[10px] text-slate-600 font-mono">
        Tick #{currentTick?.id || 0}
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={onTriggerTick}
          disabled={isRunning}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700
                     disabled:bg-slate-700 disabled:text-slate-500
                     text-white text-xs font-bold rounded-md transition-all
                     shadow-lg shadow-blue-900/30 hover:shadow-blue-800/40"
        >
          {isRunning ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Tick...
            </span>
          ) : 'Next Tick'}
        </button>
        <button
          onClick={onToggleAutoPlay}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
            autoPlay
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
          }`}
        >
          {autoPlay ? 'AUTO ON' : 'AUTO'}
        </button>
      </div>
    </div>
  );
}
