import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

/**
 * Carrega os cadastros usados nos formulários (serviços, pacotes, instrutores, salas,
 * equipamentos) de acordo com as permissões do usuário.
 */
export function useCatalog({ include = ['services', 'packages', 'instructors', 'rooms', 'resources', 'categories'] } = {}) {
  const { can } = useAuth();
  const [data, setData] = useState({ services: [], packages: [], instructors: [], rooms: [], resources: [], categories: [] });
  const [loading, setLoading] = useState(true);

  const key = include.join(',');
  const load = useCallback(async () => {
    const sources = {
      services: can('catalog:view', 'appointments:view') && '/services',
      packages: can('catalog:view', 'appointments:view') && '/packages',
      instructors: can('instructors:view', 'appointments:view') && '/instructors',
      rooms: can('rooms:view') && '/rooms',
      resources: can('rooms:view') && '/resources',
      categories: can('sales:view', 'expenses:view') && '/categories',
    };
    const wanted = key.split(',').filter((k) => sources[k]);
    setLoading(true);
    const results = await Promise.all(wanted.map((k) => api.get(sources[k]).then((r) => r.data).catch(() => [])));
    setData((prev) => ({ ...prev, ...Object.fromEntries(wanted.map((k, i) => [k, results[i]])) }));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...data, loading, reload: load };
}
