import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceSupabase();

  // Fetch agent + memories + relationships + posts in parallel
  const [agentRes, memoriesRes, relationshipsRes, postsRes] = await Promise.all([
    supabase.from('agents').select('*').eq('id', id).single(),
    supabase
      .from('agent_memories')
      .select('*')
      .eq('agent_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('agent_relationships')
      .select('*')
      .eq('agent_id', id),
    supabase
      .from('moltbook_posts')
      .select('*')
      .eq('author_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  if (agentRes.error) {
    return NextResponse.json({ error: agentRes.error.message }, { status: 404 });
  }

  return NextResponse.json({
    agent: agentRes.data,
    memories: memoriesRes.data || [],
    relationships: relationshipsRes.data || [],
    posts: postsRes.data || [],
  });
}
