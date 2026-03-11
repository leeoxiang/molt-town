'use client';

import type { MoltbookPost } from '@/types';
import SpriteAvatar from './SpriteAvatar';

interface Props {
  posts: MoltbookPost[];
  onAgentClick: (agentId: string) => void;
}

const typeStyle: Record<string, string> = {
  status: 'bg-[#6b4226]/20 text-[#c4a46c]',
  gossip: 'bg-purple-900/20 text-purple-400',
  announcement: 'bg-[#f5c842]/10 text-[#f5c842]',
  observation: 'bg-emerald-900/20 text-emerald-400',
  reply: 'bg-[#3a2f1a]/30 text-[#7a6b55]',
};

export default function MoltbookFeed({ posts, onAgentClick }: Props) {
  if (!posts.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#5a4a30]">
        <div className="pixel-font text-[9px] text-[#7a6b55] mb-2">M</div>
        <p className="text-sm text-[#7a6b55]">No posts yet</p>
        <p className="text-xs text-[#5a4a30] mt-1">Run ticks to see Moltbook activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {posts.map((post, i) => {
        return (
          <div
            key={post.id}
            className="animate-post rounded-lg p-3 border border-[#3a2f1a]
                       bg-[#1a1408] hover:bg-[#201810] hover:border-[#5a4a30]
                       transition-all duration-200"
            style={{ animationDelay: `${i * 25}ms` }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              {post.author_sprite_key ? (
                <SpriteAvatar spriteKey={post.author_sprite_key} size={24} />
              ) : (
                <div className="w-6 h-6 rounded bg-[#251c0e] border border-[#5a4a30] flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-[#c4a46c]">
                    {(post.author_name || '?')[0]}
                  </span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => onAgentClick(post.author_id)}
                  className="font-semibold text-[13px] text-[#c4a46c] hover:text-[#f5e6c8] transition truncate block"
                >
                  {post.author_name || post.author_id}
                </button>
              </div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${typeStyle[post.post_type] || typeStyle.status}`}>
                {post.post_type}
              </span>
            </div>
            <p className="text-[13px] text-[#c4a46c] leading-relaxed pl-8">{post.content}</p>
            <div className="flex items-center gap-3 mt-2 pl-8 text-[10px] text-[#5a4a30]">
              {post.likes > 0 && <span className="text-[#f5c842]/70">&#9829; {post.likes}</span>}
              <span>#{post.tick_id}</span>
              <span className="text-[#3a2f1a]">{post.author_job}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
