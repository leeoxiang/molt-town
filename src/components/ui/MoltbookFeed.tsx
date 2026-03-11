'use client';

import type { MoltbookPost } from '@/types';

interface Props {
  posts: MoltbookPost[];
  onAgentClick: (agentId: string) => void;
}

const typeStyle: Record<string, string> = {
  status: 'bg-blue-500/15 text-blue-400',
  gossip: 'bg-purple-500/15 text-purple-400',
  announcement: 'bg-amber-500/15 text-amber-400',
  observation: 'bg-emerald-500/15 text-emerald-400',
  reply: 'bg-slate-500/15 text-slate-400',
};

export default function MoltbookFeed({ posts, onAgentClick }: Props) {
  if (!posts.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <div className="w-10 h-10 rounded-full border-2 border-slate-700 flex items-center justify-center text-slate-600 text-sm font-mono mb-3">M</div>
        <p className="text-sm">No posts yet</p>
        <p className="text-xs text-slate-600 mt-1">Run ticks to see Moltbook activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {posts.map((post, i) => (
        <div
          key={post.id}
          className="animate-post rounded-lg p-3 border border-[#1e2d4a]
                     bg-[#141b2d] hover:bg-[#1a2340] hover:border-slate-600
                     transition-all duration-200"
          style={{ animationDelay: `${i * 25}ms` }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600
                            flex items-center justify-center text-[9px] font-bold text-white shrink-0">
              {(post.author_name || '?')[0]}
            </div>
            <div className="min-w-0 flex-1">
              <button
                onClick={() => onAgentClick(post.author_id)}
                className="font-semibold text-[13px] text-blue-400 hover:text-blue-300 transition truncate block"
              >
                {post.author_name || post.author_id}
              </button>
            </div>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${typeStyle[post.post_type] || typeStyle.status}`}>
              {post.post_type}
            </span>
          </div>
          <p className="text-[13px] text-slate-300 leading-relaxed pl-8">{post.content}</p>
          <div className="flex items-center gap-3 mt-2 pl-8 text-[10px] text-slate-600">
            {post.likes > 0 && <span className="text-pink-400/70">&#9829; {post.likes}</span>}
            <span>#{post.tick_id}</span>
            <span className="text-slate-700">{post.author_job}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
