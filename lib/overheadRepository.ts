import { query } from './db';

export interface OverheadEmployee {
  id?: string;
  user_id?: string;
  department: string;
  employee_name: string;
  role: string;
  location: 'Canada' | 'US' | null;
  annual_salary: number;
  allocation_percent: number;
  start_date: string | null;
  end_date: string | null;
  monthly_allocations: Record<string, number>;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
}

let overheadTablesReady = false;

const ensureOverheadTable = async () => {
  if (overheadTablesReady) return;
  await query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
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
  `);
  overheadTablesReady = true;
};

export const listOverheadEmployees = async (userId: string): Promise<OverheadEmployee[]> => {
  await ensureOverheadTable();
  const res = await query<OverheadEmployee>(
    'SELECT * FROM overhead_employees WHERE user_id = $1 ORDER BY department ASC, employee_name ASC',
    [userId]
  );
  return res.rows;
};

export const upsertOverheadEmployees = async (userId: string, employees: OverheadEmployee[], actor?: string) => {
  await ensureOverheadTable();
  const results: OverheadEmployee[] = [];
  for (const emp of employees) {
    const res = await query<OverheadEmployee>(
      `
        INSERT INTO overhead_employees (
          id, user_id, department, employee_name, role, location,
          annual_salary, allocation_percent, start_date, end_date,
          monthly_allocations, created_by, updated_by
        )
        VALUES (
          COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13
        )
        ON CONFLICT (id) DO UPDATE SET
          department = EXCLUDED.department,
          employee_name = EXCLUDED.employee_name,
          role = EXCLUDED.role,
          location = EXCLUDED.location,
          annual_salary = EXCLUDED.annual_salary,
          allocation_percent = EXCLUDED.allocation_percent,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          monthly_allocations = EXCLUDED.monthly_allocations,
          updated_at = now(),
          updated_by = EXCLUDED.updated_by
        RETURNING *;
      `,
      [
        emp.id || null,
        userId,
        emp.department,
        emp.employee_name,
        emp.role,
        emp.location,
        emp.annual_salary,
        emp.allocation_percent,
        emp.start_date,
        emp.end_date,
        emp.monthly_allocations || {},
        emp.created_by || actor || null,
        actor || emp.updated_by || emp.created_by || null
      ]
    );
    results.push(res.rows[0]);
  }
  return results;
};

export const deleteOverheadEmployee = async (userId: string, id: string) => {
  await ensureOverheadTable();
  await query('DELETE FROM overhead_employees WHERE user_id = $1 AND id = $2', [userId, id]);
};
