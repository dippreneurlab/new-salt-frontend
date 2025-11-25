import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import {
  getPipelineEntriesForUser,
  upsertPipelineEntry,
  deletePipelineEntry,
  getNextProjectCode,
  buildPipelineChangelog,
  type PipelineEntry
} from '@/lib/pipelineRepository';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const entries = await getPipelineEntriesForUser(user.uid);
  const changelog = buildPipelineChangelog(entries, user.email || user.uid);
  return NextResponse.json({ entries, changelog });
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const entry = body?.entry as PipelineEntry | undefined;
  if (!entry) return NextResponse.json({ error: 'entry is required' }, { status: 400 });

  // Auto-assign project code if missing
  if (!entry.projectCode) {
    const year = new Date().getUTCFullYear().toString().slice(-2);
    entry.projectCode = await getNextProjectCode(year);
  }

  const saved = await upsertPipelineEntry(user.uid, entry, user.email);
  return NextResponse.json({ entry: saved });
}

export async function PUT(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const entry = body?.entry as PipelineEntry | undefined;
  if (!entry?.projectCode) return NextResponse.json({ error: 'projectCode is required' }, { status: 400 });

  const saved = await upsertPipelineEntry(user.uid, entry, user.email);
  return NextResponse.json({ entry: saved });
}

export async function DELETE(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const projectCode = body?.projectCode as string | undefined;
  if (!projectCode) return NextResponse.json({ error: 'projectCode is required' }, { status: 400 });

  await deletePipelineEntry(projectCode);
  return NextResponse.json({ ok: true });
}
