-- Molt Town Seed Data
-- 8 locations, 10 residents

-- ── Locations ──
INSERT INTO locations (id, name, type, x, y, description) VALUES
  ('docks',      'Docks',            'work',    64,  400, 'The island docks where boats arrive and fish are unloaded.'),
  ('tavern',     'Salty Molt Tavern', 'social',  320, 272, 'The central tavern — heart of Molt Town social life.'),
  ('farm',       'Windmill Farm',    'work',    544, 144, 'A small farm with crops, a windmill, and a barn.'),
  ('market',     'Market Square',    'social',  320, 144, 'Open-air market stalls in the town center.'),
  ('mayor',      'Mayor''s House',   'home',    176, 80,  'The mayor''s residence overlooking the town.'),
  ('lighthouse', 'Lighthouse',       'work',    560, 400, 'The tall lighthouse on the eastern cliff.'),
  ('beach',      'Sandy Beach',      'leisure', 64,  272, 'A quiet beach on the west side of the island.'),
  ('smithy',     'Blacksmith Workshop', 'work', 480, 272, 'The forge and workshop where tools are made.')
ON CONFLICT (id) DO NOTHING;

-- ── Initial tick ──
INSERT INTO simulation_ticks (id, sim_hour, sim_day, summary)
VALUES (1, 6, 1, 'Dawn breaks over Molt Town.')
ON CONFLICT (id) DO NOTHING;

