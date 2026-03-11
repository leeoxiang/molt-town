-- Workers table for "Join to Mine" feature
CREATE TABLE IF NOT EXISTS workers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  agent_id TEXT,
  molt_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for wallet lookups
CREATE INDEX IF NOT EXISTS idx_workers_wallet ON workers(wallet);

-- Enable RLS
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

-- Allow public reads
CREATE POLICY "workers_read_all" ON workers FOR SELECT USING (true);

NOTIFY pgrst, 'reload schema';
