import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { listStorageValues, setStorageValue } from '@/lib/cloudStorageServer';

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const values = await listStorageValues(user.uid);
  return NextResponse.json({ values });
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const entries: Record<string, any> = body?.values || {};
  const saved: Record<string, any> = {};

  await Promise.all(
    Object.entries(entries).map(async ([key, value]) => {
      const stored = await setStorageValue(user.uid, key, value);
      saved[key] = stored;
    })
  );

  return NextResponse.json({ values: saved });
}
