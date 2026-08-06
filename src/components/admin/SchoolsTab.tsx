import React, { useCallback, useEffect, useState } from 'react';
import {
  createSchool,
  fetchSchools,
  renameSchool,
  resetSchoolPassword,
  setSchoolActive,
  type AdminSchool,
} from '../../lib/schoolsAdmin';
import { Section } from './AdminChrome';
import { ConfirmDialog, Labeled, inputClass } from './fields';

interface Props {
  onNotice: (text: string) => void;
}

const lastSeen = (iso: string | null) => {
  if (!iso) return 'טרם נכנס';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  const date = d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  if (days === 0) return 'נכנס היום';
  if (days === 1) return 'נכנס אתמול';
  return `נכנס ${date}`;
};

/** Four digits is what a principal can be told over the phone. */
const suggestPassword = () => String(Math.floor(1000 + Math.random() * 9000));

/**
 * Adding, renaming, retiring and re-opening a school, and resetting its password.
 *
 * Unlike every other tab, none of this is an RLS-scoped write from the browser: the
 * school row and its login both need the service_role key, so each action is a call to
 * `/api/admin/schools`, which re-verifies the caller server-side. If the server is not
 * configured (no key) the tab says so plainly instead of failing silently.
 */
export const SchoolsTab: React.FC<Props> = ({ onNotice }) => {
  const [schools, setSchools] = useState<AdminSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState(suggestPassword);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [confirmRetire, setConfirmRetire] = useState<AdminSchool | null>(null);
  const [resetting, setResetting] = useState<AdminSchool | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [issued, setIssued] = useState<{ name: string; password: string } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const r = await fetchSchools();
    setSchools(r.schools);
    setLoadError(r.error ?? '');
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) { onNotice(`הפעולה נכשלה: ${r.error}`); return false; }
    onNotice(success);
    await reload();
    return true;
  };

  const add = async () => {
    const name = newName.trim();
    const password = newPassword.trim();
    const ok = await run(() => createSchool(name, password), `"${name}" נוסף לרשימת בתי הספר.`);
    if (ok) {
      setAdding(false);
      setNewName('');
      setNewPassword(suggestPassword());
      // The password is hashed the moment it is saved — this is the one chance to
      // read it, so show it until the admin dismisses it.
      setIssued({ name, password });
    }
  };

  const saveRename = async (s: AdminSchool) => {
    if (editingName.trim() === s.name) { setEditingId(null); return; }
    const ok = await run(() => renameSchool(s.id, editingName), 'שם בית הספר עודכן.');
    if (ok) setEditingId(null);
  };

  const active = schools.filter((s) => s.isActive);
  const retired = schools.filter((s) => !s.isActive);

  return (
    <>
      <Section
        icon="fa-solid fa-school"
        title="בתי הספר"
        subtitle="הוספה, שינוי שם, איפוס סיסמה והשבתה. סיסמאות נשמרות מוצפנות — אי אפשר לראות סיסמה קיימת, רק לקבוע חדשה."
        right={
          <button
            onClick={() => { setAdding((v) => !v); setNewPassword(suggestPassword()); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-primary-600 hover:opacity-90 transition-opacity shadow-sm cursor-pointer shrink-0"
          >
            <i className={`fa-solid ${adding ? 'fa-xmark' : 'fa-plus'}`} />
            {adding ? 'ביטול' : 'בית ספר חדש'}
          </button>
        }
      >
        {loadError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
            <p className="text-xs font-bold text-rose-800">{loadError}</p>
          </div>
        )}

        {adding && (
          <div className="border border-primary-100 bg-primary-50/40 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[220px]">
                <Labeled label="שם בית הספר">
                  <input
                    autoFocus
                    className={inputClass}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="למשל: אלונים"
                  />
                </Labeled>
              </div>
              <div className="w-40">
                <Labeled label="סיסמה ראשונית">
                  <div className="flex gap-1.5">
                    <input
                      className={inputClass}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setNewPassword(suggestPassword())}
                      title="הגרלת סיסמה"
                      aria-label="הגרלת סיסמה"
                      className="text-slate-400 hover:text-primary-600 px-2 rounded-lg cursor-pointer shrink-0"
                    >
                      <i className="fa-solid fa-dice text-xs" />
                    </button>
                  </div>
                </Labeled>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-slate-500">
                בית הספר יופיע מיד ברשימת הכניסה. מסרו את הסיסמה למנהל/ת — לא תוכלו לראות אותה שוב.
              </p>
              <button
                onClick={add}
                disabled={busy || newName.trim().length < 2 || newPassword.trim().length < 4}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer shrink-0"
              >
                {busy ? 'יוצר…' : 'יצירת בית הספר'}
              </button>
            </div>
          </div>
        )}

        <p className="text-[11px] text-slate-400">
          {loading ? 'טוען…' : `${active.length} בתי ספר פעילים`}
        </p>

        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[440px] overflow-y-auto">
          {active.map((s) => (
            <div key={s.id} className="p-3 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                {editingId === s.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => saveRename(s)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveRename(s);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className={inputClass}
                  />
                ) : (
                  <>
                    <p className="text-sm font-bold text-slate-800">{s.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {lastSeen(s.lastSignInAt)}
                      {s.hasPlan && ' · יש תוכנית'}
                      {!s.hasLogin && ' · אין כניסה למערכת'}
                    </p>
                  </>
                )}
              </div>

              {editingId !== s.id && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => { setResetting(s); setResetPassword(suggestPassword()); }}
                    title="איפוס סיסמה"
                    aria-label={`איפוס הסיסמה של ${s.name}`}
                    className="text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-key text-xs" />
                  </button>
                  <button
                    onClick={() => { setEditingId(s.id); setEditingName(s.name); }}
                    title="שינוי השם"
                    aria-label={`שינוי השם של ${s.name}`}
                    className="text-slate-300 hover:text-primary-600 hover:bg-primary-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-pen-to-square text-xs" />
                  </button>
                  <button
                    onClick={() => setConfirmRetire(s)}
                    title="השבתת בית הספר"
                    aria-label={`השבתת ${s.name}`}
                    className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-ban text-xs" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {!loading && !active.length && !loadError && (
            <p className="text-xs text-slate-400 text-center py-8">אין בתי ספר פעילים.</p>
          )}
        </div>

        {!!retired.length && (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-bold text-slate-400">
              מושבתים — הכניסה חסומה, הנתונים נשמרו במלואם
            </p>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
              {retired.map((s) => (
                <div key={s.id} className="p-3 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-500">{s.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {lastSeen(s.lastSignInAt)}
                      {s.hasPlan && ' · יש תוכנית שמורה'}
                    </p>
                  </div>
                  <button
                    onClick={() => run(() => setSchoolActive(s.id, true), `"${s.name}" הופעל מחדש.`)}
                    disabled={busy}
                    className="text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg cursor-pointer shrink-0"
                  >
                    <i className="fa-solid fa-rotate-left ml-1.5 text-[10px]" aria-hidden="true" />
                    הפעלה מחדש
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {confirmRetire && (
        <ConfirmDialog
          title="השבתת בית ספר"
          confirmLabel="השבתה"
          tone="neutral"
          busy={busy}
          onConfirm={async () => {
            const ok = await run(
              () => setSchoolActive(confirmRetire.id, false),
              `"${confirmRetire.name}" הושבת. הכניסה שלו חסומה.`,
            );
            if (ok) setConfirmRetire(null);
          }}
          onCancel={() => setConfirmRetire(null)}
        >
          <p>
            <strong className="text-slate-800">{confirmRetire.name}</strong> יירד מרשימת הכניסה,
            ו<strong>הכניסה שלו תיחסם בפועל</strong> — גם למי שיודע את הסיסמה.
          </p>
          <p>
            {confirmRetire.hasPlan
              ? 'התוכנית, האבחון והקבצים שלו נשמרים במלואם ואינם נמחקים.'
              : 'לבית הספר אין עדיין תוכנית שמורה.'}{' '}
            אין כאן מחיקה — הפעלה מחדש מחזירה הכול, כולל הסיסמה הקיימת.
          </p>
        </ConfirmDialog>
      )}

      {resetting && (
        <ConfirmDialog
          title={`איפוס הסיסמה של ${resetting.name}`}
          confirmLabel="קביעת הסיסמה"
          tone="neutral"
          busy={busy}
          onConfirm={async () => {
            const school = resetting;
            const password = resetPassword.trim();
            const ok = await run(
              () => resetSchoolPassword(school.id, password),
              `הסיסמה של "${school.name}" עודכנה.`,
            );
            if (ok) { setResetting(null); setIssued({ name: school.name, password }); }
          }}
          onCancel={() => setResetting(null)}
        >
          <p>הסיסמה הנוכחית שמורה מוצפנת ואי אפשר לראות אותה — אפשר רק לקבוע חדשה.</p>
          <div className="flex gap-1.5 pt-1">
            <input
              autoFocus
              className={inputClass}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => setResetPassword(suggestPassword())}
              title="הגרלת סיסמה"
              aria-label="הגרלת סיסמה"
              className="text-slate-400 hover:text-primary-600 px-2 rounded-lg cursor-pointer shrink-0"
            >
              <i className="fa-solid fa-dice text-xs" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400">לפחות 4 תווים.</p>
        </ConfirmDialog>
      )}

      {issued && (
        <ConfirmDialog
          title="הסיסמה נקבעה"
          confirmLabel="סגירה"
          tone="neutral"
          hideCancel
          onConfirm={() => setIssued(null)}
          onCancel={() => setIssued(null)}
        >
          <p>
            מסרו למנהל/ת של <strong className="text-slate-800">{issued.name}</strong> את הסיסמה:
          </p>
          <p
            dir="ltr"
            className="text-2xl font-bold tracking-[0.3em] text-center text-slate-900 bg-slate-50 border border-slate-200 rounded-xl py-3"
          >
            {issued.password}
          </p>
          <p>אחרי סגירת החלון לא ניתן יהיה לראות אותה שוב — היא נשמרת מוצפנת בלבד.</p>
        </ConfirmDialog>
      )}
    </>
  );
};
