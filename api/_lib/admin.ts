import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { schoolEmail } from './schoolIdentity.js';

/**
 * Server-side school administration for the municipal console.
 *
 * Why this exists at all: everything else the admin console does is a plain RLS-scoped
 * write from the browser. Schools are different on two counts —
 *   1. `public.schools` is super_admin-only for insert/delete (see the tenancy
 *      migration), and there is no super_admin account;
 *   2. the login itself lives in `auth.users`, which PostgREST does not expose.
 * Both need the service_role key, which must never reach the browser. So: one server
 * route, holding the key, that re-verifies the caller on every request.
 *
 * The caller is verified twice over: the bearer token must be a real Supabase session
 * (GoTrue validates the signature), and that user's `profiles.role` must be a municipal
 * admin. The client never says who it is — we look it up. Every action is then scoped
 * to that admin's own municipality, so a city admin cannot touch another city's schools.
 *
 * A school is never deleted. Retiring sets `schools.is_active = false` and bans the
 * login; the plans, assessments and files all stay, and re-opening restores access.
 */

const SERVICE_ENV_HINT =
  'ניהול בתי הספר אינו זמין: חסרה הגדרת שרת (SUPABASE_SERVICE_ROLE_KEY).';

/** 100 years. GoTrue has no "forever", so this is the idiom for an indefinite ban. */
const BAN_FOREVER = '876000h';

export type AdminAction = 'list' | 'create' | 'rename' | 'setActive' | 'resetPassword';

export interface AdminBody {
  action?: AdminAction;
  schoolId?: string;
  name?: string;
  password?: string;
  active?: boolean;
  /** super_admin only — a city admin always operates on its own municipality. */
  municipalityId?: string;
}

export interface AdminResult {
  status: number;
  json: Record<string, unknown>;
}

const err = (status: number, error: string): AdminResult => ({ status, json: { error } });

function serviceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface Caller {
  userId: string;
  role: 'city_admin' | 'super_admin';
  municipalityId: string;
}

/**
 * Resolve and authorise the caller from its bearer token. Returns a Hebrew error
 * result instead of a caller when anything is off — the client shows it as-is.
 */
async function authorise(
  admin: SupabaseClient,
  authHeader: string | undefined,
  body: AdminBody,
): Promise<Caller | AdminResult> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return err(401, 'לא מחוברים.');

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return err(401, 'ההתחברות פגה. היכנסו מחדש.');

  const { data: profile } = await admin
    .from('profiles')
    .select('role, municipality_id')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile || (profile.role !== 'city_admin' && profile.role !== 'super_admin')) {
    return err(403, 'אין הרשאה לנהל בתי ספר.');
  }

  // A city admin is pinned to its own municipality; only a super_admin may name one.
  const municipalityId =
    profile.role === 'super_admin'
      ? (profile.municipality_id ?? body.municipalityId ?? null)
      : profile.municipality_id;

  if (!municipalityId) return err(400, 'לא ידוע לאיזו רשות המשתמש שייך.');

  return { userId: data.user.id, role: profile.role, municipalityId };
}

/** Confirms the school belongs to the caller's municipality before any write. */
async function ownedSchool(admin: SupabaseClient, caller: Caller, schoolId: string | undefined) {
  if (!schoolId) return null;
  const { data } = await admin
    .from('schools')
    .select('id, name, is_active, municipality_id')
    .eq('id', schoolId)
    .maybeSingle();

  if (!data || data.municipality_id !== caller.municipalityId) return null;
  return data;
}

// ---- actions ----------------------------------------------------------------

/** Row shape of `public.admin_school_accounts` (service_role-only helper). */
interface SchoolAccount {
  school_id: string;
  user_id: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
}

async function schoolAccounts(admin: SupabaseClient, municipalityId: string) {
  const { data } = await admin.rpc('admin_school_accounts', {
    p_municipality_id: municipalityId,
  });
  return (data ?? []) as SchoolAccount[];
}

async function list(admin: SupabaseClient, caller: Caller): Promise<AdminResult> {
  const { data: schools, error } = await admin
    .from('schools')
    .select('id, name, is_active, current_plan_id, access_code')
    .eq('municipality_id', caller.municipalityId)
    .order('name');

  if (error) return err(500, 'טעינת בתי הספר נכשלה.');

  // last_sign_in_at / banned_until live in auth.users, reachable only through the
  // service_role-only helper added by the school_admin migration.
  const accounts = await schoolAccounts(admin, caller.municipalityId);
  const bySchool = new Map(accounts.map((a) => [a.school_id, a]));

  return {
    status: 200,
    json: {
      schools: (schools ?? []).map((s) => {
        const account = bySchool.get(s.id);
        return {
          id: s.id,
          name: s.name,
          isActive: s.is_active,
          // The plain code, so the admin can read it back to a principal on the phone.
          // Only ever leaves the server on this admin-authorised route.
          accessCode: s.access_code ?? '',
          hasLogin: !!account,
          lastSignInAt: account?.last_sign_in_at ?? null,
          blocked: !!account?.banned_until && new Date(account.banned_until) > new Date(),
          hasPlan: !!s.current_plan_id,
        };
      }),
    },
  };
}

