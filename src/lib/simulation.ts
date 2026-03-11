import { getServiceSupabase } from './supabase';
import type { Agent, ScheduleEntry, AgentRelationship, AgentMemory, MoltbookPost } from '@/types';

const db = () => getServiceSupabase();

// ── Main tick processor ──
export async function processSimulationTick(): Promise<{ tick_id: number; summary: string }> {
  const supabase = db();

  // 1. Get current tick or create first one
  const { data: lastTick } = await supabase
    .from('simulation_ticks')
    .select('*')
    .order('id', { ascending: false })
    .limit(1)
    .single();

  const prevHour = lastTick?.sim_hour ?? 5;
  const prevDay = lastTick?.sim_day ?? 1;
  const newHour = (prevHour + 1) % 24;
  const newDay = newHour === 0 ? prevDay + 1 : prevDay;

  // 2. Create new tick
  const { data: tick } = await supabase
    .from('simulation_ticks')
    .insert({ sim_hour: newHour, sim_day: newDay, summary: '' })
    .select()
    .single();

  if (!tick) throw new Error('Failed to create tick');

  // 3. Load all agents
  const { data: agents } = await supabase.from('agents').select('*');
  if (!agents || agents.length === 0) return { tick_id: tick.id, summary: 'No agents found.' };

  // 4. Load relationships
  const { data: relationships } = await supabase.from('agent_relationships').select('*');

  // 5. Load recent posts (last 10 ticks)
  const { data: recentPosts } = await supabase
    .from('moltbook_posts')
    .select('*')
    .gte('tick_id', Math.max(1, tick.id - 10))
    .order('created_at', { ascending: false })
    .limit(30);

  // 6. Process each agent
  const events: string[] = [];

  for (const agent of agents as Agent[]) {
    const result = await processAgent(
      agent,
      newHour,
      tick.id,
      agents as Agent[],
      (relationships || []) as AgentRelationship[],
      (recentPosts || []) as MoltbookPost[],
    );
    if (result.event) events.push(result.event);
  }

  // 7. Update tick summary
  const summary = events.length > 0
    ? events.join(' | ')
    : `Hour ${newHour}: The town is quiet.`;

  await supabase
    .from('simulation_ticks')
    .update({ summary })
    .eq('id', tick.id);

  return { tick_id: tick.id, summary };
}

