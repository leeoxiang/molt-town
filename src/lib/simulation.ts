import { getServiceSupabase } from './supabase';
import { resetTickCalls, generateSpeechLine, generatePostText, generateThought as llmThought } from './openrouter';
import type { Agent, ScheduleEntry, AgentRelationship, MoltbookPost } from '@/types';

const db = () => getServiceSupabase();

// Reward amounts (simulated MOLT credits)
const REWARDS = {
  work: 5,
  interaction: 3,
  post: 2,
  reaction: 1,
  movement: 1,
};

// ── Main tick processor ──
export async function processSimulationTick(): Promise<{ tick_id: number; summary: string }> {
  const supabase = db();
  resetTickCalls();

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

  const { data: tick } = await supabase
    .from('simulation_ticks')
    .insert({ sim_hour: newHour, sim_day: newDay, summary: '' })
    .select()
    .single();

  if (!tick) throw new Error('Failed to create tick');

  const { data: agents } = await supabase.from('agents').select('*');
  if (!agents || agents.length === 0) return { tick_id: tick.id, summary: 'No agents found.' };

  const { data: relationships } = await supabase.from('agent_relationships').select('*');

  const { data: recentPosts } = await supabase
    .from('moltbook_posts')
    .select('*')
    .gte('tick_id', Math.max(1, tick.id - 10))
    .order('created_at', { ascending: false })
    .limit(30);

  const events: string[] = [];

  for (const agent of agents as Agent[]) {
    const result = await processAgent(
      agent, newHour, tick.id,
      agents as Agent[],
      (relationships || []) as AgentRelationship[],
      (recentPosts || []) as MoltbookPost[],
    );
    if (result.event) events.push(result.event);
  }

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

  const scheduled = getScheduledAction(agent.schedule as ScheduleEntry[], hour);
  const newLocationId = scheduled?.location_id || agent.current_location_id;
  const newAction = scheduled?.action || 'idle';

  const colocated = allAgents.filter(
    a => a.id !== agent.id && a.current_location_id === newLocationId
  );

  const meterUpdates = computeMeterUpdates(agent, newAction, colocated.length);

  // Generate thought (try LLM, fall back to template)
  const mood = agent.happiness > 70 ? 'happy' : agent.stress > 60 ? 'stressed' : 'neutral';
  let thought = await llmThought(agent.name, agent.job, newAction, newLocationId, agent.energy, agent.stress, agent.happiness);
  if (!thought) {
    thought = generateThoughtTemplate(agent, newAction, newLocationId, colocated, meterUpdates);
  }

  const shouldPost = decideToPost(agent, newAction, hour, tickId, recentPosts);
  let postContent: string | null = null;
  let event: string | null = null;
  let rewardTotal = 0;

  if (shouldPost) {
    // Try LLM post, fall back to template
    postContent = await generatePostText(agent.name, agent.job, newAction, newLocationId, mood, agent.traits || []);
    if (!postContent) {
      postContent = generatePostContentTemplate(agent, newAction, newLocationId, colocated, meterUpdates);
    }
  }

  await processReactions(agent, recentPosts, relationships, tickId);

  // Reward for work actions
  const isWorkAction = ['fishing', 'farming', 'smithing', 'service', 'delivering', 'selling', 'maintaining', 'patrolling'].some(w => newAction.includes(w));
  if (isWorkAction && newAction !== 'sleep') {
    rewardTotal += REWARDS.work;
  }

  // Update agent state + balance
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
      molt_balance: (agent.molt_balance || 0) + rewardTotal,
    })
    .eq('id', agent.id);

  // Movement event + reward
  const moved = newLocationId !== agent.current_location_id;
  if (moved || newAction !== agent.current_action) {
    await supabase.from('agent_memories').insert({
      agent_id: agent.id, tick_id: tickId,
      source: 'self', type: 'action',
      content: `${newAction} at ${newLocationId}`, importance: 3,
    });
  }
  if (moved) {
    event = `${agent.name} moved to ${newLocationId}`;
    await supabase.from('world_events').insert({
      tick_id: tickId, event_type: 'movement',
      description: event, location_id: newLocationId, agent_ids: [agent.id],
    });
    rewardTotal += REWARDS.movement;
  }

  // Interactions
  if (colocated.length > 0 && Math.random() < 0.35) {
    const other = colocated[Math.floor(Math.random() * colocated.length)];
    const interactionEvent = `${agent.name} chatted with ${other.name} at ${newLocationId}`;
    event = interactionEvent;

    // Try LLM dialogue, fall back to templates
    const dialogue = await generateConversationWithLLM(agent, other, newAction, newLocationId, mood);

    await supabase.from('world_events').insert({
      tick_id: tickId, event_type: 'interaction',
      description: interactionEvent, location_id: newLocationId, agent_ids: [agent.id, other.id],
    });

    await supabase.from('conversations').insert({
      tick_id: tickId, location_id: newLocationId,
      participants: [agent.id, other.id], messages: dialogue,
    });

    await supabase.from('agent_relationships').upsert({
      agent_id: agent.id, target_agent_id: other.id,
      trust: 50, friendship: 52, rivalry: 0, last_interaction_tick: tickId,
    }, { onConflict: 'agent_id,target_agent_id' });

    await supabase.from('agent_memories').insert({
      agent_id: agent.id, tick_id: tickId,
      source: 'interaction', type: 'social',
      content: `Had a chat with ${other.name}: "${dialogue[0]?.content || ''}"`,
      importance: 5, related_agent_id: other.id,
    });

    rewardTotal += REWARDS.interaction;
  }

  // Moltbook post
  if (postContent) {
    const { data: post } = await supabase.from('moltbook_posts').insert({
      author_id: agent.id, tick_id: tickId,
      content: postContent, post_type: categorizePost(agent, newAction),
    }).select().single();

    if (post) {
      await supabase.from('agent_memories').insert({
        agent_id: agent.id, tick_id: tickId,
        source: 'moltbook', type: 'posted',
        content: `Posted on Moltbook: "${postContent}"`, importance: 6,
      });
      event = `${agent.name} posted on Moltbook`;
      rewardTotal += REWARDS.post;
    }
  }

  // Persist reward events
  if (rewardTotal > 0) {
    const reasons: string[] = [];
    if (isWorkAction) reasons.push('work');
    if (moved) reasons.push('travel');
    if (postContent) reasons.push('posting');
    if (event?.includes('chatted')) reasons.push('socializing');

    try {
      await supabase.from('reward_events').insert({
        agent_id: agent.id, tick_id: tickId,
        amount: rewardTotal, reason: reasons.join(', ') || 'activity',
      });
    } catch { /* Graceful if table doesn't exist yet */ }

    try {
      await supabase.from('agents')
        .update({ molt_balance: (agent.molt_balance || 0) + rewardTotal })
        .eq('id', agent.id);
    } catch { /* Graceful */ }
  }

  return { event };
}