-- ── Agents ──
INSERT INTO agents (id, name, job, home_location_id, current_location_id, sprite_key, traits, goals, schedule, moltbook_persona, current_thought) VALUES
(
  'agnes', 'Agnes Fairwater', 'mayor', 'mayor', 'mayor', 'npc_mayor',
  '["diplomatic","ambitious","early_riser"]',
  '["maintain order","grow the town","win re-election"]',
  '[{"hour":6,"location_id":"mayor","action":"morning routine"},{"hour":8,"location_id":"market","action":"inspect market"},{"hour":10,"location_id":"mayor","action":"paperwork"},{"hour":12,"location_id":"tavern","action":"lunch meeting"},{"hour":14,"location_id":"mayor","action":"afternoon duties"},{"hour":18,"location_id":"tavern","action":"evening socializing"},{"hour":22,"location_id":"mayor","action":"sleep"}]',
  'Official account of Mayor Agnes Fairwater. For the people of Molt Town.',
  'Another day of keeping this town running.'
),
(
  'finn', 'Finn Saltbrook', 'fisher', 'docks', 'docks', 'npc_fisher',
  '["patient","superstitious","storyteller"]',
  '["catch enough fish","save for a new boat","find the legendary golden trout"]',
  '[{"hour":4,"location_id":"docks","action":"early fishing"},{"hour":8,"location_id":"docks","action":"sorting catch"},{"hour":10,"location_id":"market","action":"selling fish"},{"hour":12,"location_id":"tavern","action":"lunch"},{"hour":14,"location_id":"docks","action":"afternoon fishing"},{"hour":18,"location_id":"beach","action":"mending nets"},{"hour":21,"location_id":"docks","action":"sleep"}]',
  'Fisher. Storyteller. The sea provides.',
  'The tide looks good today.'
),
(
  'bob', 'Bob Greenfield', 'farmer', 'farm', 'farm', 'npc_farmer',
  '["hardworking","stubborn","generous"]',
  '["grow prize-winning crops","expand the farm","feed the town"]',
  '[{"hour":5,"location_id":"farm","action":"watering crops"},{"hour":8,"location_id":"farm","action":"tending animals"},{"hour":10,"location_id":"market","action":"selling produce"},{"hour":12,"location_id":"farm","action":"lunch break"},{"hour":14,"location_id":"farm","action":"afternoon farming"},{"hour":18,"location_id":"tavern","action":"dinner"},{"hour":21,"location_id":"farm","action":"sleep"}]',
  'Farmer Bob. Dirt under my nails, pride in my heart.',
  'Those tomatoes are coming along nicely.'
),
(
  'katy', 'Katy Brewster', 'bartender', 'tavern', 'tavern', 'npc_bartender',
  '["charismatic","gossip","night_owl"]',
  '["keep the tavern profitable","learn everyones secrets","host the best festival"]',
  '[{"hour":9,"location_id":"tavern","action":"morning prep"},{"hour":11,"location_id":"market","action":"buying supplies"},{"hour":12,"location_id":"tavern","action":"lunch service"},{"hour":14,"location_id":"tavern","action":"afternoon service"},{"hour":18,"location_id":"tavern","action":"evening rush"},{"hour":23,"location_id":"tavern","action":"closing up"},{"hour":1,"location_id":"tavern","action":"sleep"}]',
  'Your friendly bartender at the Salty Molt. Spill the tea.',
  'Wonder what gossip today will bring.'
),
(
  'gus', 'Gus Ironhand', 'blacksmith', 'smithy', 'smithy', 'npc_blacksmith',
  '["gruff","perfectionist","loyal"]',
  '["forge a masterwork blade","teach an apprentice","keep the town equipped"]',
  '[{"hour":6,"location_id":"smithy","action":"stoking forge"},{"hour":8,"location_id":"smithy","action":"smithing"},{"hour":12,"location_id":"tavern","action":"lunch"},{"hour":13,"location_id":"smithy","action":"afternoon smithing"},{"hour":17,"location_id":"market","action":"delivering orders"},{"hour":19,"location_id":"tavern","action":"evening drink"},{"hour":21,"location_id":"smithy","action":"sleep"}]',
  'Gus Ironhand. I make things. They don''t break.',
  'This steel needs more heat.'
),
(
  'mira', 'Mira Coastwatcher', 'lighthouse_keeper', 'lighthouse', 'lighthouse', 'npc_lighthouse',
  '["observant","introverted","bookish"]',
  '["keep ships safe","catalog every star","write her novel"]',
  '[{"hour":5,"location_id":"lighthouse","action":"morning watch"},{"hour":9,"location_id":"beach","action":"beachcombing"},{"hour":11,"location_id":"market","action":"buying supplies"},{"hour":13,"location_id":"lighthouse","action":"reading"},{"hour":17,"location_id":"lighthouse","action":"evening watch"},{"hour":20,"location_id":"lighthouse","action":"stargazing"},{"hour":23,"location_id":"lighthouse","action":"sleep"}]',
  'Keeper of the light. Watcher of waves.',
  'The horizon is so clear today.'
),
(
  'pip', 'Pip Quickfoot', 'courier', 'market', 'market', 'npc_courier',
  '["energetic","curious","clumsy"]',
  '["deliver every package on time","explore the whole island","become the fastest runner"]',
  '[{"hour":7,"location_id":"market","action":"collecting parcels"},{"hour":8,"location_id":"docks","action":"delivering to docks"},{"hour":9,"location_id":"farm","action":"delivering to farm"},{"hour":10,"location_id":"smithy","action":"delivering to smithy"},{"hour":11,"location_id":"lighthouse","action":"delivering to lighthouse"},{"hour":12,"location_id":"tavern","action":"lunch"},{"hour":14,"location_id":"market","action":"afternoon rounds"},{"hour":16,"location_id":"mayor","action":"delivering to mayor"},{"hour":18,"location_id":"beach","action":"relaxing"},{"hour":20,"location_id":"market","action":"sleep"}]',
  'Pip delivers! Rain or shine!',
  'Got a full bag of parcels today!'
),
(
  'bruno', 'Bruno Hearthstone', 'innkeeper', 'tavern', 'tavern', 'npc_innkeeper',
  '["hospitable","organized","nostalgic"]',
  '["make the inn famous","collect recipes from travelers","renovate the upstairs rooms"]',
  '[{"hour":6,"location_id":"tavern","action":"breakfast prep"},{"hour":8,"location_id":"tavern","action":"serving breakfast"},{"hour":10,"location_id":"market","action":"shopping for ingredients"},{"hour":12,"location_id":"tavern","action":"cooking lunch"},{"hour":15,"location_id":"tavern","action":"cleaning rooms"},{"hour":18,"location_id":"tavern","action":"dinner service"},{"hour":22,"location_id":"tavern","action":"sleep"}]',
  'Chef & Innkeeper at the Salty Molt. Try the chowder.',
  'Need to restock the pantry.'
),
(
  'luna', 'Luna Tidecaller', 'merchant', 'market', 'market', 'npc_merchant',
  '["shrewd","friendly","fashionable"]',
  '["corner the seashell market","open a second stall","befriend everyone for deals"]',
  '[{"hour":7,"location_id":"market","action":"setting up stall"},{"hour":9,"location_id":"market","action":"selling goods"},{"hour":12,"location_id":"tavern","action":"lunch"},{"hour":13,"location_id":"market","action":"afternoon trading"},{"hour":16,"location_id":"docks","action":"checking imports"},{"hour":18,"location_id":"tavern","action":"networking"},{"hour":21,"location_id":"market","action":"sleep"}]',
  'Luna''s Fine Goods — best prices on the island!',
  'Those shells from the last shipment will sell well.'
),
(
  'cedar', 'Cedar Mossgrove', 'groundskeeper', 'beach', 'beach', 'npc_groundskeeper',
  '["gentle","nature_lover","quiet"]',
  '["keep the island beautiful","plant 100 trees","protect the wildlife"]',
  '[{"hour":5,"location_id":"beach","action":"sunrise walk"},{"hour":7,"location_id":"market","action":"tending town flowers"},{"hour":9,"location_id":"farm","action":"helping with gardens"},{"hour":12,"location_id":"beach","action":"lunch by the sea"},{"hour":14,"location_id":"mayor","action":"trimming hedges"},{"hour":16,"location_id":"lighthouse","action":"clearing paths"},{"hour":18,"location_id":"tavern","action":"quiet dinner"},{"hour":20,"location_id":"beach","action":"sleep"}]',
  'Taking care of this little island, one flower at a time.',
  'The wildflowers on the cliff are blooming early.'
)
ON CONFLICT (id) DO NOTHING;

-- ── Initial Relationships (some notable ones) ──
INSERT INTO agent_relationships (agent_id, target_agent_id, trust, friendship, rivalry) VALUES
  ('katy', 'bruno', 70, 80, 0),     -- coworkers at tavern
  ('bruno', 'katy', 65, 75, 5),     -- slight rivalry over tavern management
  ('agnes', 'gus', 60, 55, 10),     -- mayor respects but clashes with blacksmith
  ('gus', 'agnes', 50, 45, 20),     -- gus finds mayor bossy
  ('finn', 'mira', 65, 70, 0),      -- both sea-oriented, friends
  ('mira', 'finn', 70, 75, 0),      -- mira likes finn's stories
  ('bob', 'cedar', 75, 80, 0),      -- both nature-oriented, good friends
  ('cedar', 'bob', 80, 85, 0),      -- cedar admires bob's farming
  ('pip', 'luna', 55, 60, 0),       -- pip delivers luna's goods
  ('luna', 'pip', 50, 55, 5),       -- luna thinks pip is clumsy
  ('agnes', 'katy', 45, 40, 15),    -- mayor suspects katy gossips about her
  ('katy', 'agnes', 40, 35, 25)     -- katy thinks agnes is uptight
ON CONFLICT (agent_id, target_agent_id) DO NOTHING;
