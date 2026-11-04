import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../services/api.js';

/**
 * Busca dados da API com estados de carregamento/erro e recarga.
 *   const { data, loading, error, reload } = useApi('/clients', { params: { q } });
 * Passe url = null para não buscar.
 */
export function useApi(url, { params, initial = null, keepPrevious = true } = {}) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState(null);
  const key = JSON.stringify([url, params]);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    if (!keepPrevious) setData(initial);
    try {
      const res = await api.get(url, { params });
      if (id === seq.current) setData(res.data);
    } catch (err) {
      if (id === seq.current) setError(errorMessage(err));
    } finally {
      if (id === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load, setData };
}

/** Executa mutações com estado de envio. */
export function useMutation() {
  const [submitting, setSubmitting] = useState(false);
  const run = useCallback(async (fn) => {
    setSubmitting(true);
    try {
      return await fn();
    } finally {
      setSubmitting(false);
    }
  }, []);
  return { submitting, run };
}

export function useDebounce(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
