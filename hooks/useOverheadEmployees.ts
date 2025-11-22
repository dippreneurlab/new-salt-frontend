import { useState, useEffect, useCallback } from 'react';
import { firebaseAuth } from '@/lib/firebaseClient';
import { 
  OverheadRow, 
  employeesToOverheadRows,
  overheadRowsToEmployees,
  generateTempId,
  isNewOverheadRow,
  validateOverheadRow
} from '../utils/overheadUtils';

export interface UseOverheadEmployeesReturn {
  overheads: OverheadRow[];
  loading: boolean;
  error: string | null;
  lastSaved: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  addOverhead: () => void;
  updateOverheadField: (index: number, field: keyof OverheadRow, value: any) => void;
  updateOverheadMonth: (index: number, month: string, input: string) => void;
  deleteOverhead: (index: number) => void;
  saveOverheads: () => Promise<void>;
  loadOverheads: () => Promise<void>;
  syncWithDatabase: () => Promise<void>;
}

const fetchWithAuth = async (path: string, init: RequestInit = {}) => {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Please sign in to load overhead data');
  const token = await user.getIdToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json();
};

export const useOverheadEmployees = (): UseOverheadEmployeesReturn => {
  const [overheads, setOverheads] = useState<OverheadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);

  // Load overheads from database on mount
  useEffect(() => {
    loadOverheads();
  }, []);

  const loadOverheads = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchWithAuth('/api/overhead-employees');
      const overheadRows = employeesToOverheadRows(data.employees || []);
      setOverheads(overheadRows);
      setHasLoadedFromStorage(true);
    } catch (err) {
      console.error('Failed to load overheads:', err);
      setError(err instanceof Error ? err.message : 'Failed to load overheads');
    } finally {
      setLoading(false);
      setHasLoadedFromStorage(true);
    }
  }, []);

  const saveOverheads = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveStatus('saving');
    
    try {
      // Validate all overheads before saving
      const validationErrors: string[] = [];
      overheads.forEach((overhead, index) => {
        const validation = validateOverheadRow(overhead);
        if (!validation.isValid) {
          validationErrors.push(`Row ${index + 1}: ${validation.errors.join(', ')}`);
        }
      });

      if (validationErrors.length > 0) {
        throw new Error(`Validation errors:\n${validationErrors.join('\n')}`);
      }

      const employeesToSave = overheadRowsToEmployees(overheads).map(emp => ({
        ...emp,
        id: emp.id?.startsWith('temp_') ? undefined : emp.id
      }));

      const saved = await fetchWithAuth('/api/overhead-employees', {
        method: 'POST',
        body: JSON.stringify({ employees: employeesToSave })
      });

      const updatedOverheads = employeesToOverheadRows(saved.employees || []);
      setOverheads(updatedOverheads);
      
      // Update save status and timestamp
      const now = new Date().toLocaleString();
      setLastSaved(now);
      setSaveStatus('saved');
      
      console.log('✅ Overheads saved to database successfully');
      
      // Show success notification
      if (typeof window !== 'undefined') {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.innerHTML = `
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <span class="font-medium">Overhead data saved to Cloud SQL!</span>
          </div>
        `;
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          z-index: 10000;
          font-family: 'Inter', sans-serif;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          animation: slideIn 0.3s ease-out;
        `;
        
        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = `
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
          if (document.body.contains(notification)) {
            notification.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => {
              if (document.body.contains(notification)) {
                document.body.removeChild(notification);
              }
              if (document.head.contains(style)) {
                document.head.removeChild(style);
              }
            }, 300);
          }
        }, 3000);
        
        // Add slide-out animation
        style.textContent += `
          @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
          }
        `;
      }
      
      // Reset to idle after showing success for 2 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
      
    } catch (err) {
      console.error('Failed to save overheads to database:', err);
      setError(err instanceof Error ? err.message : 'Failed to save overheads');
      setSaveStatus('error');
      throw err; // Re-throw so caller can handle
    } finally {
      setLoading(false);
    }
  }, [overheads]);

  const syncWithDatabase = useCallback(async () => {
    await saveOverheads();
    await loadOverheads();
  }, [saveOverheads, loadOverheads]);

  const addOverhead = useCallback(() => {
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0];
    const monthly: { [month: string]: number } = {};

    const newOverhead: OverheadRow = {
      id: generateTempId(),
      department: '',
      employee: '',
      role: '',
      location: 'Canada',
      annualSalary: 0,
      allocationPercent: 100,
      startDate,
      endDate,
      monthly
    };

    // Initialize monthly values to 0 for all months
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    months.forEach(month => {
      newOverhead.monthly[month] = 0;
    });

    setOverheads(prev => [...prev, newOverhead]);
  }, []);

  // Compute monthly salary allocation based on start/end dates and allocation percent
  // Includes burden percentage: Canada = 20%, US = 15%
  const computeOverheadMonthly = useCallback((row: OverheadRow): { [m: string]: number } => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    const result: { [m: string]: number } = {};
    months.forEach(m => { result[m] = 0; });
    
    if (!row.startDate || !row.endDate || !row.annualSalary || !row.allocationPercent) {
      return result;
    }
    
    const start = new Date(row.startDate);
    const end = new Date(row.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return result;

    // Calculate burden percentage based on location
    const burdenPercent = row.location === 'US' ? 0.15 : 0.20; // US = 15%, Canada (default) = 20%
    const salaryWithBurden = row.annualSalary * (1 + burdenPercent);

    const allocationFactor = (row.allocationPercent || 0) / 100;
    const allocatedAnnual = salaryWithBurden * allocationFactor;
    const weeklyCost = allocatedAnnual / 52;

    // Iterate each day to accumulate weeks per month
    const dayMs = 24 * 60 * 60 * 1000;
    for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
      const d = new Date(t);
      const monthIdx = d.getMonth(); // 0..11
      const key = monthIdx === 8 ? 'Sept' : months[monthIdx];
      result[key] = (result[key] || 0) + (weeklyCost / 7); // daily portion of weekly cost
    }
    
    // Round per month to nearest dollar
    months.forEach(m => {
      result[m] = Math.round(result[m]);
    });
    
    return result;
  }, []);

  const updateOverheadField = useCallback((index: number, field: keyof OverheadRow, value: any) => {
    setOverheads(prev => prev.map((row, i) => {
      if (i !== index) return row;
      
      const updated: OverheadRow = { ...row, [field]: value } as OverheadRow;
      
      // Recompute monthly allocations if salary, allocation, location, or dates change
      if (field === 'annualSalary' || field === 'allocationPercent' || field === 'location' || field === 'startDate' || field === 'endDate') {
        const recomputedMonthly = computeOverheadMonthly(updated);
        updated.monthly = recomputedMonthly;
      }
      
      return updated;
    }));
  }, [computeOverheadMonthly]);

  const updateOverheadMonth = useCallback((index: number, month: string, input: string) => {
    const amount = parseFloat(input.replace(/[^\d.-]/g, '')) || 0;
    setOverheads(prev => prev.map((row, i) => 
      i === index ? { ...row, monthly: { ...row.monthly, [month]: amount } } : row
    ));
  }, []);

  const deleteOverhead = useCallback(async (index: number) => {
    const overheadToDelete = overheads[index];
    
    // Remove from local state immediately
    setOverheads(prev => prev.filter((_, i) => i !== index));
    
    // If it exists in database, delete it
    if (overheadToDelete.id && !isNewOverheadRow(overheadToDelete)) {
      try {
        await fetchWithAuth('/api/overhead-employees', {
          method: 'DELETE',
          body: JSON.stringify({ id: overheadToDelete.id })
        });
        console.log('✅ Overhead deleted from database');
      } catch (err) {
        console.error('Failed to delete overhead from database:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete overhead');
        setOverheads(prev => {
          const newOverheads = [...prev];
          newOverheads.splice(index, 0, overheadToDelete);
          return newOverheads;
        });
      }
    }
  }, [overheads]);

  return {
    overheads,
    loading,
    error,
    lastSaved,
    saveStatus,
    addOverhead,
    updateOverheadField,
    updateOverheadMonth,
    deleteOverhead,
    saveOverheads,
    loadOverheads,
    syncWithDatabase
  };
};
