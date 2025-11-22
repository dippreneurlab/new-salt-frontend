import { useCallback, useEffect, useState, type SetStateAction } from 'react';
import { getStorageItem, removeStorageItem, setStorageItem } from '@/lib/cloudStorageClient';

export const useCloudState = <T,>(key: string, defaultValue: T) => {
  const [value, setValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await getStorageItem<T>(key);
        if (active && stored !== null && stored !== undefined) {
          setValue(stored);
        }
      } catch (err) {
        console.error(`Failed to load ${key} from Cloud SQL`, err);
        if (active) setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [key]);

  const persist = useCallback(
    (update: SetStateAction<T>) => {
      setValue(prev => {
        const next = typeof update === 'function' ? (update as (value: T) => T)(prev) : update;
        void setStorageItem(key, next);
        return next;
      });
    },
    [key]
  );

  const clear = useCallback(async () => {
    setValue(defaultValue);
    setLoading(false);
    await removeStorageItem(key);
  }, [defaultValue, key]);

  return { value, setValue: persist, loading, error, clear };
};
