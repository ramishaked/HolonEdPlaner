import { createClient } from '@supabase/supabase-js';

/**
 * "Is this request from a signed-in user?" — the token half of the check in
 * api/_lib/admin.ts, without the role lookup.
 *
 * The AI routes need a real user, not an administrator, so they must not require the
 * service_role key: CLAUDE.md commits to the whole app working without it (only the
 * school-management tab degrades), and gating AI on it would break a deployment that
 * never needed it. The anon key is enough — `getUser(token)` validates the JWT against
 * GoTrue either way.
 */

export interface AuthedUser {
  userId: string;
}

export interface AuthFailure {
  status: number;
  json: { error: string };
}

export const isAuthFailure = (r: AuthedUser | AuthFailure): r is AuthFailure => 'status' in r;

export async function requireUser(authHeader: string | undefined): Promise<AuthedUser | AuthFailure> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

  // Fail closed. A misconfigured server must never fall through to an
  // unauthenticated model call — that is exactly the hole this closes.
  if (!url || !key) {
    return { status: 500, json: { error: 'אימות המשתמש אינו זמין: חסרה הגדרת שרת.' } };
  }

  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { status: 401, json: { error: 'לא מחוברים.' } };

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return { status: 401, json: { error: 'ההתחברות פגה. היכנסו מחדש.' } };
  }

  return { userId: data.user.id };
}
