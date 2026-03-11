-- Conversations table for speech bubble persistence
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tick_id INT NOT NULL REFERENCES simulation_ticks(id),
  location_id TEXT NOT NULL REFERENCES locations(id),
  participants JSONB NOT NULL DEFAULT '[]',
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_tick ON conversations(tick_id);
CREATE INDEX IF NOT EXISTS idx_conversations_location ON conversations(location_id);

-- Enable Realtime for conversations
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
