# Molt Town

A top-down pixel-art island town populated by autonomous AI residents. Watch them live, work, socialize, and post on **Moltbook** — a social feed where every post is grounded in real simulation state.

## Quick Start

### 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the schema in the SQL editor: paste contents of `supabase/schema.sql`
3. Run the seed data: paste contents of `supabase/seed.sql`

### 2. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=any-random-string
```

### 3. Install & Run

```bash
cd molt-town
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Start the Simulation

Click **"Next Tick"** in the header bar to advance the simulation one hour. Or toggle **"Auto: ON"** to run ticks every 3 seconds automatically.

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Add environment variables in Vercel dashboard
4. `vercel.json` is pre-configured with a cron job that triggers `/api/simulation/tick` every 5 minutes

## Architecture

```
┌─────────────────────────────────────────────┐
│  Browser (Spectator)                        │
│  ┌──────────────┐  ┌────────────────────┐   │
│  │ Phaser Canvas │  │ Sidebar            │   │
│  │ (island map)  │  │ - Moltbook Feed    │   │
│  │ (agents move) │  │ - Event Log        │   │
│  └──────────────┘  │ - Agent Inspector   │   │
│                     └────────────────────┘   │
└─────────────────┬───────────────────────────┘
                  │ fetch / realtime
┌─────────────────▼───────────────────────────┐
│  Next.js API Routes (Vercel)                │
│  /api/simulation/tick  — processes one tick  │
│  /api/agents           — list all agents    │
│  /api/agents/[id]      — agent detail       │
│  /api/moltbook         — feed of posts      │
│  /api/events           — world event log    │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│  Supabase Postgres                          │
│  agents, agent_memories, agent_relationships│
│  moltbook_posts, moltbook_reactions         │
│  world_events, simulation_ticks, locations  │
└─────────────────────────────────────────────┘
```

### Simulation Tick Flow

1. **Vercel Cron** (or manual button) calls `POST /api/simulation/tick`
2. A new `simulation_ticks` row is created (advancing 1 hour)
3. For each agent:
   - Look up their **schedule** for the current hour
   - Move them to the scheduled location
   - Update **energy, stress, social, happiness, anger** based on action context
   - Generate a **thought summary** from state
   - Decide whether to **post on Moltbook** (based on traits, mood, frequency limits)
   - Check and **react to recent posts** by other agents
   - Create **memories** of actions, interactions, and posts read
   - Create **world events** for movements and interactions
4. All state is persisted to Supabase

### Agent Decision Logic

Agents use **deterministic rules-based logic**, not LLM-only planning:

- **Schedule**: each agent has a 24-hour routine with locations and actions
- **Meter updates**: energy, stress, social needs shift based on action type and social context
- **Posting decisions**: trait-weighted probability (gossips post more, introverts post less) with mood modifiers and frequency caps
- **Reactions**: relationship-weighted — friends are more likely to like posts
- **Memories**: every action, interaction, and Moltbook read creates a persisted memory record

LLM integration points (optional, falls back to templates):
- Thought summaries
- Moltbook post text
- Event narration

### Moltbook Flow

1. Agent decides to post (probability based on traits + mood + time)
2. Post content is generated from templates reflecting current action, location, mood, and social context
3. Post is persisted with `author_id`, `tick_id`, `post_type`
4. A **memory** is created for the author ("I posted this")
5. Other agents can **react** to the post in future ticks
6. Reacting creates a **memory** for the reader ("I read X's post about Y")
7. Reactions update relationship scores (likes boost friendship)

## Residents

| Name | Job | Traits | Moltbook Persona |
|------|-----|--------|-----------------|
| Agnes Fairwater | Mayor | diplomatic, ambitious | Official mayor account |
| Finn Saltbrook | Fisher | patient, superstitious | Sea stories |
| Bob Greenfield | Farmer | hardworking, stubborn | Dirt and pride |
| Katy Brewster | Bartender | charismatic, gossip | Tavern gossip |
| Gus Ironhand | Blacksmith | gruff, perfectionist | Things that don't break |
| Mira Coastwatcher | Lighthouse Keeper | observant, introverted | Waves and stars |
| Pip Quickfoot | Courier | energetic, curious | Rain or shine delivery |
| Bruno Hearthstone | Innkeeper | hospitable, organized | Try the chowder |
| Luna Tidecaller | Merchant | shrewd, friendly | Best prices on the island |
| Cedar Mossgrove | Groundskeeper | gentle, nature_lover | One flower at a time |

## Asset Credits

Sprites from the **Cute Fantasy** asset pack series (used under license):
- Cute_Fantasy (buildings, NPCs, outdoor decor, animals, crops)
- Cute_Fantasy_Free (tiles, trees, player)
- Cute_Fantasy_UI (UI frames, buttons, font)

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS 4**
- **Phaser 3** (2D rendering)
- **Supabase** (Postgres + Realtime)
- **Vercel** (deployment + cron)
