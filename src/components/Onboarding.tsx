import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ADMIN_EMAIL } from '../lib/adminAuth';
import { Button } from './ui/Button';

interface SchoolOption {
  id: string;
  name: string;
}

/** Synthetic login email for a school (never shown to the user). */
const schoolEmail = (schoolId: string) => `${schoolId}@schools.holon.test`;

/**
 * Step 1 — login. Simple UX: pick your school + type a short password (default
 * "0000", admin-changeable later). Behind the scenes each school has its own
 * Supabase session, so a school's data stays private to it (RLS). No email/signup
 * is ever shown to the user.
 *
 * The municipal admin signs in here too, in its own mode: it is not a school and has
 * no row in `schools`, so it gets a password-only form against a fixed account. Both
 * modes use the one main client — the app then routes on `profiles.role`.
 */
type Mode = 'school' | 'admin';

export const Onboarding: React.FC = () => {
  const [mode, setMode] = useState<Mode>('school');
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [schoolId, setSchoolId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setPassword('');
    setError(null);
  };

  // Load the school picker list (public directory RPC — works before login).
  useEffect(() => {
    let active = true;
    supabase
      .rpc('list_schools')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setError('טעינת רשימת בתי הספר נכשלה. רעננו את הדף.');
        } else {
          setSchools((data ?? []).map((s) => ({ id: s.id, name: s.name })));
        }
        setLoadingSchools(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const canSubmit =
    password.trim().length > 0 && !busy && (mode === 'admin' || schoolId.length > 0);

  const handleLogin = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: mode === 'admin' ? ADMIN_EMAIL : schoolEmail(schoolId),
      password,
    });
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'סיסמה שגויה' : 'אירעה שגיאה בכניסה. נסו שוב.');
      setBusy(false);
    }
    // On success App re-renders via the auth listener and routes on the profile role.
  };

  return (
    <div className="max-w-md mx-auto" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          className={`border-b border-slate-200 p-6 md:p-8 space-y-3 text-right ${
            mode === 'admin' ? 'bg-slate-900' : 'bg-primary-50'
          }`}
        >
          <h1
            className={`text-2xl md:text-3xl font-bold leading-tight ${
              mode === 'admin' ? 'text-white' : 'text-slate-900'
            }`}
          >
            הפלנר
          </h1>
          <p className={`text-sm font-medium ${mode === 'admin' ? 'text-white/70' : 'text-slate-500'}`}>
            {mode === 'admin' ? 'כניסת מנהל/ת המערכת העירוני' : 'כניסה למערכת התכנון הבית-ספרית'}
          </p>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          <div className="space-y-4">
            {mode === 'school' && (
              <div className="space-y-1.5 text-right">
                <label className="block text-sm font-semibold text-slate-700">בית הספר</label>
                <select
                  value={schoolId}
                  disabled={loadingSchools}
                  onChange={(e) => {
                    setSchoolId(e.target.value);
                    setError(null);
                  }}
                  className={`w-full p-3 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 border-slate-300 ${
                    schoolId ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  <option value="" disabled>
                    {loadingSchools ? 'טוען רשימת בתי ספר…' : 'בחרו את בית הספר מהרשימה…'}
                  </option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id} className="text-slate-900">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5 text-right">
              <label className="block text-sm font-semibold text-slate-700">סיסמה</label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) handleLogin();
                }}
                placeholder="הזינו סיסמה…"
                className={`w-full p-3 text-sm bg-white text-slate-900 border rounded-xl focus:outline-none focus:ring-2 ${
                  error
                    ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                    : 'border-slate-300 focus:ring-primary-500 focus:border-primary-500'
                }`}
              />
              {error && (
                <p className="flex items-center gap-1.5 text-xs font-bold text-rose-600 pt-1">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  {error}
                </p>
              )}
            </div>
          </div>

          <Button onClick={handleLogin} disabled={!canSubmit} size="lg" className="w-full">
            <span>
              {busy ? 'מתחבר…' : mode === 'admin' ? 'כניסה לאזור הניהול' : 'כניסה לערכת הכלים'}
            </span>
            {!busy && <i className="fa-solid fa-arrow-left"></i>}
          </Button>

          {/* Understated on purpose: 43 principals see this screen, one admin uses it. */}
          <div className="text-center pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => switchMode(mode === 'admin' ? 'school' : 'admin')}
              className="text-[11px] text-slate-400 hover:text-slate-600 font-medium transition-colors cursor-pointer pt-3 inline-flex items-center gap-1.5"
            >
              <i className={`fa-solid ${mode === 'admin' ? 'fa-arrow-right' : 'fa-user-shield'} text-[10px]`}></i>
              {mode === 'admin' ? 'חזרה לכניסת בית ספר' : 'כניסת מנהל מערכת'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