// ── Process a single agent for one tick ──
async function processAgent(
  agent: Agent,
  hour: number,
  tickId: number,
  allAgents: Agent[],
  relationships: AgentRelationship[],
  recentPosts: MoltbookPost[],
): Promise<{ event: string | null }> {
  const supabase = db();

  // 1. Determine scheduled action
  const scheduled = getScheduledAction(agent.schedule as ScheduleEntry[], hour);
  const newLocationId = scheduled?.location_id || agent.current_location_id;
  const newAction = scheduled?.action || 'idle';

  // 2. Check who else is at the new location
  const colocated = allAgents.filter(
    a => a.id !== agent.id && a.current_location_id === newLocationId
  );

  // 3. Update meters based on action and context
  const meterUpdates = computeMeterUpdates(agent, newAction, colocated.length);

  // 4. Generate thought based on state
  const thought = generateThought(agent, newAction, newLocationId, colocated, meterUpdates);

  // 5. Decide whether to post on Moltbook
  const shouldPost = decideToPost(agent, newAction, hour, tickId, recentPosts);
  let postContent: string | null = null;
  let event: string | null = null;

  if (shouldPost) {
    postContent = generatePostContent(agent, newAction, newLocationId, colocated, meterUpdates);
  }

  // 6. Check for reactions to recent posts
  await processReactions(agent, recentPosts, relationships, tickId);

  // 7. Update agent state
  await supabase
    .from('agents')
    .update({
      current_location_id: newLocationId,
      current_action: newAction,
      energy: clamp(agent.energy + meterUpdates.energy, 0, 100),
      stress: clamp(agent.stress + meterUpdates.stress, 0, 100),
      social: clamp(agent.social + meterUpdates.social, 0, 100),
      happiness: clamp(agent.happiness + meterUpdates.happiness, 0, 100),
      anger: clamp(agent.anger + meterUpdates.anger, 0, 100),
      current_thought: thought,
    })
    .eq('id', agent.id);

  // 8. Create memory of this tick's action
  const moved = newLocationId !== agent.current_location_id;
  if (moved || newAction !== agent.current_action) {
    await supabase.from('agent_memories').insert({
      agent_id: agent.id,
      tick_id: tickId,
      source: 'self',
      type: 'action',
      content: `${newAction} at ${newLocationId}`,
      importance: 3,
    });
  }

  // 9. Create world event if something notable happened
  if (moved) {
    event = `${agent.name} moved to ${newLocationId}`;
    await supabase.from('world_events').insert({
      tick_id: tickId,
      event_type: 'movement',
      description: event,
      location_id: newLocationId,
      agent_ids: [agent.id],
    });
  }

  // 10. Create interaction events with colocated agents
  if (colocated.length > 0 && Math.random() < 0.3) {
    const other = colocated[Math.floor(Math.random() * colocated.length)];
    const interactionEvent = `${agent.name} chatted with ${other.name} at ${newLocationId}`;
    event = interactionEvent;

    // Generate conversation dialogue for speech bubbles
    const dialogue = generateConversation(agent, other, newAction, newLocationId);

    await supabase.from('world_events').insert({
      tick_id: tickId,
      event_type: 'interaction',
      description: interactionEvent,
      location_id: newLocationId,
      agent_ids: [agent.id, other.id],
    });

    // Persist conversation for speech bubbles
    await supabase.from('conversations').insert({
      tick_id: tickId,
      location_id: newLocationId,
      participants: [agent.id, other.id],
      messages: dialogue,
    });

    // Update relationship
    await supabase.from('agent_relationships').upsert({
      agent_id: agent.id,
      target_agent_id: other.id,
      trust: 50,
      friendship: 52,
      rivalry: 0,
      last_interaction_tick: tickId,
    }, { onConflict: 'agent_id,target_agent_id' });

    // Memory of interaction
    await supabase.from('agent_memories').insert({
      agent_id: agent.id,
      tick_id: tickId,
      source: 'interaction',
      type: 'social',
      content: `Had a chat with ${other.name}: "${dialogue[0]?.content || ''}"`,
      importance: 5,
      related_agent_id: other.id,
    });
  }

  // 11. Post on Moltbook if decided
  if (postContent) {
    const { data: post } = await supabase.from('moltbook_posts').insert({
      author_id: agent.id,
      tick_id: tickId,
      content: postContent,
      post_type: categorizePost(agent, newAction),
    }).select().single();

    // Memory of posting
    if (post) {
      await supabase.from('agent_memories').insert({
        agent_id: agent.id,
        tick_id: tickId,
        source: 'moltbook',
        type: 'posted',
        content: `Posted on Moltbook: "${postContent}"`,
        importance: 6,
      });
      event = `${agent.name} posted on Moltbook`;
    }
  }

  return { event };
}

// ── Helper: get scheduled action for the hour ──
function getScheduledAction(schedule: ScheduleEntry[], hour: number): ScheduleEntry | null {
  // Find the most recent schedule entry at or before this hour
  const sorted = [...schedule].sort((a, b) => b.hour - a.hour);
  return sorted.find(s => s.hour <= hour) || sorted[sorted.length - 1] || null;
}

// ── Helper: compute meter changes ──
function computeMeterUpdates(
  agent: Agent,
  action: string,
  nearbyCount: number
): { energy: number; stress: number; social: number; happiness: number; anger: number } {
  const updates = { energy: 0, stress: 0, social: 0, happiness: 0, anger: 0 };

  // Sleep restores energy
  if (action === 'sleep') {
    updates.energy = 15;
    updates.stress = -10;
  } else {
    updates.energy = -3;
  }

  // Social actions
  if (action.includes('social') || action.includes('dinner') || action.includes('lunch') || action.includes('drink')) {
    updates.social = 10;
    updates.happiness = 5;
  } else if (nearbyCount === 0) {
    updates.social = -5;
  } else {
    updates.social = 3;
  }

  // Work actions
  if (action.includes('fishing') || action.includes('farming') || action.includes('smithing') || action.includes('service') || action.includes('delivering')) {
    updates.stress = 5;
    updates.happiness = agent.traits?.includes('hardworking') ? 3 : -2;
  }

  // Low energy causes stress
  if (agent.energy < 20) {
    updates.stress += 10;
    updates.happiness -= 5;
  }

  // High stress causes anger
  if (agent.stress > 70) {
    updates.anger += 5;
  } else {
    updates.anger -= 2;
  }

  return updates;
}

