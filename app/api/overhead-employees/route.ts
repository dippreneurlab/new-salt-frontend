import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { deleteOverheadEmployee, listOverheadEmployees, upsertOverheadEmployees } from '@/lib/overheadRepository';

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const employees = await listOverheadEmployees(user.uid);
  return NextResponse.json({ employees });
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const employees = body?.employees || [];
  const saved = await upsertOverheadEmployees(user.uid, employees, user.email || user.uid);
  return NextResponse.json({ employees: saved });
}

export async function DELETE(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  await deleteOverheadEmployee(user.uid, id);
  return NextResponse.json({ ok: true });
}
