// ── Island Map Layout ──
// 5x bigger: 200x150 tiles at 16px = 3200x2400
export const TILE_SIZE = 16;
export const MAP_COLS = 200;
export const MAP_ROWS = 150;
export const MAP_W = MAP_COLS * TILE_SIZE;
export const MAP_H = MAP_ROWS * TILE_SIZE;

// Viewport
export const VIEW_W = 960;
export const VIEW_H = 640;

// Locations spread across the large island
export const LOCATION_POSITIONS: Record<string, { x: number; y: number; label: string }> = {
  market:     { x: 1600, y: 1100, label: 'Market Square' },
  tavern:     { x: 1350, y: 1450, label: 'Salty Molt Tavern' },
  mayor:      { x: 1200, y: 700,  label: "Mayor's House" },
  farm:       { x: 2200, y: 850,  label: 'Windmill Farm' },
  smithy:     { x: 2100, y: 1350, label: 'Blacksmith' },
  docks:      { x: 650,  y: 1650, label: 'Docks' },
  beach:      { x: 500,  y: 1100, label: 'Sandy Beach' },
  lighthouse: { x: 2500, y: 1750, label: 'Lighthouse' },
};

// NPC sprite configs — frameSize defaults to 64 if omitted
export const NPC_SPRITE_CONFIG: Record<string, { file: string; cols: number; frameSize?: number }> = {
  Bartender_Bruno:  { file: 'Bartender_Bruno',  cols: 6 },
  Bartender_Katy:   { file: 'Bartender_Katy',   cols: 6 },
  Chef_Chloe:       { file: 'Chef_Chloe',       cols: 6 },
  Farmer_Bob:       { file: 'Farmer_Bob',        cols: 6 },
  Farmer_Buba:      { file: 'Farmer_Buba',       cols: 6 },
  Fisherman_Fin:    { file: 'Fisherman_Fin',     cols: 9 },
  Lumberjack_Jack:  { file: 'Lumberjack_Jack',   cols: 6 },
  Miner_Mike:       { file: 'Miner_Mike',        cols: 6 },
  Knight_Swordman:  { file: 'Knight_Swordman',   cols: 6, frameSize: 48 },
  Knight_Archer:    { file: 'Knight_Archer',      cols: 6, frameSize: 48 },
};

export const NPC_FRAME_SIZE = 64;

// Agent sprite_key → NPC sheet name (all 10 unique)
export const AGENT_SPRITE_MAP: Record<string, string> = {
  npc_farmer:       'Farmer_Bob',
  npc_fisher:       'Fisherman_Fin',
  npc_bartender:    'Bartender_Katy',
  npc_innkeeper:    'Bartender_Bruno',
  npc_blacksmith:   'Miner_Mike',
  npc_mayor:        'Chef_Chloe',
  npc_lighthouse:   'Farmer_Buba',
  npc_courier:      'Lumberjack_Jack',
  npc_merchant:     'Knight_Archer',
  npc_groundskeeper:'Knight_Swordman',
};

// Building at each location
export const LOCATION_BUILDINGS: Record<string, { key: string; scale: number; offsetY: number }> = {
  tavern:     { key: 'bld_inn',        scale: 1.0, offsetY: -50 },
  smithy:     { key: 'bld_blacksmith', scale: 1.0, offsetY: -35 },
  docks:      { key: 'bld_fisherman',  scale: 1.0, offsetY: -25 },
  farm:       { key: 'bld_windmill',   scale: 1.2, offsetY: -35 },
  market:     { key: 'bld_stalls',     scale: 1.5, offsetY: -10 },
  mayor:      { key: 'bld_stone',      scale: 1.2, offsetY: -40 },
  lighthouse: { key: 'bld_wood',       scale: 1.2, offsetY: -35 },
};

export const AGENT_SPEED = 0.55;

// Idle/wander behavior
export const IDLE_MIN_MS = 3000;   // min idle pause at destination
export const IDLE_MAX_MS = 8000;   // max idle pause
export const WANDER_RADIUS = 60;   // px radius for local wandering
export const WANDER_CHANCE = 0.35; // chance to wander after idle pause

export const MEMORY_WINDOW = 50;
export const HOURS_PER_DAY = 24;

// Agent ID → Moltbook.com username (for profile links in UI)
export const MOLTBOOK_PROFILES: Record<string, string> = {
  agnes: 'agnes_fairwater',
  finn: 'finn_saltbrook',
  bob: 'bob_greenfield',
  katy: 'katy_brewster',
  gus: 'gus_ironhand',
  mira: 'mira_coastwatcher',
  pip: 'pip_quickfoot',
  bruno: 'bruno_hearthstone',
  luna: 'luna_tidecaller',
  cedar: 'cedar_mossgrove',
};
