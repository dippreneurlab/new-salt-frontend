import { query } from './db';

export interface PipelineEntry {
  projectCode: string;
  owner: string;
  client: string;
  programName: string;
  programType: string;
  region: string;
  startMonth: string;
  endMonth: string;
  startDate?: string | null;
  endDate?: string | null;
  revenue: number;
  totalFees: number;
  status: string;
  accounts: number;
  creative: number;
  design: number;
  strategy: number;
  media: number;
  studio: number;
  creator: number;
  social: number;
  omni: number;
  finance: number;
  createdBy?: string;
  updatedBy?: string;
  createdByEmail?: string;
  updatedByEmail?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PipelineChange {
  type: 'addition' | 'change' | 'deletion';
  projectCode: string;
  projectName?: string;
  client?: string;
  description: string;
  date: string;
  user: string;
}

const ensureUser = async (userId: string, email?: string) => {
  const safeEmail = email || `${userId}@placeholder.local`;
  await query(
    `
      INSERT INTO users (id, email)
      VALUES ($1, $2)
      ON CONFLICT (id) DO NOTHING
    `,
    [userId, safeEmail]
  );
};

const toDbRow = (userId: string, entry: PipelineEntry) => ({
  project_code: entry.projectCode,
  owner: entry.owner,
  client: entry.client,
  program_name: entry.programName,
  program_type: entry.programType || 'Integrated',
  region: entry.region || 'Canada',
  start_date: parseDate(entry.startMonth, false),
  end_date: parseDate(entry.endMonth, true),
  start_month: normalizeMonth(entry.startMonth),
  end_month: normalizeMonth(entry.endMonth),
  revenue: entry.revenue ?? 0,
  total_fees: entry.totalFees ?? 0,
  status: normalizeStatus(entry.status),
  accounts_fees: entry.accounts ?? 0,
  creative_fees: entry.creative ?? 0,
  design_fees: entry.design ?? 0,
  strategic_planning_fees: entry.strategy ?? 0,
  media_fees: entry.media ?? 0,
  creator_fees: entry.creator ?? 0,
  social_fees: entry.social ?? 0,
  omni_fees: entry.omni ?? 0,
  digital_fees: entry.studio ?? 0, // map studio -> digital
  finance_fees: entry.finance ?? 0,
  created_by: userId,
  updated_by: userId
});

const normalizeStatus = (status: string | undefined): string => {
  const raw = (status || 'open').toLowerCase().trim();
  const map: Record<string, string> = {
    'open': 'open',
    'high pitch': 'high-pitch',
    'high-pitch': 'high-pitch',
    'medium pitch': 'medium-pitch',
    'medium-pitch': 'medium-pitch',
    'low pitch': 'low-pitch',
    'low-pitch': 'low-pitch',
    'confirmed': 'confirmed',
    'whitespace': 'whitespace',
    'cancelled': 'cancelled',
    'canceled': 'cancelled',
    'in plan': 'open',
    'in-plan': 'open',
    'planning': 'open'
  };
  return map[raw] || 'open';
};

const parseDate = (value: string | undefined, isEnd: boolean): string | null => {
  if (!value) return null;
  const trimmed = value.trim();

  // If it looks like YYYY-MM-DD, use it
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(trimmed)) return trimmed;

  // If it looks like MMM yyyy, pick first/last day
  const monthYear = trimmed.match(/^([A-Za-z]{3,9})\\s+(\\d{4})$/);
  if (monthYear) {
    const monthIdx = new Date(`${monthYear[1]} 1, ${monthYear[2]}`).getMonth();
    if (!isNaN(monthIdx)) {
      const yearNum = parseInt(monthYear[2], 10);
      if (isEnd) {
        const lastDay = new Date(Date.UTC(yearNum, monthIdx + 1, 0));
        return lastDay.toISOString().slice(0, 10);
      }
      const firstDay = new Date(Date.UTC(yearNum, monthIdx, 1));
      return firstDay.toISOString().slice(0, 10);
    }
  }

