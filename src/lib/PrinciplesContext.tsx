import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { fetchPrinciples, type LoadedPrinciples } from './principles';

interface PrinciplesValue extends LoadedPrinciples {
  loading: boolean;
  /** true once a load attempt finished without producing a principle set. */
  failed: boolean;
  reload: () => void;
}

// There is NO static fallback: the principle set is dynamic data and the DB is its
// only source of truth. A second hardcoded copy would drift and would briefly render
// the wrong set before the DB answers. While loading (or on failure) the app shows a
// spinner / error state instead — see the gate in App.tsx.
const EMPTY: LoadedPrinciples = {
  principles: [],
  rubrics: [],
  shortTitles: {},
  orderToId: {},
  displayNumbers: {},
};

const PrinciplesContext = createContext<PrinciplesValue>({
  ...EMPTY,
  loading: true,
  failed: false,
  reload: () => {},
});

export const usePrinciples = () => useContext(PrinciplesContext);

export const PrinciplesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [value, setValue] = useState<Omit<PrinciplesValue, 'reload'>>({
    ...EMPTY,
    loading: true,
    failed: false,
  });
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setValue((v) => ({ ...v, loading: true, failed: false }));
      const data = await fetchPrinciples();
      if (!active) return;
      if (data && data.principles.length) {
        setValue({ ...data, loading: false, failed: false });
      } else {
        // A mid-session failure (e.g. a 401 racing a token refresh, which reloads via
        // onAuthStateChange) must not dump the set the app is already using: emptying
        // orderToId while the debounced saves are armed turns them into destructive
        // no-mapping writes. Keep the last good set; "failed" is only a first load
        // that produced nothing.
        setValue((v) =>
          v.principles.length
            ? { ...v, loading: false, failed: false }
            : { ...EMPTY, loading: false, failed: true },
        );
      }
    };

    // Principles are readable only once authenticated (RLS), so load on session.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) load();
      // Signed out: not a failure — the login screen renders before any principle does.
      else setValue({ ...EMPTY, loading: false, failed: false });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) load();
      else setValue({ ...EMPTY, loading: false, failed: false });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [attempt]);

  return (
    <PrinciplesContext.Provider value={{ ...value, reload }}>{children}</PrinciplesContext.Provider>
  );
};
