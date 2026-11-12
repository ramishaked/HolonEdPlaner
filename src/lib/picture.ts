import { supabase } from './supabase';
import { PICTURE_PAGE_URL } from '../../api/_lib/pictureSource';

/** The page framed in the "התמונה החינוכית" zone. Overridable for local work on the page. */
export const picturePageUrl: string =
  (import.meta.env.VITE_PICTURE_PAGE_URL as string | undefined) || PICTURE_PAGE_URL;

export interface PictureData {
  school: string;
  tabs: { gid: string; name: string; csv: string }[];
}

/**
 * Does this school have a picture at all? Most schools (the primaries) do not, and for
 * them the zone is not shown. Fails closed: any error means "no zone", never a broken
 * journey. Read through RLS, so a school can only ever ask about itself.
 */
export async function hasPicture(schoolId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('schools')
      .select('picture_name')
      .eq('id', schoolId)
      .maybeSingle();
    return !error && !!data?.picture_name;
  } catch {
    return false;
  }
}

/** The signed-in school's figures. The server decides which school: nothing is passed. */
export async function fetchPicture(): Promise<PictureData> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('לא מחוברים.');
  const res = await fetch('/api/picture', { headers: { Authorization: `Bearer ${token}` } });
  const json = (await res.json().catch(() => null)) as (PictureData & { error?: string }) | null;
  if (!res.ok || !json || json.error) throw new Error(json?.error || 'טעינת התמונה החינוכית נכשלה.');
  return json;
}