// ── Helper: generate thought summary ──
function generateThought(
  agent: Agent,
  action: string,
  locationId: string,
  colocated: Agent[],
  meters: { energy: number; stress: number; social: number; happiness: number; anger: number },
): string {
  const thoughts: string[] = [];

  // Base thought from action
  const actionThoughts: Record<string, string[]> = {
    'sleep': ['Zzz...', 'Time to rest.'],
    'fishing': ['The waters are calm.', 'Hope for a good catch.', 'The sea is my office.'],
    'farming': ['The soil smells rich today.', 'These crops need attention.'],
    'smithing': ['The metal sings when it\'s right.', 'Almost got the temper perfect.'],
    'selling': ['Customers are looking today.', 'Time to make some deals.'],
    'lunch': ['A good meal fixes everything.', 'Wonder what\'s on the menu.'],
    'delivering': ['More parcels to go!', 'Making good time today.'],
    'reading': ['Lost in a good chapter.', 'The words paint pictures.'],
    'stargazing': ['The stars are especially bright tonight.', 'There\'s Orion again.'],
  };

  for (const [key, options] of Object.entries(actionThoughts)) {
    if (action.includes(key)) {
      thoughts.push(options[Math.floor(Math.random() * options.length)]);
      break;
    }
  }

  // Mood-based thoughts
  if (agent.energy + meters.energy < 20) {
    thoughts.push('I\'m exhausted...');
  }
  if (agent.stress + meters.stress > 70) {
    thoughts.push('Too much on my plate.');
  }
  if (agent.social + meters.social < 20) {
    thoughts.push('I could use some company.');
  }

  // Social context
  if (colocated.length > 0) {
    const other = colocated[0];
    thoughts.push(`${other.name} is here too.`);
  }

  return thoughts.join(' ') || `Busy with ${action}.`;
}

// ── Helper: decide whether to post ──
function decideToPost(
  agent: Agent,
  action: string,
  hour: number,
  tickId: number,
  recentPosts: MoltbookPost[],
): boolean {
  // Don't post while sleeping
  if (action === 'sleep') return false;

  // Don't post too frequently (max 1 per 3 ticks per agent)
  const agentRecent = recentPosts.filter(p => p.author_id === agent.id);
  if (agentRecent.length > 0) {
    const lastPostTick = Math.max(...agentRecent.map(p => p.tick_id));
    if (tickId - lastPostTick < 3) return false;
  }

  // Traits influence posting frequency
  const isGossip = agent.traits.includes('gossip');
  const isIntroverted = agent.traits.includes('introverted');

  let chance = 0.15; // base 15% per tick
  if (isGossip) chance = 0.35;
  if (isIntroverted) chance = 0.08;
  if (agent.traits.includes('energetic')) chance += 0.1;

  // More likely to post during social hours
  if (hour >= 18 && hour <= 22) chance += 0.1;

  // Extreme emotions increase posting
  if (agent.happiness < 20 || agent.happiness > 90) chance += 0.15;
  if (agent.stress > 70) chance += 0.1;

  return Math.random() < chance;
}

// ── Helper: generate post content ──
function generatePostContent(
  agent: Agent,
  action: string,
  locationId: string,
  colocated: Agent[],
  meters: { energy: number; stress: number; social: number; happiness: number; anger: number },
): string {
  const templates: Record<string, string[]> = {
    status: [
      `Currently ${action}. Life in Molt Town continues.`,
      `${action} at the ${locationId}. Not bad.`,
      `Another day, another ${action} session.`,
    ],
    happy: [
      `Having a great day! ${action} is going well.`,
      `Love this island. ${action} with a smile.`,
      `Feeling good about ${action} today!`,
    ],
    stressed: [
      `${action} is wearing me out today...`,
      `Does anyone else feel like there's too much to do?`,
      `Need a break from ${action}. Seriously.`,
    ],
    social: [
      `Great seeing ${colocated[0]?.name || 'everyone'} at the ${locationId}!`,
      `Good company at the ${locationId} today.`,
      `Nothing like ${action} with good neighbors around.`,
    ],
    gossip: [
      `Has anyone noticed anything different about the ${locationId} lately?`,
      `Heard some interesting things at the ${locationId} today...`,
      `The things you overhear while ${action}...`,
    ],
    job: [
      `Another day of ${agent.job} work. ${agent.goals[0] || 'Keeping busy.'}`,
      `The ${agent.job} life chose me. No regrets.`,
      `Pro tip from your local ${agent.job}: always ${action} with care.`,
    ],
  };

  // Pick category based on state
  let category = 'status';
  if (agent.happiness + meters.happiness > 80) category = 'happy';
  else if (agent.stress + meters.stress > 60) category = 'stressed';
  else if (colocated.length > 0 && Math.random() < 0.4) category = 'social';
  else if (agent.traits.includes('gossip') && Math.random() < 0.5) category = 'gossip';
  else if (Math.random() < 0.3) category = 'job';

  const options = templates[category];
  return options[Math.floor(Math.random() * options.length)];
}

