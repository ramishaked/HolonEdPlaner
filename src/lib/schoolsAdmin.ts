import { supabase } from './supabase';
import type { SaveResult } from './adminAuth';

/**
 * Client side of school administration. Everything here is a call to `/api/admin/schools`,
 * because none of it can be done from the browser: `schools` is super_admin-only for
 * insert/delete, and the login lives in `auth.users`, which PostgREST does not expose.
 *
 * The server re-verifies the caller on every request — it does not trust anything sent
 * from here — so this module only forwards the session token and the intent.
 */

export interface AdminSchool {
  id: string;
  name: string;
  isActive: boolean;
  /** false when the school row exists but has no login yet. */
  hasLogin: boolean;
  lastSignInAt: string | null;
  /** The login is banned — what actually blocks a retired school from signing in. */
  blocked: boolean;
  hasPlan: boolean;
}

type Payload = Record<string, unknown>;

async function call(payload: Payload): Promise<{ ok: boolean; error?: string; data?: any }> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return { ok: false, error: 'ההתחברות פגה. היכנסו מחדש.' };

  let res: Response;
  try {
    res = await fetch('/api/admin/schools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, error: 'השרת אינו זמין. בדקו את החיבור ונסו שוב.' };
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: body?.error ?? 'הפעולה נכשלה.' };
  return { ok: true, data: body };
}

export async function fetchSchools(): Promise<{ schools: AdminSchool[]; error?: string }> {
  const r = await call({ action: 'list' });
  if (!r.ok) return { schools: [], error: r.error };
  return { schools: (r.data?.schools ?? []) as AdminSchool[] };
}

export async function createSchool(name: string, password: string): Promise<SaveResult> {
  const r = await call({ action: 'create', name, password });
  if (!r.ok) return { ok: false, error: r.error };
  // 207: the school exists but its password did not stick — say so rather than
  // report a clean success the admin would rely on.
  return r.data?.warning ? { ok: false, error: r.data.warning } : { ok: true };
}

export async function renameSchool(schoolId: string, name: string): Promise<SaveResult> {
  const r = await call({ action: 'rename', schoolId, name });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function setSchoolActive(schoolId: string, active: boolean): Promise<SaveResult> {
  const r = await call({ action: 'setActive', schoolId, active });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function resetSchoolPassword(
  schoolId: string,
  password: string,
): Promise<SaveResult> {
  const r = await call({ action: 'resetPassword', schoolId, password });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
