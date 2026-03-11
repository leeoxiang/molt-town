'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import type { Agent, MoltbookPost, WorldEvent, Conversation, SimulationTick, RewardEvent } from '@/types';

interface RealtimeData {
  agents: Agent[];
  posts: MoltbookPost[];
  events: WorldEvent[];
  conversations: Conversation[];
  rewards: RewardEvent[];
  tick: SimulationTick | null;
  isLive: boolean;
}

export function useRealtimeData(): RealtimeData & {
  triggerTick: () => Promise<void>;
  isRunning: boolean;
  autoPlay: boolean;
  setAutoPlay: (v: boolean) => void;
} {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [posts, setPosts] = useState<MoltbookPost[]>([]);
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [rewards, setRewards] = useState<RewardEvent[]>([]);
  const [tick, setTick] = useState<SimulationTick | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true); // Auto-play ON by default
  const autoRef = useRef(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);

  const fetchAll = useCallback(async () => {
    // Each fetch is individually guarded — one failing API won't break the others
    const safeFetch = async (url: string) => {
      try {
        const r = await fetch(url);
        if (!r.ok) return [];
        const data = await r.json();
        return Array.isArray(data) ? data : [];
      } catch { return []; }
    };

    const [a, p, e, c, rw] = await Promise.all([
      safeFetch('/api/agents'),
      safeFetch('/api/moltbook?limit=30'),
      safeFetch('/api/events?limit=30'),
      safeFetch('/api/conversations?limit=5'),
      safeFetch('/api/rewards?limit=20'),
    ]);
    setAgents(a);
    setPosts(p);
    setEvents(e);
    setConversations(c);
    setRewards(rw);
  }, []);

  // Initial fetch
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Supabase Realtime subscription
  useEffect(() => {
    let mounted = true;

    const setupRealtime = async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) return;

        const client = createClient(url, key);
        const channel = client.channel('molt-town-live');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const safeRefetch = (url: string, setter: (d: any[]) => void) => {
          if (!mounted) return;
          fetch(url).then(r => r.ok ? r.json() : []).then(d => {
            if (mounted && Array.isArray(d)) setter(d);
          }).catch(() => {});
        };

        channel
          .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, () => {
            safeRefetch('/api/agents', setAgents);
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'moltbook_posts' }, () => {
            safeRefetch('/api/moltbook?limit=30', setPosts);
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'world_events' }, () => {
            safeRefetch('/api/events?limit=30', setEvents);
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, () => {
            safeRefetch('/api/conversations?limit=5', setConversations);
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'simulation_ticks' }, (payload) => {
            if (mounted && payload.new) {
              setTick(payload.new as SimulationTick);
            }
          })
          .subscribe((status) => {
            if (mounted) setIsLive(status === 'SUBSCRIBED');
          });

        channelRef.current = channel;
      } catch {
        // Realtime unavailable, fall back to polling
      }
    };

    setupRealtime();

    return () => {
      mounted = false;
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, []);

  const triggerTick = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      const res = await fetch('/api/simulation/tick', { method: 'POST' });
      if (res.ok) {
        const d = await res.json();
        setTick({ id: d.tick_id, sim_hour: 0, sim_day: 0, processed_at: '', summary: d.summary });
        if (!isLive) await fetchAll();
      }
    } catch { /* ignore */ }
    setIsRunning(false);
  }, [isRunning, fetchAll, isLive]);

  // Auto-play (default on, 8s interval for more natural pacing)
  useEffect(() => { autoRef.current = autoPlay; }, [autoPlay]);
  useEffect(() => {
    if (!autoPlay) return;
    const iv = setInterval(() => {
      if (autoRef.current && !isRunning) triggerTick();
    }, 8000);
    return () => clearInterval(iv);
  }, [autoPlay, isRunning, triggerTick]);

  return { agents, posts, events, conversations, rewards, tick, isLive, triggerTick, isRunning, autoPlay, setAutoPlay };
}
