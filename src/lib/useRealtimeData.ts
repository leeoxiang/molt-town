'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import type { Agent, MoltbookPost, WorldEvent, Conversation, SimulationTick } from '@/types';

interface RealtimeData {
  agents: Agent[];
  posts: MoltbookPost[];
  events: WorldEvent[];
  conversations: Conversation[];
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
  const [tick, setTick] = useState<SimulationTick | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const autoRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [a, p, e, c] = await Promise.all([
        fetch('/api/agents').then(r => r.ok ? r.json() : []),
        fetch('/api/moltbook?limit=30').then(r => r.ok ? r.json() : []),
        fetch('/api/events?limit=30').then(r => r.ok ? r.json() : []),
        fetch('/api/conversations?limit=5').then(r => r.ok ? r.json() : []),
      ]);
      if (a) setAgents(a);
      if (p) setPosts(p);
      if (e) setEvents(e);
      if (c) setConversations(c);
    } catch { /* ignore */ }
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

        channel
          .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, () => {
            if (mounted) fetch('/api/agents').then(r => r.json()).then(setAgents).catch(() => {});
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'moltbook_posts' }, () => {
            if (mounted) fetch('/api/moltbook?limit=30').then(r => r.json()).then(setPosts).catch(() => {});
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'world_events' }, () => {
            if (mounted) fetch('/api/events?limit=30').then(r => r.json()).then(setEvents).catch(() => {});
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, () => {
            if (mounted) fetch('/api/conversations?limit=5').then(r => r.json()).then(setConversations).catch(() => {});
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
        // If not live, do a manual fetch
        if (!isLive) await fetchAll();
      }
    } catch { /* ignore */ }
    setIsRunning(false);
  }, [isRunning, fetchAll, isLive]);

  // Auto-play
  useEffect(() => { autoRef.current = autoPlay; }, [autoPlay]);
  useEffect(() => {
    if (!autoPlay) return;
    const iv = setInterval(() => {
      if (autoRef.current && !isRunning) triggerTick();
    }, 3000);
    return () => clearInterval(iv);
  }, [autoPlay, isRunning, triggerTick]);

  return { agents, posts, events, conversations, tick, isLive, triggerTick, isRunning, autoPlay, setAutoPlay };
}
