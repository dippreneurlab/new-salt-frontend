import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { listStorageValues } from '@/lib/cloudStorageServer';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const values = await listStorageValues(user.uid);
    return NextResponse.json({ values });
  } catch (err) {
    console.error('Failed to load storage values', err);
    return NextResponse.json({ error: 'Failed to load storage values' }, { status: 500 });
  }
}
