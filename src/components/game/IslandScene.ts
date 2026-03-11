import * as Phaser from 'phaser';
import {
  TILE_SIZE, MAP_COLS, MAP_ROWS, MAP_W, MAP_H,
  LOCATION_POSITIONS, NPC_SPRITE_CONFIG, NPC_FRAME_SIZE,
  AGENT_SPRITE_MAP, LOCATION_BUILDINGS, AGENT_SPEED,
  IDLE_MIN_MS, IDLE_MAX_MS, WANDER_RADIUS, WANDER_CHANCE,
} from '@/lib/config';
import type { Agent, Conversation, ConversationMessage } from '@/types';

declare global {
  // eslint-disable-next-line no-var
  var __molt: {
    onAgentClick?: (agentId: string) => void;
    updateAgents?: (agents: Agent[]) => void;
    showConversations?: (conversations: Conversation[]) => void;
    latestAgents?: Agent[];
    latestConversations?: Conversation[];
  };
}

const WATER = 0;
const BEACH = 1;
const GRASS = 2;
const PATH  = 3;
const FARM  = 4;
const DARK_GRASS = 5;

type AgentState = 'walking' | 'idle' | 'wandering' | 'talking';

interface AgentSprite {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  nameTag: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  bubble?: Phaser.GameObjects.Container;
  bubbleTimer?: Phaser.Time.TimerEvent;
  targetX: number;
  targetY: number;
  homeX: number;
  homeY: number;
  sheetName: string;
  state: AgentState;
  idleUntil: number;
  agentData: Agent;
  talkingTo?: string;
}

export default class IslandScene extends Phaser.Scene {
  private agentSprites: Map<string, AgentSprite> = new Map();
  private tileMap!: number[][];
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private seenConvoIds: Set<string> = new Set();

  constructor() {
    super({ key: 'IslandScene' });
  }

  preload() {
    this.load.image('tile_grass', '/sprites/tiles/Grass_Middle.png');
    this.load.image('tile_water', '/sprites/tiles/Water_Middle.png');
    this.load.image('tile_path',  '/sprites/tiles/Path_Middle.png');
    this.load.image('tile_farm',  '/sprites/tiles/FarmLand_Tile.png');

    this.load.image('bld_inn',        '/sprites/buildings/Inn_Blue.png');
    this.load.image('bld_blacksmith', '/sprites/buildings/Blacksmith_House_Blue.png');
    this.load.image('bld_fisherman',  '/sprites/buildings/Fisherman_House_Base_Blue.png');
    this.load.image('bld_windmill',   '/sprites/buildings/Windmill.png');
    this.load.image('bld_stalls',     '/sprites/buildings/Market_Stalls.png');
    this.load.image('bld_barn',       '/sprites/buildings/Barn_Base_Blue.png');
    this.load.image('bld_wood',       '/sprites/buildings/House_1_Wood_Base_Blue.png');
    this.load.image('bld_stone',      '/sprites/buildings/House_1_Stone_Base_Blue.png');

    this.load.image('tree',       '/sprites/decor/Oak_Tree.png');
    this.load.image('tree_small', '/sprites/decor/Oak_Tree_Small.png');
    this.load.image('boat',       '/sprites/decor/Boat.png');
    this.load.spritesheet('fountain', '/sprites/decor/Fountain.png', {
      frameWidth: 32, frameHeight: 40,
    });

    for (const [name, cfg] of Object.entries(NPC_SPRITE_CONFIG)) {
      const fs = cfg.frameSize || NPC_FRAME_SIZE;
      this.load.spritesheet(name, `/sprites/npcs/${cfg.file}.png`, {
        frameWidth: fs,
        frameHeight: fs,
      });
    }
  }

