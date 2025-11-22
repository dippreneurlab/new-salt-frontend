import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { deleteStorageValue, getStorageValue, setStorageValue } from '@/lib/cloudStorageServer';

export async function GET(request: Request, { params }: { params: { key: string } }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const value = await getStorageValue(user.uid, params.key);
  return NextResponse.json({ key: params.key, value });
}

export async function PUT(request: Request, { params }: { params: { key: string } }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const value = body?.value ?? null;
  const saved = await setStorageValue(user.uid, params.key, value);
  return NextResponse.json({ key: params.key, value: saved });
}

export async function DELETE(request: Request, { params }: { params: { key: string } }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await deleteStorageValue(user.uid, params.key);
  return NextResponse.json({ ok: true });
}
