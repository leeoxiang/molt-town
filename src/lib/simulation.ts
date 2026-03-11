import { getServiceSupabase } from './supabase';
import { resetTickCalls, generateSpeechLine, generatePostText, generateThought as llmThought } from './openrouter';
import { postToMoltbook } from './moltbook-api';
import type { Agent, ScheduleEntry, AgentRelationship, MoltbookPost } from '@/types';

const db = () => getServiceSupabase();

// Reward amounts (simulated MOLTTOWN credits)
const REWARDS = {
  work: 5,
  interaction: 3,
  post: 2,
  reaction: 1,
  movement: 1,
};

// Personality dimension weights — each trait maps to personality modifiers
const PERSONALITY: Record<string, { sociable: number; diligent: number; gossippy: number; creative: number; anxious: number }> = {
  'hardworking':  { sociable: 0,  diligent: 2,  gossippy: 0,  creative: 0,  anxious: 0 },
  'gossip':       { sociable: 1,  diligent: -1, gossippy: 3,  creative: 0,  anxious: 0 },
  'friendly':     { sociable: 2,  diligent: 0,  gossippy: 0,  creative: 0,  anxious: -1 },
  'introverted':  { sociable: -2, diligent: 1,  gossippy: -1, creative: 1,  anxious: 1 },
  'energetic':    { sociable: 1,  diligent: 1,  gossippy: 0,  creative: 1,  anxious: -1 },
  'cautious':     { sociable: -1, diligent: 1,  gossippy: 0,  creative: 0,  anxious: 2 },
  'creative':     { sociable: 0,  diligent: 0,  gossippy: 0,  creative: 3,  anxious: 0 },
  'stoic':        { sociable: -1, diligent: 2,  gossippy: -2, creative: 0,  anxious: -1 },
  'cheerful':     { sociable: 1,  diligent: 0,  gossippy: 1,  creative: 1,  anxious: -2 },
  'grumpy':       { sociable: -2, diligent: 1,  gossippy: 1,  creative: 0,  anxious: 1 },
  'curious':      { sociable: 1,  diligent: 0,  gossippy: 1,  creative: 2,  anxious: 0 },
  'superstitious':{ sociable: 0,  diligent: 0,  gossippy: 2,  creative: 1,  anxious: 2 },
  'practical':    { sociable: 0,  diligent: 2,  gossippy: -1, creative: -1, anxious: -1 },
  'ambitious':    { sociable: 0,  diligent: 2,  gossippy: 0,  creative: 1,  anxious: 1 },
};