  create() {
    globalThis.__molt = globalThis.__molt || {};
    globalThis.__molt.updateAgents = (agents: Agent[]) => this.updateAgents(agents);
    globalThis.__molt.showConversations = (convos: Conversation[]) => this.showConversations(convos);

    this.tileMap = this.generateIslandMap();

    // Pick up any agent/conversation data that arrived before the scene was ready
    if (globalThis.__molt.latestAgents && globalThis.__molt.latestAgents.length > 0) {
      this.time.delayedCall(100, () => {
        if (globalThis.__molt.latestAgents) {
          this.updateAgents(globalThis.__molt.latestAgents);
        }
      });
    }

    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.setZoom(1);
    const market = LOCATION_POSITIONS.market;
    this.cameras.main.centerOn(market.x, market.y);

    this.renderTileMap();
    this.placeBuildings();
    this.placeTrees();
    this.placeDecoration();
    this.placeLocationLabels();
    this.createNpcAnimations();

    if (this.textures.exists('fountain')) {
      this.anims.create({
        key: 'fountain_bubble',
        frames: this.anims.generateFrameNumbers('fountain', { start: 0, end: 1 }),
        frameRate: 3, repeat: -1,
      });
    }

    // Camera drag
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.isDragging = false;
      this.dragStartX = p.x;
      this.dragStartY = p.y;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      if (Math.abs(p.x - this.dragStartX) > 5 || Math.abs(p.y - this.dragStartY) > 5) {
        this.isDragging = true;
      }
      if (this.isDragging) {
        const cam = this.cameras.main;
        cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
        cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
      }
    });

    // Scroll zoom
    this.input.on('wheel', (_p: unknown, _go: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.002, 0.35, 2.5));
    });
  }

  update() {
    const now = this.time.now;

    for (const [, a] of this.agentSprites) {
      // If talking, stay still and face partner
      if (a.state === 'talking') {
        if (a.talkingTo) {
          const partner = this.agentSprites.get(a.talkingTo);
          if (partner) {
            const dx = partner.container.x - a.container.x;
            if (Math.abs(dx) > 5) {
              this.playAnim(a, 'idle_side');
              a.sprite.setFlipX(dx < 0);
            } else {
              this.playAnim(a, 'idle_down');
            }
          }
        }
        a.container.setDepth(100 + a.container.y);
        continue;
      }

      const dx = a.targetX - a.container.x;
      const dy = a.targetY - a.container.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 3 && (a.state === 'walking' || a.state === 'wandering')) {
        // Move toward target — wandering is slower
        const speed = a.state === 'wandering' ? AGENT_SPEED * 0.6 : AGENT_SPEED;
        a.container.x += (dx / dist) * speed;
        a.container.y += (dy / dist) * speed;

        if (Math.abs(dx) > Math.abs(dy)) {
          this.playAnim(a, 'walk_side');
          a.sprite.setFlipX(dx < 0);
        } else if (dy > 0) {
          this.playAnim(a, 'walk_down');
          a.sprite.setFlipX(false);
        } else {
          this.playAnim(a, 'walk_up');
          a.sprite.setFlipX(false);
        }
      } else if (a.state === 'walking' || a.state === 'wandering') {
        // Arrived — start idling
        a.state = 'idle';
        a.idleUntil = now + IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);

        const idleAnims = ['idle_down', 'idle_side', 'idle_up'];
        const pick = idleAnims[Math.floor(Math.random() * idleAnims.length)];
        this.playAnim(a, pick);
        if (pick === 'idle_side') a.sprite.setFlipX(Math.random() < 0.5);
        else a.sprite.setFlipX(false);
      } else if (a.state === 'idle' && now > a.idleUntil) {
        // Idle time expired — maybe wander locally
        if (Math.random() < WANDER_CHANCE) {
          const angle = Math.random() * Math.PI * 2;
          const r = 15 + Math.random() * WANDER_RADIUS;
          a.targetX = a.homeX + Math.cos(angle) * r;
          a.targetY = a.homeY + Math.sin(angle) * r * 0.5 + 20;
          a.state = 'wandering';
        } else {
          // Continue idling with a new pause
          a.idleUntil = now + IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);
          const idleAnims = ['idle_down', 'idle_side', 'idle_up'];
          const pick = idleAnims[Math.floor(Math.random() * idleAnims.length)];
          this.playAnim(a, pick);
          if (pick === 'idle_side') a.sprite.setFlipX(Math.random() < 0.5);
        }
      }

      a.container.setDepth(100 + a.container.y);
    }
  }

  private playAnim(a: AgentSprite, suffix: string) {
    const key = `${a.sheetName}_${suffix}`;
    if (a.sprite.anims.currentAnim?.key !== key && this.anims.exists(key)) {
      a.sprite.play(key, true);
    }
  }

  // ── Map generation ──
  private generateIslandMap(): number[][] {
    const map: number[][] = [];
    const cx = MAP_COLS / 2;
    const cy = MAP_ROWS / 2;

    for (let row = 0; row < MAP_ROWS; row++) {
      map[row] = [];
      for (let col = 0; col < MAP_COLS; col++) {
        const nx = (col - cx) / (MAP_COLS * 0.42);
        const ny = (row - cy) / (MAP_ROWS * 0.40);
        const angle = Math.atan2(ny, nx);
        const wobble =
          0.08 * Math.sin(angle * 3 + 1.2) +
          0.05 * Math.sin(angle * 7 + 3.4) +
          0.03 * Math.sin(angle * 13 + 0.7) +
          0.04 * Math.cos(angle * 5 + 2.1);
        const dist = Math.sqrt(nx * nx + ny * ny) + wobble;

        if (dist > 1.02) {
          map[row][col] = WATER;
        } else if (dist > 0.95) {
          map[row][col] = BEACH;
        } else {
          const n = Math.sin(col * 0.3 + row * 0.2) * Math.cos(col * 0.15 - row * 0.25);
          map[row][col] = n > 0.5 ? DARK_GRASS : GRASS;
        }
      }
    }

    const pairs: [string, string][] = [
      ['market', 'tavern'], ['market', 'mayor'], ['market', 'smithy'],
      ['market', 'farm'], ['tavern', 'beach'], ['tavern', 'docks'],
      ['beach', 'docks'], ['farm', 'smithy'], ['lighthouse', 'smithy'],
      ['mayor', 'beach'], ['docks', 'lighthouse'],
    ];
    for (const [a, b] of pairs) {
      const pa = LOCATION_POSITIONS[a];
      const pb = LOCATION_POSITIONS[b];
      if (pa && pb) this.drawPath(map,
        Math.floor(pa.x / TILE_SIZE), Math.floor(pa.y / TILE_SIZE),
        Math.floor(pb.x / TILE_SIZE), Math.floor(pb.y / TILE_SIZE));
    }

    const fp = LOCATION_POSITIONS.farm;
    const fx = Math.floor(fp.x / TILE_SIZE);
    const fy = Math.floor(fp.y / TILE_SIZE);
    for (let dy = -4; dy <= 5; dy++) {
      for (let dx = -8; dx <= -1; dx++) {
        const r = fy + dy, c = fx + dx;
        if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS &&
            (map[r][c] === GRASS || map[r][c] === DARK_GRASS)) {
          map[r][c] = FARM;
        }
      }
    }

    return map;
  }

  private drawPath(map: number[][], x1: number, y1: number, x2: number, y2: number) {
    let x = x1, y = y1;
    for (let i = 0; i < 600; i++) {
      for (let w = -1; w <= 1; w++) {
        const py = y + (Math.abs(x2 - x) > Math.abs(y2 - y) ? w : 0);
        const px = x + (Math.abs(x2 - x) <= Math.abs(y2 - y) ? w : 0);
        if (py >= 0 && py < MAP_ROWS && px >= 0 && px < MAP_COLS &&
            (map[py][px] === GRASS || map[py][px] === DARK_GRASS)) {
          map[py][px] = PATH;
        }
      }
      if (x === x2 && y === y2) break;
      if (Math.abs(x2 - x) > Math.abs(y2 - y)) {
        x += x2 > x ? 1 : -1;
        if (i % 7 === 0 && y !== y2) y += y2 > y ? 1 : -1;
      } else {
        y += y2 > y ? 1 : -1;
        if (i % 7 === 0 && x !== x2) x += x2 > x ? 1 : -1;
      }
    }
  }

  // ── Tile rendering ──
  private renderTileMap() {
    const waterBg = this.add.tileSprite(0, 0, MAP_W, MAP_H, 'tile_water');
    waterBg.setOrigin(0, 0).setDepth(0);
    this.tweens.add({
      targets: waterBg, tilePositionX: 20, tilePositionY: 10,
      duration: 8000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    const g = this.add.graphics().setDepth(1);
    const colors: Record<number, number[]> = {
      [GRASS]:      [0x5fa85f, 0x55a055, 0x65ad65],
      [DARK_GRASS]: [0x4d9050, 0x459048, 0x539555],
      [BEACH]:      [0xe8cc7a, 0xd4b86a, 0xecd285],
      [PATH]:       [0xc4a46c, 0xb89860, 0xcaab74],
      [FARM]:       [0x8b6e3e, 0x7a5f32, 0x947845],
    };

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const t = this.tileMap[row][col];
        if (t === WATER) continue;
        const c = colors[t];
        if (!c) continue;
        const variant = (col * 7 + row * 13) % 3;
        g.fillStyle(c[variant], 1);
        g.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    const furrows = this.add.graphics().setDepth(2).setAlpha(0.4);
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (this.tileMap[row][col] === FARM) {
          furrows.fillStyle(0x5a4020, 1);
          furrows.fillRect(col * TILE_SIZE, row * TILE_SIZE + 6, TILE_SIZE, 2);
          furrows.fillRect(col * TILE_SIZE, row * TILE_SIZE + 12, TILE_SIZE, 2);
        }
      }
    }

    const shimmer = this.add.graphics().setDepth(2).setAlpha(0.18);
    for (let row = 1; row < MAP_ROWS - 1; row++) {
      for (let col = 1; col < MAP_COLS - 1; col++) {
        if (this.tileMap[row][col] === BEACH) {
          const adj = [this.tileMap[row-1][col], this.tileMap[row+1][col],
                       this.tileMap[row][col-1], this.tileMap[row][col+1]];
          if (adj.includes(WATER)) {
            shimmer.fillStyle(0xffffff, 1);
            shimmer.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }
      }
    }

    const waves = this.add.graphics().setDepth(2).setAlpha(0.25);
    const rng = this.seeded(77);
    for (let i = 0; i < 2000; i++) {
      const wx = rng() * MAP_W;
      const wy = rng() * MAP_H;
      const c = Math.floor(wx / TILE_SIZE);
      const r = Math.floor(wy / TILE_SIZE);
      if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS && this.tileMap[r][c] === WATER) {
        waves.fillStyle(0x93c5fd, 1);
        waves.fillRect(wx, wy, 4 + rng() * 8, 2);
      }
    }
  }

  // ── Buildings ──
  private placeBuildings() {
    for (const [locId, pos] of Object.entries(LOCATION_POSITIONS)) {
      const cfg = LOCATION_BUILDINGS[locId];
      if (!cfg || !this.textures.exists(cfg.key)) continue;

      const shadow = this.add.ellipse(pos.x, pos.y + 10, 120, 20, 0x000000, 0.12);
      shadow.setDepth(49 + pos.y);

      const img = this.add.image(pos.x, pos.y + cfg.offsetY, cfg.key);
      img.setScale(cfg.scale);
      img.setDepth(50 + pos.y);
    }

    const farm = LOCATION_POSITIONS.farm;
    if (this.textures.exists('bld_barn')) {
      this.add.image(farm.x - 130, farm.y + 30, 'bld_barn').setScale(0.9).setDepth(50 + farm.y);
    }
  }

  // ── Trees ──
  private placeTrees() {
    const rng = this.seeded(42);
    for (let row = 5; row < MAP_ROWS - 5; row++) {
      for (let col = 5; col < MAP_COLS - 5; col++) {
        const t = this.tileMap[row][col];
        if (t !== GRASS && t !== DARK_GRASS) continue;
        if (rng() > 0.022) continue;

        const tx = col * TILE_SIZE + 8;
        const ty = row * TILE_SIZE + 8;

        let tooClose = false;
        for (const p of Object.values(LOCATION_POSITIONS)) {
          if (Math.abs(p.x - tx) < 110 && Math.abs(p.y - ty) < 90) { tooClose = true; break; }
        }
        if (tooClose) continue;

        const key = rng() < 0.6 ? 'tree' : 'tree_small';
        if (this.textures.exists(key)) {
          const tree = this.add.image(tx, ty, key);
          tree.setOrigin(0.5, 0.85);
          tree.setDepth(50 + ty);
        }
      }
    }
  }

  // ── Decor ──
  private placeDecoration() {
    const docks = LOCATION_POSITIONS.docks;
    if (this.textures.exists('boat')) {
      this.add.image(docks.x - 60, docks.y + 55, 'boat').setScale(1.5).setDepth(50 + docks.y + 55);
      this.add.image(docks.x + 50, docks.y + 70, 'boat').setScale(1.3).setFlipX(true).setDepth(50 + docks.y + 70);
    }
    const mkt = LOCATION_POSITIONS.market;
    if (this.textures.exists('fountain')) {
      const f = this.add.sprite(mkt.x + 65, mkt.y + 45, 'fountain');
      f.setDepth(50 + mkt.y + 45);
      if (this.anims.exists('fountain_bubble')) f.play('fountain_bubble');
    }

    const rng = this.seeded(123);
    const tufts = this.add.graphics().setDepth(3);
    for (let i = 0; i < 1200; i++) {
      const gx = rng() * MAP_W;
      const gy = rng() * MAP_H;
      const c = Math.floor(gx / TILE_SIZE);
      const r = Math.floor(gy / TILE_SIZE);
      if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
        const t = this.tileMap[r][c];
        if (t === GRASS || t === DARK_GRASS) {
          tufts.fillStyle(0x3d8b3d, 0.45);
          tufts.fillRect(gx, gy, 2, 5);
          tufts.fillRect(gx + 3, gy + 1, 2, 4);
        }
      }
    }
  }

  // ── Labels ──
  private placeLocationLabels() {
    for (const [, pos] of Object.entries(LOCATION_POSITIONS)) {
      const label = this.add.text(pos.x, pos.y - 70, pos.label, {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      });
      label.setOrigin(0.5, 0.5).setDepth(200);

      const bg = this.add.rectangle(pos.x, pos.y - 70, label.width + 14, label.height + 8, 0x0f172a, 0.7);
      bg.setOrigin(0.5, 0.5).setDepth(199);
      bg.setStrokeStyle(1, 0x3b82f6, 0.5);
    }
  }

  // ── NPC animations ──
  private createNpcAnimations() {
    for (const [name, cfg] of Object.entries(NPC_SPRITE_CONFIG)) {
      if (!this.textures.exists(name)) continue;
      const c = cfg.cols;
      const rows = [
        ['idle_down', 0], ['idle_side', 1], ['idle_up', 2],
        ['walk_down', 3], ['walk_side', 4], ['walk_up', 5],
      ] as const;
      for (const [suffix, rowIdx] of rows) {
        this.anims.create({
          key: `${name}_${suffix}`,
          frames: this.anims.generateFrameNumbers(name, {
            start: rowIdx * c,
            end: (rowIdx + 1) * c - 1,
          }),
          frameRate: suffix.startsWith('walk') ? 8 : 5,
          repeat: -1,
        });
      }
    }
  }

  // ── Agent management ──
  updateAgents(agents: Agent[]) {
    const seen = new Set<string>();
    for (const agent of agents) {
      seen.add(agent.id);
      const pos = LOCATION_POSITIONS[agent.current_location_id] || LOCATION_POSITIONS.market;
      const off = this.getOffset(agent.id, agents, agent.current_location_id);

      if (this.agentSprites.has(agent.id)) {
        const e = this.agentSprites.get(agent.id)!;
        const newHomeX = pos.x + off.x;
        const newHomeY = pos.y + off.y;

        // Only set new walking target if location actually changed
        const locationChanged = e.agentData.current_location_id !== agent.current_location_id;
        if (locationChanged) {
          e.homeX = newHomeX;
          e.homeY = newHomeY;
          e.targetX = newHomeX;
          e.targetY = newHomeY;
          e.state = 'walking';
          e.talkingTo = undefined;
        }
        e.agentData = agent;
      } else {
        this.createAgent(agent, pos.x + off.x, pos.y + off.y);
      }
    }
    for (const [id] of this.agentSprites) {
      if (!seen.has(id)) {
        this.agentSprites.get(id)!.container.destroy();
        this.agentSprites.delete(id);
      }
    }
  }

  private createAgent(agent: Agent, x: number, y: number) {
    const sheetName = AGENT_SPRITE_MAP[agent.sprite_key] || 'Farmer_Bob';
    const container = this.add.container(x, y).setDepth(100 + y);

    const shadow = this.add.ellipse(0, 20, 30, 10, 0x000000, 0.25);
    container.add(shadow);

    let sprite: Phaser.GameObjects.Sprite;
    if (this.textures.exists(sheetName)) {
      sprite = this.add.sprite(0, 0, sheetName, 0);
      const cfg = NPC_SPRITE_CONFIG[sheetName];
      if (cfg?.frameSize && cfg.frameSize < NPC_FRAME_SIZE) {
        sprite.setScale(NPC_FRAME_SIZE / cfg.frameSize);
      }
      const key = `${sheetName}_idle_down`;
      if (this.anims.exists(key)) sprite.play(key, true);
    } else {
      sprite = this.add.sprite(0, 0, 'tile_grass');
    }
    container.add(sprite);

    const nameText = this.add.text(0, -40, agent.name.split(' ')[0], {
      fontSize: '10px', fontFamily: 'monospace',
      color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5);

    const nameBg = this.add.rectangle(0, -40, nameText.width + 10, nameText.height + 6, 0x0f172a, 0.8)
      .setOrigin(0.5, 0.5).setStrokeStyle(1, 0x3b82f6, 0.6);

    const nameTag = this.add.container(0, 0);
    nameTag.add(nameBg);
    nameTag.add(nameText);
    container.add(nameTag);

    const hitArea = this.add.rectangle(0, 0, 50, 64, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on('pointerdown', () => {
      if (!this.isDragging && globalThis.__molt?.onAgentClick) {
        globalThis.__molt.onAgentClick(agent.id);
        this.cameras.main.pan(container.x, container.y, 500, 'Power2');
      }
    });
    container.add(hitArea);

    this.agentSprites.set(agent.id, {
      container, sprite, nameTag, shadow,
      targetX: x, targetY: y,
      homeX: x, homeY: y,
      sheetName,
      state: 'idle',
      idleUntil: this.time.now + IDLE_MIN_MS + Math.random() * IDLE_MAX_MS,
      agentData: agent,
    });
  }

  private getOffset(id: string, agents: Agent[], locId: string) {
    const atSame = agents.filter(a => a.current_location_id === locId);
    const idx = atSame.findIndex(a => a.id === id);
    const count = atSame.length;
    if (count <= 1) return { x: 0, y: 25 };

    if (count <= 4) {
      const positions = [
        { x: -30, y: 15 }, { x: 30, y: 15 },
        { x: -30, y: 50 }, { x: 30, y: 50 },
      ];
      return positions[idx] || { x: 0, y: 25 };
    }

    const angle = (idx / count) * Math.PI * 2 + 0.3;
    const r = 40 + count * 8;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r * 0.5 + 25 };
  }

  // ── Speech bubbles (parchment style) ──
  showConversations(conversations: Conversation[]) {
    for (const convo of conversations) {
      if (this.seenConvoIds.has(convo.id)) continue;
      this.seenConvoIds.add(convo.id);

      const messages = convo.messages as ConversationMessage[];
      if (!messages || messages.length === 0) continue;

      // Make participants face each other and stop
      const participantIds = messages.map(m => m.agent_id).filter((v, i, a) => a.indexOf(v) === i);
      for (const pid of participantIds) {
        const as = this.agentSprites.get(pid);
        if (as) {
          as.state = 'talking';
          as.talkingTo = participantIds.find(id => id !== pid) || undefined;
        }
      }

      // Sequence speech bubbles with natural timing
      messages.forEach((msg, i) => {
        this.time.delayedCall(i * 3500, () => {
          this.showBubble(msg.agent_id, msg.content);
        });
      });

      // Release agents after all messages
      const totalDuration = messages.length * 3500 + 3000;
      this.time.delayedCall(totalDuration, () => {
        for (const pid of participantIds) {
          const as = this.agentSprites.get(pid);
          if (as && as.state === 'talking') {
            as.state = 'idle';
            as.idleUntil = this.time.now + IDLE_MIN_MS;
            as.talkingTo = undefined;
          }
        }
      });
    }
  }

  private showBubble(agentId: string, text: string) {
    const agentSprite = this.agentSprites.get(agentId);
    if (!agentSprite) return;

    if (agentSprite.bubble) {
      agentSprite.bubble.destroy();
      agentSprite.bubble = undefined;
    }
    if (agentSprite.bubbleTimer) {
      agentSprite.bubbleTimer.destroy();
      agentSprite.bubbleTimer = undefined;
    }

    const display = text.length > 60 ? text.substring(0, 57) + '...' : text;

    // Parchment-style bubble
    const bubbleText = this.add.text(0, 0, display, {
      fontSize: '9px',
      fontFamily: '"Press Start 2P", monospace',
      color: '#3a2510',
      wordWrap: { width: 150 },
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5, 1);

    const pad = 10;
    const w = Math.max(bubbleText.width + pad * 2, 50);
    const h = bubbleText.height + pad * 2;
    const bubbleY = -65;

    const bg = this.add.graphics();
    bg.fillStyle(0xf5e6c8, 0.95);
    bg.fillRoundedRect(-w / 2, bubbleY - h, w, h, 4);
    bg.lineStyle(2, 0x6b4226, 0.9);
    bg.strokeRoundedRect(-w / 2, bubbleY - h, w, h, 4);
    bg.lineStyle(1, 0xdec9a0, 0.4);
    bg.strokeRoundedRect(-w / 2 + 2, bubbleY - h + 2, w - 4, h - 4, 3);
    bg.fillStyle(0xf5e6c8, 0.95);
    bg.fillTriangle(-5, bubbleY, 5, bubbleY, 0, bubbleY + 8);
    bg.lineStyle(2, 0x6b4226, 0.9);
    bg.lineBetween(-5, bubbleY, 0, bubbleY + 8);
    bg.lineBetween(5, bubbleY, 0, bubbleY + 8);

    bubbleText.setPosition(0, bubbleY - pad);

    const bubble = this.add.container(0, 0);
    bubble.add(bg);
    bubble.add(bubbleText);
    bubble.setDepth(500);
    bubble.setAlpha(0);
    bubble.setScale(0.8);

    agentSprite.container.add(bubble);
    agentSprite.bubble = bubble;

    // Pop-in animation
    this.tweens.add({
      targets: bubble,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 250,
      ease: 'Back.easeOut',
    });

    // Auto-remove after 3s
    agentSprite.bubbleTimer = this.time.delayedCall(3000, () => {
      if (agentSprite.bubble === bubble) {
        this.tweens.add({
          targets: bubble,
          alpha: 0,
          scaleY: 0.7,
          duration: 300,
          ease: 'Power2',
          onComplete: () => {
            bubble.destroy();
            if (agentSprite.bubble === bubble) {
              agentSprite.bubble = undefined;
            }
          },
        });
      }
    });
  }

  private seeded(seed: number) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
}