  const date = new Date(trimmed);
  return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const normalizeMonth = (value: string | undefined): string | null => {
  if (!value) return null;
  // If it's already a readable month name, keep it
  const m = value.trim();
  const monthNamePattern = /[a-z]{3,9}\s+\d{4}/i;
  if (monthNamePattern.test(m)) return m;
  const date = new Date(value);
  if (isNaN(date.getTime())) return m; // fallback to raw
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

const fromDbRow = (row: any): PipelineEntry => ({
  projectCode: row.project_code,
  owner: row.owner,
  client: row.client,
  programName: row.program_name,
  programType: row.program_type,
  region: row.region,
  startMonth: row.start_month || '',
  endMonth: row.end_month || '',
  startDate: row.start_date,
  endDate: row.end_date,
  revenue: Number(row.revenue || 0),
  totalFees: Number(row.total_fees || 0),
  status: row.status,
  accounts: Number(row.accounts_fees || 0),
  creative: Number(row.creative_fees || 0),
  design: Number(row.design_fees || 0),
  strategy: Number(row.strategic_planning_fees || 0),
  media: Number(row.media_fees || 0),
  studio: Number(row.digital_fees || 0),
  creator: Number(row.creator_fees || 0),
  social: Number(row.social_fees || 0),
  omni: Number(row.omni_fees || 0),
  finance: Number(row.finance_fees || 0),
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  createdByEmail: row.created_by_email,
  updatedByEmail: row.updated_by_email,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const buildChangelog = (entries: PipelineEntry[], userEmail: string): PipelineChange[] => {
  return entries
    .map((entry) => ({
      type: 'addition',
      projectCode: entry.projectCode,
      projectName: entry.programName,
      client: entry.client,
      description: 'Added/updated from Cloud SQL',
      date: entry.updatedAt || entry.createdAt || new Date().toISOString(),
      user: entry.updatedByEmail || entry.createdByEmail || userEmail || 'system'
    }))
    .sort((a, b) => (a.date > b.date ? -1 : 1));
};

export const replacePipelineEntries = async (userId: string, entries: PipelineEntry[], email?: string) => {
  await ensureUser(userId, email);
  // Upsert each entry
  for (const entry of entries) {
    const row = toDbRow(userId, entry);
    await query(
      `
        INSERT INTO pipeline_opportunities (
          project_code, owner, client, program_name, program_type, region,
          start_date, end_date, start_month, end_month, revenue, total_fees, status,
          accounts_fees, creative_fees, design_fees, strategic_planning_fees, media_fees,
          creator_fees, social_fees, omni_fees, digital_fees, finance_fees,
          created_by, updated_by
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,$11,$12,$13,
          $14,$15,$16,$17,$18,
          $19,$20,$21,$22,$23,
          $24,$25
        )
        ON CONFLICT (project_code) DO UPDATE SET
          owner = EXCLUDED.owner,
          client = EXCLUDED.client,
          program_name = EXCLUDED.program_name,
          program_type = EXCLUDED.program_type,
          region = EXCLUDED.region,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          start_month = EXCLUDED.start_month,
          end_month = EXCLUDED.end_month,
          revenue = EXCLUDED.revenue,
          total_fees = EXCLUDED.total_fees,
          status = EXCLUDED.status,
          accounts_fees = EXCLUDED.accounts_fees,
          creative_fees = EXCLUDED.creative_fees,
          design_fees = EXCLUDED.design_fees,
          strategic_planning_fees = EXCLUDED.strategic_planning_fees,
          media_fees = EXCLUDED.media_fees,
          creator_fees = EXCLUDED.creator_fees,
          social_fees = EXCLUDED.social_fees,
          omni_fees = EXCLUDED.omni_fees,
          digital_fees = EXCLUDED.digital_fees,
          finance_fees = EXCLUDED.finance_fees,
          updated_at = now(),
          updated_by = EXCLUDED.updated_by
      `,
      [
        row.project_code,
        row.owner,
        row.client,
        row.program_name,
        row.program_type,
        row.region,
        row.start_date,
        row.end_date,
        row.start_month,
        row.end_month,
        row.revenue,
        row.total_fees,
        row.status,
        row.accounts_fees,
        row.creative_fees,
        row.design_fees,
        row.strategic_planning_fees,
        row.media_fees,
        row.creator_fees,
        row.social_fees,
        row.omni_fees,
        row.digital_fees,
        row.finance_fees,
        row.created_by,
        row.updated_by
      ]
    );
  }

  // Remove rows created by this user that are no longer present
  const codes = entries.map(e => e.projectCode);
  if (codes.length) {
    await query(
      `DELETE FROM pipeline_opportunities WHERE created_by = $1 AND project_code NOT IN (${codes
        .map((_, i) => `$${i + 2}`)
        .join(',')})`,
      [userId, ...codes]
    );
  } else {
    await query('DELETE FROM pipeline_opportunities WHERE created_by = $1', [userId]);
  }
};

export const getPipelineEntriesForUser = async (_userId?: string): Promise<PipelineEntry[]> => {
  const res = await query(
    `
      SELECT po.*,
             cu.email AS created_by_email,
             uu.email AS updated_by_email
      FROM pipeline_opportunities po
      LEFT JOIN users cu ON cu.id = po.created_by
      LEFT JOIN users uu ON uu.id = po.updated_by
      ORDER BY po.project_code ASC
    `
  );
  return res.rows.map(fromDbRow);
};

export const upsertPipelineEntry = async (userId: string, entry: PipelineEntry, email?: string) => {
  await ensureUser(userId, email);
  const row = toDbRow(userId, entry);
  const res = await query(
    `
      INSERT INTO pipeline_opportunities (
        project_code, owner, client, program_name, program_type, region,
        start_date, end_date, start_month, end_month, revenue, total_fees, status,
        accounts_fees, creative_fees, design_fees, strategic_planning_fees, media_fees,
        creator_fees, social_fees, omni_fees, digital_fees, finance_fees,
        created_by, updated_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,$12,$13,
        $14,$15,$16,$17,$18,
        $19,$20,$21,$22,$23,
        $24,$25
      )
      ON CONFLICT (project_code) DO UPDATE SET
        owner = EXCLUDED.owner,
        client = EXCLUDED.client,
        program_name = EXCLUDED.program_name,
        program_type = EXCLUDED.program_type,
        region = EXCLUDED.region,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        start_month = EXCLUDED.start_month,
        end_month = EXCLUDED.end_month,
        revenue = EXCLUDED.revenue,
        total_fees = EXCLUDED.total_fees,
        status = EXCLUDED.status,
        accounts_fees = EXCLUDED.accounts_fees,
        creative_fees = EXCLUDED.creative_fees,
        design_fees = EXCLUDED.design_fees,
        strategic_planning_fees = EXCLUDED.strategic_planning_fees,
        media_fees = EXCLUDED.media_fees,
        creator_fees = EXCLUDED.creator_fees,
        social_fees = EXCLUDED.social_fees,
        omni_fees = EXCLUDED.omni_fees,
        digital_fees = EXCLUDED.digital_fees,
        finance_fees = EXCLUDED.finance_fees,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by
      RETURNING *
    `,
    [
      row.project_code,
      row.owner,
      row.client,
      row.program_name,
      row.program_type,
      row.region,
      row.start_date,
      row.end_date,
      row.start_month,
      row.end_month,
      row.revenue,
      row.total_fees,
      row.status,
      row.accounts_fees,
      row.creative_fees,
      row.design_fees,
      row.strategic_planning_fees,
      row.media_fees,
      row.creator_fees,
      row.social_fees,
      row.omni_fees,
      row.digital_fees,
      row.finance_fees,
      row.created_by,
      row.updated_by
    ]
  );
  return fromDbRow(res.rows[0]);
};

export const deletePipelineEntry = async (projectCode: string) => {
  await query('DELETE FROM pipeline_opportunities WHERE project_code = $1', [projectCode]);
};

export const getNextProjectCode = async (year: string): Promise<string> => {
  const res = await query(
    `SELECT project_code FROM pipeline_opportunities WHERE project_code LIKE 'P____-${year}' ORDER BY project_code DESC LIMIT 1`
  );
  if (!res.rows.length) return `P0001-${year}`;
  const latest = res.rows[0].project_code as string;
  const match = latest.match(/^P(\\d{4})-/);
  const num = match ? parseInt(match[1], 10) + 1 : 1;
  return `P${num.toString().padStart(4, '0')}-${year}`;
};

export const buildPipelineChangelog = (entries: PipelineEntry[], userEmail: string) =>
  buildChangelog(entries, userEmail);
