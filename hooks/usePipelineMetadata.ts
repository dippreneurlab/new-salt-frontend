import { useEffect, useState } from 'react';
import type { PipelineMetadata } from '@/lib/metadataClient';
import {
  DEFAULT_CLIENT_CATEGORY_MAP,
  DEFAULT_CLIENT_LIST,
  DEFAULT_RATE_CARD_MAP,
  hydratePipelineMetadata,
} from '@/utils/pipelineUtils';

export const usePipelineMetadata = () => {
  const [metadata, setMetadata] = useState<PipelineMetadata>({
    clients: DEFAULT_CLIENT_LIST,
    rateCardMap: DEFAULT_RATE_CARD_MAP,
    clientCategoryMap: DEFAULT_CLIENT_CATEGORY_MAP,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const loaded = await hydratePipelineMetadata();
        setMetadata(loaded);
        setError(null);
      } catch (err) {
        console.error('Failed to load pipeline metadata', err);
        setError(err instanceof Error ? err.message : 'Failed to load pipeline metadata');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { metadata, loading, error };
};