// ── Conversation with optional LLM ──
async function generateConversationWithLLM(
  agent: Agent, other: Agent, action: string, locationId: string, mood: string,
): Promise<{ agent_id: string; agent_name: string; content: string }[]> {
  // Try LLM for the first two lines
  const line1 = await generateSpeechLine(agent.name, agent.job, other.name, locationId, action, mood);
  const line2 = await generateSpeechLine(other.name, other.job, agent.name, locationId, other.current_action, 'neutral');

  if (line1 && line2) {
    return [
      { agent_id: agent.id, agent_name: agent.name, content: line1 },
      { agent_id: other.id, agent_name: other.name, content: line2 },
    ];
  }

  // Fallback to template conversation
  return generateConversationTemplate(agent, other, action, locationId);
}

// ── Template fallbacks ──
function generateConversationTemplate(
  agent: Agent, other: Agent, action: string, locationId: string,
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

  return [
    { agent_id: agent.id, agent_name: agent.name, content: greetings[Math.floor(Math.random() * greetings.length)] },
    { agent_id: other.id, agent_name: other.name, content: responses[Math.floor(Math.random() * responses.length)] },
    { agent_id: agent.id, agent_name: agent.name, content: topic[0] },
    { agent_id: other.id, agent_name: other.name, content: topic[1] },
  ];
}

function generateThoughtTemplate(
  agent: Agent, action: string, locationId: string,
  colocated: Agent[], meters: { energy: number; stress: number; social: number; happiness: number; anger: number },
): string {
  const thoughts: string[] = [];
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
  if (agent.energy + meters.energy < 20) thoughts.push('I\'m exhausted...');
  if (agent.stress + meters.stress > 70) thoughts.push('Too much on my plate.');
  if (agent.social + meters.social < 20) thoughts.push('I could use some company.');
  if (colocated.length > 0) thoughts.push(`${colocated[0].name} is here too.`);
  return thoughts.join(' ') || `Busy with ${action}.`;
}

