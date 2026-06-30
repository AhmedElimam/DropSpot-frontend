import { useState, useCallback, useRef } from 'react';
import { search as searchApi, type SearchResult } from '@/api/search';

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback((query: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setIsLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const data = await searchApi(query);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
        setHasSearched(true);
      }
    }, 400);
  }, []);

  return { results, isLoading, hasSearched, search };
}