function getPersonality(agent: Agent) {
  const scores = { sociable: 0, diligent: 0, gossippy: 0, creative: 0, anxious: 0 };
  for (const trait of (agent.traits || [])) {
    const p = PERSONALITY[trait];
    if (p) {
      scores.sociable += p.sociable;
      scores.diligent += p.diligent;
      scores.gossippy += p.gossippy;
      scores.creative += p.creative;
      scores.anxious += p.anxious;
    }
  }
  return scores;
}

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
  const personality = getPersonality(agent);

  const scheduled = getScheduledAction(agent.schedule as ScheduleEntry[], hour);
  const newLocationId = scheduled?.location_id || agent.current_location_id;
  const newAction = scheduled?.action || 'idle';

  const colocated = allAgents.filter(
    a => a.id !== agent.id && a.current_location_id === newLocationId
  );

  const meterUpdates = computeMeterUpdates(agent, newAction, colocated.length, personality);

  // Generate thought (try LLM, fall back to template)
  const mood = agent.happiness > 70 ? 'happy' : agent.stress > 60 ? 'stressed' : 'neutral';
  let thought = await llmThought(agent.name, agent.job, newAction, newLocationId, agent.energy, agent.stress, agent.happiness);
  if (!thought) {
    thought = generateThoughtTemplate(agent, newAction, newLocationId, colocated, meterUpdates, personality);
  }

  const shouldPost = decideToPost(agent, newAction, hour, tickId, recentPosts, personality);
  let postContent: string | null = null;
  let event: string | null = null;
  let rewardTotal = 0;

  if (shouldPost) {
    postContent = await generatePostText(agent.name, agent.job, newAction, newLocationId, mood, agent.traits || []);
    if (!postContent) {
      postContent = generatePostContentTemplate(agent, newAction, newLocationId, colocated, meterUpdates, personality);
    }
  }

  await processReactions(agent, recentPosts, relationships, tickId, personality);

  // Reward for work actions
  const isWorkAction = ['fishing', 'farming', 'smithing', 'service', 'delivering', 'selling', 'maintaining', 'patrolling'].some(w => newAction.includes(w));
  if (isWorkAction && newAction !== 'sleep') {
    rewardTotal += REWARDS.work;
    // Diligent agents earn a bonus
    if (personality.diligent > 1) rewardTotal += 2;
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

  // Interactions — personality-driven chance (kept low so conversations feel staggered)
  const interactChance = 0.12 + (personality.sociable * 0.04);
  if (colocated.length > 0 && Math.random() < clamp(interactChance, 0.05, 0.30)) {
    // Sociable agents prefer friends; introverted pick randomly
    let other: Agent;
    if (personality.sociable > 1 && relationships.length > 0) {
      const friends = colocated.filter(a =>
        relationships.some(r => r.agent_id === agent.id && r.target_agent_id === a.id && r.friendship > 55)
      );
      other = friends.length > 0
        ? friends[Math.floor(Math.random() * friends.length)]
        : colocated[Math.floor(Math.random() * colocated.length)];
    } else {
      other = colocated[Math.floor(Math.random() * colocated.length)];
    }

    const interactionEvent = `${agent.name} chatted with ${other.name} at ${newLocationId}`;
    event = interactionEvent;

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
      content: postContent, post_type: categorizePost(agent, newAction, personality),
    }).select().single();

    if (post) {
      await supabase.from('agent_memories').insert({
        agent_id: agent.id, tick_id: tickId,
        source: 'moltbook', type: 'posted',
        content: `Posted on Moltbook: "${postContent}"`, importance: 6,
      });
      event = `${agent.name} posted on Moltbook`;
      rewardTotal += REWARDS.post;

      // Cross-post to moltbook.com (fire-and-forget, never blocks tick)
      postToMoltbook(
        agent.id,
        `${agent.name} — ${agent.job} at ${newLocationId}`,
        postContent,
      ).catch(() => {});
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
  const line1 = await generateSpeechLine(agent.name, agent.job, other.name, locationId, action, mood);
  const line2 = await generateSpeechLine(other.name, other.job, agent.name, locationId, other.current_action, 'neutral');

  if (line1 && line2) {
    return [
      { agent_id: agent.id, agent_name: agent.name, content: line1 },
      { agent_id: other.id, agent_name: other.name, content: line2 },
    ];
  }

  return generateConversationTemplate(agent, other, action, locationId);
}