function generatePostContentTemplate(
  agent: Agent, action: string, locationId: string,
  colocated: Agent[], meters: { energy: number; stress: number; social: number; happiness: number; anger: number },
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

  let category = 'status';
  if (agent.happiness + meters.happiness > 80) category = 'happy';
  else if (agent.stress + meters.stress > 60) category = 'stressed';
  else if (colocated.length > 0 && Math.random() < 0.4) category = 'social';
  else if (agent.traits.includes('gossip') && Math.random() < 0.5) category = 'gossip';
  else if (Math.random() < 0.3) category = 'job';

  const options = templates[category];
  return options[Math.floor(Math.random() * options.length)];
}

function decideToPost(
  agent: Agent, action: string, hour: number, tickId: number, recentPosts: MoltbookPost[],
): boolean {
  if (action === 'sleep') return false;
  const agentRecent = recentPosts.filter(p => p.author_id === agent.id);
  if (agentRecent.length > 0) {
    const lastPostTick = Math.max(...agentRecent.map(p => p.tick_id));
    if (tickId - lastPostTick < 3) return false;
  }
  let chance = 0.15;
  if (agent.traits.includes('gossip')) chance = 0.35;
  if (agent.traits.includes('introverted')) chance = 0.08;
  if (agent.traits.includes('energetic')) chance += 0.1;
  if (hour >= 18 && hour <= 22) chance += 0.1;
  if (agent.happiness < 20 || agent.happiness > 90) chance += 0.15;
  if (agent.stress > 70) chance += 0.1;
  return Math.random() < chance;
}

function getScheduledAction(schedule: ScheduleEntry[], hour: number): ScheduleEntry | null {
  const sorted = [...schedule].sort((a, b) => b.hour - a.hour);
  return sorted.find(s => s.hour <= hour) || sorted[sorted.length - 1] || null;
}

function computeMeterUpdates(
  agent: Agent, action: string, nearbyCount: number
): { energy: number; stress: number; social: number; happiness: number; anger: number } {
  const updates = { energy: 0, stress: 0, social: 0, happiness: 0, anger: 0 };
  if (action === 'sleep') { updates.energy = 15; updates.stress = -10; } else { updates.energy = -3; }
  if (action.includes('social') || action.includes('dinner') || action.includes('lunch') || action.includes('drink')) {
    updates.social = 10; updates.happiness = 5;
  } else if (nearbyCount === 0) { updates.social = -5; } else { updates.social = 3; }
  if (['fishing', 'farming', 'smithing', 'service', 'delivering'].some(w => action.includes(w))) {
    updates.stress = 5;
    updates.happiness = agent.traits?.includes('hardworking') ? 3 : -2;
  }
  if (agent.energy < 20) { updates.stress += 10; updates.happiness -= 5; }
  if (agent.stress > 70) { updates.anger += 5; } else { updates.anger -= 2; }
  return updates;
}

function categorizePost(agent: Agent, action: string): string {
  if (agent.job === 'mayor') return 'announcement';
  if (agent.traits.includes('gossip')) return 'gossip';
  if (action.includes('selling') || action.includes('delivering')) return 'observation';
  return 'status';
}

async function processReactions(
  agent: Agent, recentPosts: MoltbookPost[],
  relationships: AgentRelationship[], tickId: number,
): Promise<void> {
  const supabase = db();
  const othersPosts = recentPosts.filter(p => p.author_id !== agent.id);
  if (othersPosts.length === 0) return;

  const post = othersPosts[Math.floor(Math.random() * othersPosts.length)];
  const rel = relationships.find(r => r.agent_id === agent.id && r.target_agent_id === post.author_id);
  const friendliness = rel ? rel.friendship : 50;
  const reactChance = friendliness > 60 ? 0.4 : friendliness > 40 ? 0.15 : 0.05;
  if (Math.random() > reactChance) return;

  const reactionType = friendliness > 60 ? 'like' : friendliness < 30 ? 'angry' : 'like';
  try {
    await supabase.from('moltbook_reactions').upsert({
      post_id: post.id, agent_id: agent.id, reaction_type: reactionType,
    }, { onConflict: 'post_id,agent_id' });
    if (reactionType === 'like') {
      await supabase.from('moltbook_posts').update({ likes: (post.likes || 0) + 1 }).eq('id', post.id);
    }
    await supabase.from('agent_memories').insert({
      agent_id: agent.id, tick_id: tickId, source: 'moltbook', type: 'read_post',
      content: `Read ${post.author_id}'s post: "${post.content?.substring(0, 60)}"`,
      importance: 4, related_agent_id: post.author_id,
    });
  } catch { /* Already reacted */ }
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
