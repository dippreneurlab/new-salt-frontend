-- Cloud SQL / Postgres schema for Connections Quote Tool
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS user_storage (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  storage_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, storage_key)
);

CREATE INDEX IF NOT EXISTS user_storage_user_idx ON user_storage(user_id);

CREATE TABLE IF NOT EXISTS overhead_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  department TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  role TEXT NOT NULL,
  location TEXT,
  annual_salary NUMERIC NOT NULL,
  allocation_percent NUMERIC NOT NULL,
  start_date DATE,
  end_date DATE,
  monthly_allocations JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS overhead_user_idx ON overhead_employees(user_id);
CREATE INDEX IF NOT EXISTS overhead_department_idx ON overhead_employees(department);