// ── Template fallbacks ──
function generateConversationTemplate(
  agent: Agent, other: Agent, action: string, locationId: string,
): { agent_id: string; agent_name: string; content: string }[] {
  const a1 = agent.name.split(' ')[0];
  const a2 = other.name.split(' ')[0];

  const greetings = [
    `Hey ${a2}!`,
    `Morning, ${a2}.`,
    `Oh, ${a2}! Good to see you.`,
    `${a2}, how's it going?`,
    `There you are, ${a2}. Been looking for you.`,
    `${a2}! Just the person I wanted to see.`,
    `Well if it isn't ${a2}.`,
    `Fancy running into you here, ${a2}.`,
  ];
  const responses = [
    `Hey! Not bad, just ${other.current_action}.`,
    `Oh hi! Pretty good, thanks.`,
    `Can't complain. Busy day though.`,
    `Good to see you too! What brings you here?`,
    `${a1}! I was just thinking about you.`,
    `Hey yourself. Long day.`,
    `Oh hey. Pull up a chair.`,
    `Not bad, not bad. How about you?`,
  ];
  const topics: Record<string, string[][]> = {
    tavern: [
      [`Have you tried the new chowder?`, `Not yet, is it any good?`],
      [`Busy night tonight.`, `Yeah, everyone's out.`],
      [`I heard Bruno's testing a new recipe.`, `Oh? Last time that happened we all got stomach aches.`],
      [`Katy was telling me the funniest story earlier.`, `She always has the best gossip.`],
      [`Think the mayor will stop by tonight?`, `Agnes? She usually does after a long day.`],
      [`This place really comes alive at night.`, `Best tavern on the island. Only tavern, but still.`],
      [`Another round?`, `You read my mind.`],
      [`I swear the chowder gets better every week.`, `Bruno's been experimenting. Don't tell him I said that.`],
    ],
    market: [
      [`Prices seem high today.`, `Supply's been low this week.`],
      [`Seen anything good at the stalls?`, `Luna has some nice shells.`],
      [`The market feels busier than usual.`, `Word is a shipment came in at the docks.`],
      [`I need to pick up some supplies.`, `Check Luna's stall — she had a good haul yesterday.`],
      [`Have you noticed the new vendor?`, `Which one? The one with the strange herbs?`],
      [`MOLTTOWN prices are going up.`, `Everyone's been mining hard this week.`],
      [`I love market days.`, `Me too. You can learn everything about the town just by standing here.`],
    ],
    farm: [
      [`The crops are looking great this season.`, `Bob knows what he's doing.`],
      [`Think we'll get rain soon?`, `Hope so, the soil's getting dry.`],
      [`Smell that? Fresh earth. Nothing better.`, `You sound like Bob. He says the same thing every morning.`],
      [`The windmill needs some repairs.`, `I'll mention it to Gus. He can fix anything.`],
      [`Look at those sunflowers.`, `Cedar planted those last season. Beautiful, aren't they?`],
      [`Hard work out here, but honest work.`, `That's the farmer's life.`],
    ],
    docks: [
      [`Catch anything today?`, `A few, but nothing special.`],
      [`The tide's coming in fast.`, `Better secure the boats.`],
      [`See that ship on the horizon?`, `Could be traders. Or could be nothing.`],
      [`Finn told me about a fish the size of a barrel.`, `That man's stories get bigger every day.`],
      [`The sea air always clears my head.`, `Same. I come here whenever I need to think.`],
      [`Storm coming?`, `The clouds are building. Could be a rough night.`],
      [`The docks need some work. Planks are getting soft.`, `I'll bring it up at the next town meeting.`],
    ],
    beach: [
      [`The sunset from here is something else.`, `Best view on the island.`],
      [`Found any good shells today?`, `A few. Luna might want them for her stall.`],
      [`I could sit here all day.`, `Don't let the mayor catch you slacking.`],
      [`The water's warm today.`, `Perfect weather. Wish every day was like this.`],
      [`Cedar keeps this beach spotless.`, `That man loves this island more than anyone.`],
    ],
    smithy: [
      [`What's Gus working on today?`, `Some kind of tool. He won't say what.`],
      [`The heat from that forge is intense.`, `You get used to it. Gus doesn't even break a sweat.`],
      [`I ordered a new blade last week.`, `Gus does fine work. It'll be worth the wait.`],
      [`The sound of the hammer is oddly soothing.`, `Until you've heard it for eight hours straight.`],
    ],
    mayor: [
      [`Agnes has been busy lately.`, `Running a town is no small task.`],
      [`Think the mayor would approve the new dock plan?`, `Hard to say. She's cautious with the budget.`],
      [`The mayor's house always looks so proper.`, `Agnes runs a tight ship. Town and home.`],
    ],
    lighthouse: [
      [`Can you see the mainland from up there?`, `On a clear day, yes. It's beautiful.`],
      [`Mira's been keeping watch for years.`, `This island wouldn't be the same without her.`],
      [`The light was flickering last night.`, `Mira fixed it by dawn. She always does.`],
      [`It must get lonely up here.`, `Mira says the stars keep her company.`],
    ],
    default: [
      [`How's work been?`, `Same as always. You?`],
      [`Nice weather today.`, `Yeah, perfect for being outside.`],
      [`Heard any news?`, `Nothing much. Quiet day.`],
      [`This island gets more interesting every day.`, `Never a dull moment in Molt Town.`],
      [`I've been mining a lot of MOLTTOWN lately.`, `Same here. The economy's booming.`],
      [`Did you see the Moltbook post from earlier?`, `Ha! Yeah, that was something.`],
      [`I should visit the tavern later.`, `I'll join you. Could use a break.`],
      [`What do you think of the new workers in town?`, `Fresh faces are always welcome. More hands, more tokens.`],
      [`Sometimes I forget how small this island is.`, `Small, but it's home.`],
      [`The town's really grown lately.`, `More people, more stories. I like it.`],
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
  colocated: Agent[],
  meters: { energy: number; stress: number; social: number; happiness: number; anger: number },
  personality: { sociable: number; diligent: number; gossippy: number; creative: number; anxious: number },
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

  // Personality-colored thoughts
  if (personality.anxious > 1 && agent.stress > 40) thoughts.push('Something feels off today...');
  if (personality.creative > 1 && Math.random() < 0.3) thoughts.push('I have an idea brewing...');
  if (personality.gossippy > 1 && colocated.length > 0) thoughts.push(`I wonder what ${colocated[0].name.split(' ')[0]} has been up to...`);
  if (personality.diligent > 1 && action !== 'sleep') thoughts.push('Must keep at it. No shortcuts.');

  if (agent.energy + meters.energy < 20) thoughts.push('I\'m exhausted...');
  if (agent.stress + meters.stress > 70) thoughts.push('Too much on my plate.');
  if (agent.social + meters.social < 20 && personality.sociable > 0) thoughts.push('I could use some company.');
  if (colocated.length > 0 && personality.sociable >= 0) thoughts.push(`${colocated[0].name} is here too.`);
  return thoughts.join(' ') || `Busy with ${action}.`;
}

function generatePostContentTemplate(
  agent: Agent, action: string, locationId: string,
  colocated: Agent[],
  meters: { energy: number; stress: number; social: number; happiness: number; anger: number },
  personality: { sociable: number; diligent: number; gossippy: number; creative: number; anxious: number },
): string {
  const templates: Record<string, string[]> = {
    work: [
      `Another solid day of ${agent.job} work. Earned my MOLTTOWN today.`,
      `${action} keeps the town running. ${agent.goals[0] || 'Keeping busy.'}`,
      `The ${agent.job} grind never stops. Pro tip: ${action} with care.`,
      `Hard at work ${action}. This is how we earn in Molt Town.`,
    ],
    status: [
      `Currently ${action}. Life in Molt Town continues.`,
      `${action} at the ${locationId}. Not bad.`,
    ],
    happy: [
      `Having a great day! ${action} is going well.`,
      `Love this island. ${action} with a smile.`,
    ],
    stressed: [
      `${action} is wearing me out today...`,
      `Does anyone else feel like there's too much to do?`,
    ],
    social: [
      `Great seeing ${colocated[0]?.name || 'everyone'} at the ${locationId}!`,
      `Good company at the ${locationId} today.`,
    ],
    gossip: [
      `Has anyone noticed anything different about the ${locationId} lately?`,
      `Heard some interesting things at the ${locationId} today...`,
      `The things you overhear while ${action}...`,
    ],
    creative: [
      `Had a flash of inspiration while ${action}. The ${locationId} has a certain energy...`,
      `There's beauty in the everyday. Even ${action} has its rhythms.`,
    ],
    mining: [
      `Mined some MOLTTOWN today from ${action}. Every token counts.`,
      `The MOLTTOWN economy is growing. My balance is looking healthy.`,
      `Working hard, mining MOLTTOWN. The ${agent.job} life pays.`,
    ],
  };

  // Personality-driven category selection
  let category = 'status';
  const isWork = ['fishing', 'farming', 'smithing', 'service', 'delivering', 'selling', 'maintaining', 'patrolling'].some(w => action.includes(w));

  if (isWork && Math.random() < 0.4 + personality.diligent * 0.1) category = 'work';
  else if (isWork && Math.random() < 0.25) category = 'mining';
  else if (agent.happiness + meters.happiness > 80) category = 'happy';
  else if (agent.stress + meters.stress > 60) category = 'stressed';
  else if (colocated.length > 0 && personality.sociable > 0 && Math.random() < 0.4) category = 'social';
  else if (personality.gossippy > 1 && Math.random() < 0.5) category = 'gossip';
  else if (personality.creative > 1 && Math.random() < 0.35) category = 'creative';
  else if (Math.random() < 0.2) category = 'mining';

  const options = templates[category];
  return options[Math.floor(Math.random() * options.length)];
}

function decideToPost(
  agent: Agent, action: string, hour: number, tickId: number,
  recentPosts: MoltbookPost[],
  personality: { sociable: number; diligent: number; gossippy: number; creative: number; anxious: number },
): boolean {
  if (action === 'sleep') return false;

  // Cooldown: at least 4 ticks between posts (was 3)
  const agentRecent = recentPosts.filter(p => p.author_id === agent.id);
  if (agentRecent.length > 0) {
    const lastPostTick = Math.max(...agentRecent.map(p => p.tick_id));
    if (tickId - lastPostTick < 4) return false;
  }

  // Max 2 posts per agent in recent window
  if (agentRecent.length >= 2) return false;

  // Base chance lowered to prevent spam
  let chance = 0.10;

  // Personality modifiers
  if (personality.gossippy > 1) chance += 0.15;
  if (personality.creative > 1) chance += 0.08;
  if (personality.sociable < -1) chance -= 0.05; // introverts post less
  if (personality.diligent > 1 && ['fishing', 'farming', 'smithing', 'service', 'delivering', 'selling'].some(w => action.includes(w))) {
    chance += 0.1; // diligent agents post about work
  }

  // Time-of-day modifier: more posts during social hours
  if (hour >= 18 && hour <= 22) chance += 0.08;
  if (hour >= 12 && hour <= 14) chance += 0.05;

  // Emotional triggers
  if (agent.happiness < 20 || agent.happiness > 90) chance += 0.1;
  if (agent.stress > 70 && personality.anxious > 0) chance += 0.08;

  return Math.random() < clamp(chance, 0.03, 0.35);
}

function getScheduledAction(schedule: ScheduleEntry[], hour: number): ScheduleEntry | null {
  const sorted = [...schedule].sort((a, b) => b.hour - a.hour);
  return sorted.find(s => s.hour <= hour) || sorted[sorted.length - 1] || null;
}

function computeMeterUpdates(
  agent: Agent, action: string, nearbyCount: number,
  personality: { sociable: number; diligent: number; gossippy: number; creative: number; anxious: number },
): { energy: number; stress: number; social: number; happiness: number; anger: number } {
  const updates = { energy: 0, stress: 0, social: 0, happiness: 0, anger: 0 };
  if (action === 'sleep') { updates.energy = 15; updates.stress = -10; } else { updates.energy = -3; }
  if (action.includes('social') || action.includes('dinner') || action.includes('lunch') || action.includes('drink')) {
    updates.social = 10 + personality.sociable;
    updates.happiness = 5;
  } else if (nearbyCount === 0) {
    updates.social = personality.sociable > 0 ? -7 : -2; // sociable agents lose more social when alone
  } else {
    updates.social = 3 + personality.sociable;
  }
  if (['fishing', 'farming', 'smithing', 'service', 'delivering'].some(w => action.includes(w))) {
    updates.stress = 5 - personality.diligent; // diligent agents stress less from work
    updates.happiness = personality.diligent > 1 ? 3 : -2;
  }
  if (agent.energy < 20) { updates.stress += 10; updates.happiness -= 5; }
  if (agent.stress > 70) { updates.anger += 5 + personality.anxious; } else { updates.anger -= 2; }
  return updates;
}

function categorizePost(
  agent: Agent, action: string,
  personality: { sociable: number; diligent: number; gossippy: number; creative: number; anxious: number },
): string {
  if (agent.job === 'mayor') return 'announcement';
  if (personality.gossippy > 1 && Math.random() < 0.5) return 'gossip';
  if (['selling', 'delivering', 'fishing', 'farming', 'smithing'].some(w => action.includes(w))) return 'observation';
  return 'status';
}

async function processReactions(
  agent: Agent, recentPosts: MoltbookPost[],
  relationships: AgentRelationship[], tickId: number,
  personality: { sociable: number; diligent: number; gossippy: number; creative: number; anxious: number },
): Promise<void> {
  const supabase = db();
  const othersPosts = recentPosts.filter(p => p.author_id !== agent.id);
  if (othersPosts.length === 0) return;

  const post = othersPosts[Math.floor(Math.random() * othersPosts.length)];
  const rel = relationships.find(r => r.agent_id === agent.id && r.target_agent_id === post.author_id);
  const friendliness = rel ? rel.friendship : 50;

  // Sociable agents react more
  let reactChance = friendliness > 60 ? 0.4 : friendliness > 40 ? 0.15 : 0.05;
  reactChance += personality.sociable * 0.05;

  if (Math.random() > clamp(reactChance, 0.02, 0.6)) return;

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
