import { Pool, PoolConfig, QueryResult } from 'pg';

let pool: Pool | null = null;

const buildConfig = (): PoolConfig => {
  const connectionString = process.env.DATABASE_URL;
  const connectionName = process.env.CLOUD_SQL_CONNECTION_NAME;
  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : undefined;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DB;
  const sslEnabled = (process.env.POSTGRES_SSL || '').toLowerCase() !== 'false';

  if (!connectionString && !database) {
    console.warn('Postgres connection info missing. Set DATABASE_URL or POSTGRES_* variables.');
  }

  const config: PoolConfig = connectionString
    ? { connectionString }
    : {
        host: connectionName ? `/cloudsql/${connectionName}` : host,
        port,
        user,
        password,
        database
      };

  if (sslEnabled) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
};

export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool(buildConfig());
  }
  return pool;
};

export const query = async <T = any>(text: string, params: any[] = []): Promise<QueryResult<T>> => {
  const client = await getPool().connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
};
