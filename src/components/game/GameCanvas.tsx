'use client';

import { useEffect, useRef } from 'react';
import type { Agent, Conversation } from '@/types';

interface GameCanvasProps {
  agents: Agent[];
  conversations: Conversation[];
  onAgentClick: (agentId: string) => void;
}

export default function GameCanvas({ agents, conversations, onAgentClick }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    globalThis.__molt = globalThis.__molt || {};
    globalThis.__molt.onAgentClick = onAgentClick;

    const init = async () => {
      if (gameRef.current || !containerRef.current) return;

      const PhaserModule = await import('phaser');
      const Phaser = PhaserModule.default || PhaserModule;
      const { default: IslandScene } = await import('./IslandScene');

      // Use parent container size for the game canvas
      const rect = containerRef.current.getBoundingClientRect();
      const w = Math.floor(rect.width) || 960;
      const h = Math.floor(rect.height) || 640;

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: w,
        height: h,
        pixelArt: true,
        backgroundColor: '#0a1628',
        scene: [IslandScene],
        scale: {
          mode: Phaser.Scale.NONE,
        },
        fps: { target: 60 },
      });

      gameRef.current = game;
    };

    init();

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (globalThis.__molt?.updateAgents) {
      globalThis.__molt.updateAgents(agents);
    }
  }, [agents]);

  useEffect(() => {
    if (globalThis.__molt?.showConversations && conversations.length > 0) {
      globalThis.__molt.showConversations(conversations);
    }
  }, [conversations]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden"
    />
  );
}
