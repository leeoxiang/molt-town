-- Molt Town Schema — safe to re-run (IF NOT EXISTS / OR REPLACE throughout)

-- ── Locations ──
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  x INT NOT NULL,
  y INT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

-- ── Agents ──
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  job TEXT NOT NULL,
  home_location_id TEXT REFERENCES locations(id),
  current_location_id TEXT REFERENCES locations(id),
  current_action TEXT NOT NULL DEFAULT 'idle',
  sprite_key TEXT NOT NULL DEFAULT 'npc_default',
  traits JSONB NOT NULL DEFAULT '[]',
  goals JSONB NOT NULL DEFAULT '[]',
  schedule JSONB NOT NULL DEFAULT '[]',
  energy INT NOT NULL DEFAULT 100,
  stress INT NOT NULL DEFAULT 0,
  social INT NOT NULL DEFAULT 50,
  happiness INT NOT NULL DEFAULT 70,
  anger INT NOT NULL DEFAULT 0,
  reputation INT NOT NULL DEFAULT 50,
  current_thought TEXT NOT NULL DEFAULT '',
  moltbook_persona TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Agent Relationships ──
CREATE TABLE IF NOT EXISTS agent_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  target_agent_id TEXT NOT NULL REFERENCES agents(id),
  trust INT NOT NULL DEFAULT 50,
  friendship INT NOT NULL DEFAULT 50,
  rivalry INT NOT NULL DEFAULT 0,
  last_interaction_tick INT,
  UNIQUE(agent_id, target_agent_id)
);

-- ── Simulation Ticks ──
CREATE TABLE IF NOT EXISTS simulation_ticks (
  id SERIAL PRIMARY KEY,
  sim_hour INT NOT NULL DEFAULT 0,
  sim_day INT NOT NULL DEFAULT 1,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary TEXT
);

-- ── Agent Memories ──
CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  tick_id INT NOT NULL REFERENCES simulation_ticks(id),
  source TEXT NOT NULL DEFAULT 'event',
  type TEXT NOT NULL DEFAULT 'observation',
  content TEXT NOT NULL,
  importance INT NOT NULL DEFAULT 5,
  related_agent_id TEXT REFERENCES agents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── World Events ──
CREATE TABLE IF NOT EXISTS world_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tick_id INT NOT NULL REFERENCES simulation_ticks(id),
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  location_id TEXT REFERENCES locations(id),
  agent_ids JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Moltbook Posts ──
CREATE TABLE IF NOT EXISTS moltbook_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id TEXT NOT NULL REFERENCES agents(id),
  tick_id INT NOT NULL REFERENCES simulation_ticks(id),
  content TEXT NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'status',
  parent_post_id UUID REFERENCES moltbook_posts(id),
  likes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Moltbook Reactions ──
CREATE TABLE IF NOT EXISTS moltbook_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES moltbook_posts(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  reaction_type TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, agent_id)
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_memories_agent ON agent_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_memories_tick ON agent_memories(tick_id);
CREATE INDEX IF NOT EXISTS idx_events_tick ON world_events(tick_id);
CREATE INDEX IF NOT EXISTS idx_posts_author ON moltbook_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_tick ON moltbook_posts(tick_id);
CREATE INDEX IF NOT EXISTS idx_reactions_post ON moltbook_reactions(post_id);

-- ── Enable Realtime ──
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
ALTER PUBLICATION supabase_realtime ADD TABLE moltbook_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE world_events;
ALTER PUBLICATION supabase_realtime ADD TABLE simulation_ticks;
