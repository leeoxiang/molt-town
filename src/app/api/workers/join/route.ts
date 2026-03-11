import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { wallet, name } = await req.json();

    if (!wallet || typeof wallet !== 'string' || wallet.length < 10) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }
    if (!name || typeof name !== 'string' || name.length < 2 || name.length > 30) {
      return NextResponse.json({ error: 'Name must be 2-30 characters' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Check if wallet already joined
    const { data: existing } = await supabase
      .from('workers')
      .select('id')
      .eq('wallet', wallet)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'This wallet already has a worker' }, { status: 409 });
    }

    // Create worker
    const { data: worker, error } = await supabase
      .from('workers')
      .insert({ wallet, name, molt_balance: 0 })
      .select()
      .single();

    if (error) {
      // Table might not exist yet — graceful
      if (error.code === '42P01') {
        return NextResponse.json({ error: 'Workers system not yet initialized' }, { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(worker);
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