async function create(
  admin: SupabaseClient,
  caller: Caller,
  body: AdminBody,
): Promise<AdminResult> {
  const name = (body.name ?? '').trim();
  const password = (body.password ?? '').trim();
  if (name.length < 2) return err(400, 'יש להזין שם לבית הספר.');
  if (password.length < 4) return err(400, 'הסיסמה חייבת להכיל לפחות 4 תווים.');

  const { data: school, error } = await admin
    .from('schools')
    .insert({ municipality_id: caller.municipalityId, name })
    .select('id, name')
    .single();

  if (error || !school) {
    // unique (municipality_id, name)
    const duplicate = error?.code === '23505';
    return err(duplicate ? 409 : 500, duplicate ? 'כבר קיים בית ספר בשם הזה.' : 'יצירת בית הספר נכשלה.');
  }

  // The login is created through GoTrue so every internal auth column is filled
  // correctly; the password is then set to the admin's short code by the DB helper,
  // which is not bound by GoTrue's minimum length.
  //
  // Role and school go in `app_metadata`, which only this key can write — that is what
  // the signup trigger reads (see the 20260807140000 migration). Putting them in
  // `user_metadata` would be reading back whatever a client could have sent. The
  // display name stays in user_metadata: it is a label, not a permission.
  const { error: authError } = await admin.auth.admin.createUser({
    email: schoolEmail(school.id),
    password: `bootstrap-${school.id}`,
    email_confirm: true,
    app_metadata: { role: 'school', school_id: school.id },
    user_metadata: { display_name: name },
  });

  if (authError) {
    // Don't leave a school nobody can sign in to — it would show in the picker and
    // reject every password.
    await admin.from('schools').delete().eq('id', school.id);
    return err(500, 'יצירת הכניסה לבית הספר נכשלה, ובית הספר לא נוצר.');
  }

  const { data: ok, error: pwError } = await admin.rpc('admin_set_school_password', {
    p_school_id: school.id,
    p_password: password,
  });

  if (pwError || ok === false) {
    return {
      status: 207,
      json: {
        school: { id: school.id, name: school.name },
        warning: 'בית הספר נוצר, אך קביעת הסיסמה נכשלה. אפסו אותה מהרשימה.',
      },
    };
  }

  return { status: 200, json: { school: { id: school.id, name: school.name } } };
}

async function rename(
  admin: SupabaseClient,
  caller: Caller,
  body: AdminBody,
): Promise<AdminResult> {
  const school = await ownedSchool(admin, caller, body.schoolId);
  if (!school) return err(404, 'בית הספר לא נמצא.');

  const name = (body.name ?? '').trim();
  if (name.length < 2) return err(400, 'יש להזין שם לבית הספר.');

  const { error } = await admin.from('schools').update({ name }).eq('id', school.id);
  if (error) {
    const duplicate = error.code === '23505';
    return err(duplicate ? 409 : 500, duplicate ? 'כבר קיים בית ספר בשם הזה.' : 'שינוי השם נכשל.');
  }

  return { status: 200, json: { ok: true } };
}

async function setActive(
  admin: SupabaseClient,
  caller: Caller,
  body: AdminBody,
): Promise<AdminResult> {
  const school = await ownedSchool(admin, caller, body.schoolId);
  if (!school) return err(404, 'בית הספר לא נמצא.');

  const active = body.active !== false;

  const { error } = await admin
    .from('schools')
    .update({ is_active: active })
    .eq('id', school.id);
  if (error) return err(500, 'עדכון מצב בית הספר נכשל.');

  // Hiding it from the picker is cosmetic — the ban is what actually closes the door.
  const accounts = await schoolAccounts(admin, caller.municipalityId);
  const account = accounts.find((a) => a.school_id === school.id);

  if (account?.user_id) {
    const { error: banError } = await admin.auth.admin.updateUserById(account.user_id, {
      ban_duration: active ? 'none' : BAN_FOREVER,
    });
    if (banError) {
      // Roll the flag back rather than report success on a door that is still open.
      await admin.from('schools').update({ is_active: !active }).eq('id', school.id);
      return err(500, 'עדכון הכניסה של בית הספר נכשל, והמצב לא שונה.');
    }
  }

  return { status: 200, json: { ok: true } };
}

async function resetPassword(
  admin: SupabaseClient,
  caller: Caller,
  body: AdminBody,
): Promise<AdminResult> {
  const school = await ownedSchool(admin, caller, body.schoolId);
  if (!school) return err(404, 'בית הספר לא נמצא.');

  const password = (body.password ?? '').trim();
  if (password.length < 4) return err(400, 'הסיסמה חייבת להכיל לפחות 4 תווים.');

  const { data: ok, error } = await admin.rpc('admin_set_school_password', {
    p_school_id: school.id,
    p_password: password,
  });

  if (error) return err(500, 'איפוס הסיסמה נכשל.');
  if (ok === false) return err(404, 'לבית הספר הזה אין עדיין כניסה למערכת.');

  return { status: 200, json: { ok: true } };
}

// ---- entry point ------------------------------------------------------------

export async function handleSchoolAdmin(
  body: AdminBody | undefined,
  authHeader: string | undefined,
): Promise<AdminResult> {
  const admin = serviceClient();
  if (!admin) return err(500, SERVICE_ENV_HINT);

  const payload = body ?? {};
  const caller = await authorise(admin, authHeader, payload);
  if ('status' in caller) return caller;

  switch (payload.action) {
    case 'list':
      return list(admin, caller);
    case 'create':
      return create(admin, caller, payload);
    case 'rename':
      return rename(admin, caller, payload);
    case 'setActive':
      return setActive(admin, caller, payload);
    case 'resetPassword':
      return resetPassword(admin, caller, payload);
    default:
      return err(400, 'פעולה לא מוכרת.');
  }
}
