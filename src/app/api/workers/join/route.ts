import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

// Available sprite keys for joined workers (cycle through)
const WORKER_SPRITES = [
  'npc_farmer', 'npc_fisher', 'npc_bartender', 'npc_innkeeper',
  'npc_blacksmith', 'npc_courier', 'npc_merchant', 'npc_groundskeeper',
];

const WORKER_JOBS = ['miner', 'laborer', 'gatherer', 'prospector', 'apprentice'];

const WORKER_TRAITS_POOL = [
  'hardworking', 'curious', 'friendly', 'energetic', 'cautious',
  'cheerful', 'practical', 'ambitious',
];

const LOCATIONS = ['market', 'tavern', 'farm', 'docks', 'smithy', 'beach'];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickTraits(): string[] {
  const shuffled = [...WORKER_TRAITS_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2 + Math.floor(Math.random() * 2));
}

function buildSchedule(homeLoc: string) {
  return [
    { hour: 6, location_id: homeLoc, action: 'morning routine' },
    { hour: 8, location_id: 'market', action: 'looking for work' },
    { hour: 10, location_id: pickRandom(LOCATIONS), action: 'mining resources' },
    { hour: 12, location_id: 'tavern', action: 'lunch' },
    { hour: 14, location_id: pickRandom(LOCATIONS), action: 'afternoon mining' },
    { hour: 18, location_id: 'tavern', action: 'dinner' },
    { hour: 21, location_id: homeLoc, action: 'sleep' },
  ];
}

export async function POST(req: Request) {
  try {
    const { wallet, name } = await req.json();

    if (!wallet || typeof wallet !== 'string' || wallet.length < 10) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }
    if (!name || typeof name !== 'string' || name.length < 2 || name.length > 30) {
      return NextResponse.json({ error: 'Name must be 2-30 characters' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Build a unique agent ID from wallet
    const agentId = `worker_${wallet.slice(0, 8).toLowerCase()}`;

    // Check if this wallet already has an agent
    const { data: existingAgent } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .single();

    if (existingAgent) {
      return NextResponse.json({ error: 'This wallet already has a worker in town' }, { status: 409 });
    }

    const homeLoc = pickRandom(LOCATIONS);
    const spriteKey = WORKER_SPRITES[Math.floor(Math.random() * WORKER_SPRITES.length)];
    const job = pickRandom(WORKER_JOBS);
    const traits = pickTraits();

    // Create the agent row — this makes the worker appear in the shared town
    const { error: agentError } = await supabase
      .from('agents')
      .insert({
        id: agentId,
        name: name,
        job: job,
        home_location_id: homeLoc,
        current_location_id: homeLoc,
        sprite_key: spriteKey,
        traits: traits,
        goals: ['mine MOLTTOWN tokens', 'make friends in town', 'earn a reputation'],
        schedule: buildSchedule(homeLoc),
        moltbook_persona: `${name} — new worker in Molt Town.`,
        current_thought: 'Just arrived in Molt Town. Time to get to work!',
        energy: 80,
        stress: 10,
        social: 50,
        happiness: 70,
        anger: 0,
        reputation: 10,
        molt_balance: 0,
        current_action: 'arriving',
      });

    if (agentError) {
      console.error('[workers/join] agent insert error:', agentError.code, agentError.message);
      return NextResponse.json({ error: agentError.message }, { status: 500 });
    }

    // Also try to create a workers record for wallet tracking (optional table)
    try {
      await supabase
        .from('workers')
        .insert({ wallet, name, molt_balance: 0, agent_id: agentId });
    } catch {
      // Workers table may not exist — that's fine, the agent row is what matters
    }

    return NextResponse.json({ id: agentId, name, job, sprite_key: spriteKey });
  } catch (err) {
    console.error('[workers/join] unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
