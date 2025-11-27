export type PipelineMetadata = {
  clients: string[];
  rateCardMap: Record<string, string>;
  clientCategoryMap: Record<string, string>;
};

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5010').replace(/\/$/, '');
let cachedMetadata: PipelineMetadata | null = null;

const buildUrl = (path: string) => {
  if (path.startsWith('http')) return path;
  if (!path.startsWith('/')) return `${apiBase}/${path}`;
  return `${apiBase}${path}`;
};

export const fetchPipelineMetadata = async (): Promise<PipelineMetadata> => {
  if (cachedMetadata) return cachedMetadata;
  const res = await fetch(buildUrl('/api/metadata/pipeline'));
  if (!res.ok) {
    throw new Error(`Failed to load pipeline metadata (${res.status})`);
  }
  const data = (await res.json()) as PipelineMetadata;
  cachedMetadata = data;
  return data;
};

export const getCachedPipelineMetadata = () => cachedMetadata;
