/**
 * How a school's login address is derived from its id.
 *
 * Shared on purpose between the login screen (src/components/Onboarding.tsx) and the
 * server-side admin route (api/_lib/admin.ts): the address the admin creates an
 * account with must be byte-identical to the one the login screen signs in with, or
 * that school simply cannot get in. Two copies of this rule would eventually drift.
 *
 * The address is synthetic and never shown to anyone — there is no mailbox behind it.
 */
export const SCHOOL_EMAIL_DOMAIN = 'schools.holon.test';

export const schoolEmail = (schoolId: string) => `${schoolId}@${SCHOOL_EMAIL_DOMAIN}`;
