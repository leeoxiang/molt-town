// ── Location ──
export interface Location {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  description: string;
}

// ── Agent ──
export interface Agent {
  id: string;
  name: string;
  job: string;
  home_location_id: string;
  current_location_id: string;
  current_action: string;
  sprite_key: string;
  traits: string[];
  goals: string[];
  schedule: ScheduleEntry[];
  energy: number;
  stress: number;
  social: number;
  happiness: number;
  anger: number;
  reputation: number;
  current_thought: string;
  moltbook_persona: string;
  created_at: string;
}

export interface ScheduleEntry {
  hour: number;
  location_id: string;
  action: string;
}

// ── Relationships ──
export interface AgentRelationship {
  id: string;
  agent_id: string;
  target_agent_id: string;
  trust: number;
  friendship: number;
  rivalry: number;
  last_interaction_tick: number | null;
}

// ── Memories ──
export interface AgentMemory {
  id: string;
  agent_id: string;
  tick_id: number;
  source: 'event' | 'moltbook' | 'interaction' | 'self';
  type: string;
  content: string;
  importance: number;
  related_agent_id: string | null;
  created_at: string;
}

// ── World Events ──
export interface WorldEvent {
  id: string;
  tick_id: number;
  event_type: string;
  description: string;
  location_id: string | null;
  agent_ids: string[];
  created_at: string;
}

// ── Moltbook ──
export interface MoltbookPost {
  id: string;
  author_id: string;
  tick_id: number;
  content: string;
  post_type: 'status' | 'observation' | 'gossip' | 'announcement' | 'reply';
  parent_post_id: string | null;
  likes: number;
  created_at: string;
  // joined
  author_name?: string;
  author_job?: string;
  author_sprite_key?: string;
}

export interface MoltbookReaction {
  id: string;
  post_id: string;
  agent_id: string;
  reaction_type: 'like' | 'dislike' | 'laugh' | 'angry';
  created_at: string;
}

// ── Conversations ──
export interface ConversationMessage {
  agent_id: string;
  agent_name: string;
  content: string;
}

export interface Conversation {
  id: string;
  tick_id: number;
  location_id: string;
  participants: string[];
  messages: ConversationMessage[];
  created_at: string;
}

// ── Simulation ──
export interface SimulationTick {
  id: number;
  sim_hour: number;
  sim_day: number;
  processed_at: string;
  summary: string | null;
}

// ── UI State ──
export interface GameState {
  agents: Agent[];
  locations: Location[];
  events: WorldEvent[];
  posts: MoltbookPost[];
  currentTick: SimulationTick | null;
  selectedAgentId: string | null;
}
