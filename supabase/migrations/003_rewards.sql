-- Rewards system: simulated MOLT credits (off-chain for now)

-- Add balance to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS molt_balance NUMERIC NOT NULL DEFAULT 0;

-- Reward ledger for audit trail
CREATE TABLE IF NOT EXISTS reward_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  tick_id INT NOT NULL REFERENCES simulation_ticks(id),
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reward_events_agent ON reward_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_reward_events_tick ON reward_events(tick_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE reward_events;
