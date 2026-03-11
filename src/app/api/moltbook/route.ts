import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = getServiceSupabase();
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '30');

  const { data: posts, error } = await supabase
    .from('moltbook_posts')
    .select(`
      *,
      agents!moltbook_posts_author_id_fkey ( name, job, sprite_key )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten joined data
  const formatted = (posts || []).map((p: Record<string, unknown>) => {
    const agent = p.agents as Record<string, unknown> | null;
    return {
      ...p,
      author_name: agent?.name || 'Unknown',
      author_job: agent?.job || '',
      author_sprite_key: agent?.sprite_key || '',
      agents: undefined,
    };
  });

  return NextResponse.json(formatted);
}
