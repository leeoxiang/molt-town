import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = getServiceSupabase();
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20');

  const { data, error } = await supabase
    .from('reward_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    // Table doesn't exist yet — return empty instead of 500
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return NextResponse.json([]);
    }
    console.error('[rewards] query error:', error.code, error.message);
    return NextResponse.json([]);
  }

  return NextResponse.json(data || []);
}