// ── Helper: categorize post type ──
function categorizePost(agent: Agent, action: string): string {
  if (agent.job === 'mayor') return 'announcement';
  if (agent.traits.includes('gossip')) return 'gossip';
  if (action.includes('selling') || action.includes('delivering')) return 'observation';
  return 'status';
}

// ── Helper: process reactions to recent posts ──
async function processReactions(
  agent: Agent,
  recentPosts: MoltbookPost[],
  relationships: AgentRelationship[],
  tickId: number,
): Promise<void> {
  const supabase = db();

  // Only react to posts by others
  const othersPosts = recentPosts.filter(p => p.author_id !== agent.id);
  if (othersPosts.length === 0) return;

  // Pick one post to potentially react to
  const post = othersPosts[Math.floor(Math.random() * othersPosts.length)];

  // Check relationship with author
  const rel = relationships.find(
    r => r.agent_id === agent.id && r.target_agent_id === post.author_id
  );
  const friendliness = rel ? rel.friendship : 50;

  // Chance to react based on relationship
  const reactChance = friendliness > 60 ? 0.4 : friendliness > 40 ? 0.15 : 0.05;
  if (Math.random() > reactChance) return;

  // Choose reaction type
  const reactionType = friendliness > 60 ? 'like' : friendliness < 30 ? 'angry' : 'like';

  try {
    await supabase.from('moltbook_reactions').upsert({
      post_id: post.id,
      agent_id: agent.id,
      reaction_type: reactionType,
    }, { onConflict: 'post_id,agent_id' });

    // Update likes count
    if (reactionType === 'like') {
      await supabase
        .from('moltbook_posts')
        .update({ likes: (post.likes || 0) + 1 })
        .eq('id', post.id);
    }

    // Create memory of reading this post
    await supabase.from('agent_memories').insert({
      agent_id: agent.id,
      tick_id: tickId,
      source: 'moltbook',
      type: 'read_post',
      content: `Read ${post.author_id}'s post: "${post.content?.substring(0, 60)}"`,
      importance: 4,
      related_agent_id: post.author_id,
    });
  } catch {
    // Already reacted, skip
  }
}

// ── Helper: generate conversation dialogue ──
function generateConversation(
  agent: Agent,
  other: Agent,
  action: string,
  locationId: string,
): { agent_id: string; agent_name: string; content: string }[] {
  const greetings = [
    `Hey ${other.name.split(' ')[0]}!`,
    `Morning, ${other.name.split(' ')[0]}.`,
    `Oh, ${other.name.split(' ')[0]}! Good to see you.`,
    `${other.name.split(' ')[0]}, how's it going?`,
  ];
  const responses = [
    `Hey! Not bad, just ${other.current_action}.`,
    `Oh hi! Pretty good, thanks.`,
    `Can't complain. Busy day though.`,
    `Good to see you too! What brings you here?`,
  ];
  const topics: Record<string, string[][]> = {
    tavern: [
      [`Have you tried the new chowder?`, `Not yet, is it any good?`],
      [`Busy night tonight.`, `Yeah, everyone's out.`],
    ],
    market: [
      [`Prices seem high today.`, `Supply's been low this week.`],
      [`Seen anything good at the stalls?`, `Luna has some nice shells.`],
    ],
    farm: [
      [`The crops are looking great this season.`, `Bob knows what he's doing.`],
      [`Think we'll get rain soon?`, `Hope so, the soil's getting dry.`],
    ],
    docks: [
      [`Catch anything today?`, `A few, but nothing special.`],
      [`The tide's coming in fast.`, `Better secure the boats.`],
    ],
    default: [
      [`How's work been?`, `Same as always. You?`],
      [`Nice weather today.`, `Yeah, perfect for being outside.`],
      [`Heard any news?`, `Nothing much. Quiet day.`],
    ],
  };

  const topicOptions = topics[locationId] || topics.default;
  const topic = topicOptions[Math.floor(Math.random() * topicOptions.length)];

  const messages = [
    { agent_id: agent.id, agent_name: agent.name, content: greetings[Math.floor(Math.random() * greetings.length)] },
    { agent_id: other.id, agent_name: other.name, content: responses[Math.floor(Math.random() * responses.length)] },
    { agent_id: agent.id, agent_name: agent.name, content: topic[0] },
    { agent_id: other.id, agent_name: other.name, content: topic[1] },
  ];

  return messages;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
