import { NextRequest, NextResponse } from 'next/server';
import { processSimulationTick } from '@/lib/simulation';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  // Verify cron secret in production
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processSimulationTick();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Tick error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

// POST also triggers a tick (for manual triggering from the UI)
export async function POST(req: NextRequest) {
  return GET(req);
}
