/**
 * The municipal admin identity.
 *
 * There is no second Supabase client any more: the admin signs in on the main client
 * from the login screen like any other user, and `App` routes on `profiles.role`. What
 * remains here is the fixed account address the login form targets, plus the shape the
 * admin screens pass around.
 */
export const ADMIN_EMAIL = 'admin@holon.test';

export interface AdminViewer {
  userId: string;
  municipalityId: string | null;
  role: 'city_admin' | 'super_admin';
}
