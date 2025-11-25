import { query } from './db';
import {
  getPipelineEntriesForUser,
  replacePipelineEntries,
  PipelineEntry,
  buildPipelineChangelog,
} from './pipelineRepository';
import { getQuotesForUser, parseQuotesValue, replaceQuotes } from './quotesRepository';

let storageTableReady = false;

const ensureStorageTable = async () => {
  if (storageTableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS user_storage (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      storage_value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(user_id, storage_key)
    );
  `);
  storageTableReady = true;
};

const PIPELINE_KEY = 'pipeline-entries';
const QUOTES_KEY = 'saltxc-all-quotes';

const parsePipelineValue = (value: any): PipelineEntry[] => {
  if (value == null) return [];
  if (Array.isArray(value)) return value as PipelineEntry[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const getStorageValue = async <T = any>(userId: string, key: string): Promise<T | null> => {
  if (key === PIPELINE_KEY) {
    const entries = await getPipelineEntriesForUser(userId);
    return JSON.stringify(entries) as T;
  }
  if (key === QUOTES_KEY) {
    const quotes = await getQuotesForUser(userId);
    return JSON.stringify(quotes) as T;
  }

  await ensureStorageTable();
  const res = await query<{ storage_value: T }>(
    'SELECT storage_value FROM user_storage WHERE user_id = $1 AND storage_key = $2',
    [userId, key]
  );
  const value = res.rows[0]?.storage_value;
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value as T;
  return JSON.stringify(value) as T;
};

export const setStorageValue = async <T = any>(userId: string, key: string, value: T, email?: string): Promise<T> => {
  if (key === PIPELINE_KEY) {
    const entries = parsePipelineValue(value);
    await replacePipelineEntries(userId, entries, email);
    return value;
  }

  if (key === QUOTES_KEY) {
    const quotes = parseQuotesValue(value);
    await replaceQuotes(userId, quotes, email);
    return value;
  }

  await ensureStorageTable();
  const res = await query<{ storage_value: T }>(
    `
      INSERT INTO user_storage (user_id, storage_key, storage_value)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, storage_key)
      DO UPDATE SET storage_value = EXCLUDED.storage_value, updated_at = now()
      RETURNING storage_value;
    `,
    [userId, key, value]
  );
  return res.rows[0].storage_value;
};

export const deleteStorageValue = async (userId: string, key: string) => {
  if (key === PIPELINE_KEY) {
    await replacePipelineEntries(userId, []);
    return;
  }
  if (key === QUOTES_KEY) {
    await replaceQuotes(userId, []);
    return;
  }

  await ensureStorageTable();
  await query('DELETE FROM user_storage WHERE user_id = $1 AND storage_key = $2', [userId, key]);
};

export const listStorageValues = async (userId: string) => {
  await ensureStorageTable();
  const res = await query<{ storage_key: string; storage_value: any }>(
    'SELECT storage_key, storage_value FROM user_storage WHERE user_id = $1',
    [userId]
  );

  const base = res.rows.reduce<Record<string, any>>(
    (acc: Record<string, any>, row: { storage_key: string; storage_value: any }) => {
      const value = row.storage_value;

      acc[row.storage_key] =
        value === null || value === undefined
          ? null
          : typeof value === 'string'
          ? value
          : JSON.stringify(value);

      return acc;
    },
    {}
  );


  // Inject pipeline/quotes from direct tables
  const [pipelineEntries, quotes] = await Promise.all([
    getPipelineEntriesForUser(userId),
    getQuotesForUser(userId)
  ]);

  base[PIPELINE_KEY] = JSON.stringify(pipelineEntries);
  base[QUOTES_KEY] = JSON.stringify(quotes);

  const changeLog = buildPipelineChangelog(pipelineEntries, base['email'] || userId);
  base['pipeline-changelog'] = JSON.stringify(changeLog);

  return base;
};
