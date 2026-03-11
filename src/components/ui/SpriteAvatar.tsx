'use client';

import { AGENT_SPRITE_MAP, NPC_SPRITE_CONFIG, NPC_FRAME_SIZE } from '@/lib/config';

interface Props {
  spriteKey: string;   // e.g. 'npc_farmer'
  size?: number;       // display size in px (default 24)
  className?: string;
}

/**
 * Renders a single frame (first idle-down frame) from a sprite sheet
 * using CSS background-image + background-size + background-position.
 */
export default function SpriteAvatar({ spriteKey, size = 24, className = '' }: Props) {
  const sheetName = AGENT_SPRITE_MAP[spriteKey] || 'Farmer_Bob';
  const cfg = NPC_SPRITE_CONFIG[sheetName];

  if (!cfg) {
    // Fallback: colored initial
    return (
      <div
        className={`rounded bg-[#251c0e] border border-[#5a4a30] flex items-center justify-center shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-[9px] font-bold text-[#c4a46c]">?</span>
      </div>
    );
  }

  const frameSize = cfg.frameSize || NPC_FRAME_SIZE;
  const cols = cfg.cols;
  const rows = 6; // all sheets have 6 rows

  // Sheet total dimensions
  const sheetW = cols * frameSize;
  const sheetH = rows * frameSize;

  // Scale factor: how much to scale the sheet so one frame = `size` px
  const scale = size / frameSize;

  // background-size scales the whole sheet
  const bgW = sheetW * scale;
  const bgH = sheetH * scale;

  // First frame is at (0, 0) — no offset needed
  return (
    <div
      className={`rounded bg-[#251c0e] border border-[#5a4a30] overflow-hidden shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(/sprites/npcs/${cfg.file}.png)`,
        backgroundSize: `${bgW}px ${bgH}px`,
        backgroundPosition: '0px 0px',
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
      }}
    />
  );
}
