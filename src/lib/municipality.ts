import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * The signed-in admin's municipality. One row, read through RLS — a city admin may
 * select its own municipality (`municipalities_select`).
 *
 * The name is data, not a constant: the console is multi-tenant by schema, and a
 * hardcoded "חולון" would be wrong for the second city and unfixable without a deploy.
 */
export function useMunicipality() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase
      .from('municipalities')
      .select('name')
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setName(data?.name ?? '');
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { name, loading };
}
