import { query } from './db';

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

export const getStorageValue = async <T = any>(userId: string, key: string): Promise<T | null> => {
  await ensureStorageTable();
  const res = await query<{ storage_value: T }>(
    'SELECT storage_value FROM user_storage WHERE user_id = $1 AND storage_key = $2',
    [userId, key]
  );
  return res.rows[0]?.storage_value ?? null;
};

export const setStorageValue = async <T = any>(userId: string, key: string, value: T): Promise<T> => {
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
  await ensureStorageTable();
  await query('DELETE FROM user_storage WHERE user_id = $1 AND storage_key = $2', [userId, key]);
};

export const listStorageValues = async (userId: string) => {
  await ensureStorageTable();
  const res = await query<{ storage_key: string; storage_value: any }>(
    'SELECT storage_key, storage_value FROM user_storage WHERE user_id = $1',
    [userId]
  );

  return res.rows.reduce<Record<string, any>>((acc, row) => {
    acc[row.storage_key] = row.storage_value;
    return acc;
  }, {});
};
