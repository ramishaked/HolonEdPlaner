import React, { useEffect, useRef, useState } from 'react';
import { ActionPlan, Principle, SchoolProfile } from '../types';
import { version } from '../../package.json';
import { usePrinciples } from '../lib/PrinciplesContext';
import { principleTheme } from '../lib/principleTheme';
import {
  deleteSchoolPrinciple,
  schoolPrincipleFootprint,
  SCHOOL_PRINCIPLE_SLOTS,
  type SchoolPrincipleFootprint,
} from '../lib/principlesAdmin';
import { SchoolPrincipleWizard } from './SchoolPrincipleWizard';
import { ConfirmDialog } from './admin/fields';

interface SettingsViewProps {
  profile: SchoolProfile;
  onUpdateProfile: (fields: Partial<SchoolProfile>) => void;
  actionPlan: ActionPlan;
  onUpdateActionPlan: (fields: Partial<ActionPlan>) => void;
  onResetDiagnostic: () => void;
  onClose: () => void;
  /** Logo + attachments live in Supabase Storage (handled by App). */
  onUploadLogo: (file: File) => void | Promise<void>;
  onRemoveLogo: () => void | Promise<void>;
  onUploadFiles: (files: File[]) => void | Promise<void>;
  onRemoveFile: (index: number) => void | Promise<void>;
  /** Owner of any principle created here. Null until the school session resolves. */
  schoolId: string | null;
  userId: string;
  /** Refetch the principle set after a create or an edit. */
  onPrinciplesChanged: () => void;
  /**
   * A delete frees the order_index slot for the next create, so App must drop the
   * in-memory state keyed by it before the debounced saves re-attach it.
   */
  onPrincipleDeleted: (orderIndex: number) => void;
  /** Scroll to a specific card on open — set when arriving from a link, not the gear. */
  focusSection?: 'principles' | null;
}

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// A consistent settings card with an icon header.
const Card: React.FC<{ icon: string; title: string; subtitle?: string; children: React.ReactNode; accent?: string }> = ({
  icon,
  title,
  subtitle,
  children,
  accent = 'text-primary-600 bg-primary-50',
}) => (
  <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
    <div className="flex items-start gap-3">
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <i className={`${icon} text-base`}></i>
      </span>
      <div>
        <h2 className="font-bold text-slate-900 leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{subtitle}</p>}
      </div>
    </div>
    {children}
  </section>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-bold text-slate-600">{label}</label>
    {children}
  </div>
);

const inputCls =
  'w-full p-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  onUpdateProfile,
  actionPlan,
  onUpdateActionPlan,
  onResetDiagnostic,
  onClose,
  onUploadLogo,
  onRemoveLogo,
  onUploadFiles,
  onRemoveFile,
  schoolId,
  userId,
  onPrinciplesChanged,
  onPrincipleDeleted,
  focusSection,
}) => {
  const logoInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  // ---- The school's own principles -------------------------------------------------
  const { principles, rubrics, displayNumbers } = usePrinciples();
  const owned = principles.filter((p) => p.scope === 'school');
  const slotsLeft = SCHOOL_PRINCIPLE_SLOTS - owned.length;

  const [wizard, setWizard] = useState<{ editing?: Principle } | null>(null);
  const [notice, setNotice] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Principle | null>(null);
  const [footprint, setFootprint] = useState<SchoolPrincipleFootprint | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Arriving from the principle menu's link: bring the card into view and ring it, so it
  // is obvious which of the five cards the link was pointing at. The ring fades on its own
  // rather than needing a dismiss.
  const principlesCard = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    if (focusSection !== 'principles') return;
    // Deferred to a macrotask, not requestAnimationFrame: this screen has just replaced
    // the journey, and a scroll issued from inside a frame callback — before the swapped
    // layout is painted — is silently dropped. A timeout runs after the paint and lands.
    //
    // Default scroll behaviour rather than `smooth` for the same reason: an animation
    // that sometimes does nothing would leave the principal on the business card with no
    // sign the link went anywhere. The ring is what draws the eye once she arrives.
    // `start`, not `center`: the card is taller than a laptop viewport, so centring it
    // pushes its own heading off the top. `scroll-mt-24` on the wrapper keeps it clear
    // of the sticky app bar.
    const scroll = setTimeout(() => {
      principlesCard.current?.scrollIntoView({ block: 'start' });
    }, 0);
    setHighlight(true);
    const fade = setTimeout(() => setHighlight(false), 2600);
    return () => {
      clearTimeout(scroll);
      clearTimeout(fade);
    };
  }, [focusSection]);

  const askDelete = async (p: Principle) => {
    setPendingDelete(p);
    setFootprint(null);
    setFootprint(await schoolPrincipleFootprint(p.uuid));
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const result = await deleteSchoolPrinciple(pendingDelete.uuid);
    setDeleting(false);
    if (!result.ok) {
      setNotice(result.error ?? 'המחיקה נכשלה.');
      setPendingDelete(null);
      return;
    }
    onPrincipleDeleted(pendingDelete.id);
    setNotice(`"${pendingDelete.title}" נמחק.`);
    setPendingDelete(null);
  };

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onUploadLogo(file);
    e.target.value = '';
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    if (list.length === 0) return;
    onUploadFiles(list);
    e.target.value = '';
  };

  const removeFile = (idx: number) => onRemoveFile(idx);

  return (
    <div className="max-w-4xl mx-auto space-y-6 print:hidden" dir="rtl">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <i className="fa-solid fa-gear text-base"></i>
          </span>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">הגדרות</h1>
          </div>
        </div>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <i className="fa-solid fa-arrow-right"></i>
          חזרה
        </button>
      </div>

      {/* ============ 1. School business card ============ */}
      <Card
        icon="fa-solid fa-id-card"
        title="כרטיס ביקור בית ספרי"
        subtitle="פרטי הזהות הבית-ספרית. המידע ישמש בתוכנית העבודה, בדוחות ובהמשך גם ביועץ ה-AI."
      >
        {/* logo */}
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
            {profile.logoDataUrl ? (
              <img src={profile.logoDataUrl} alt="לוגו בית הספר" className="w-full h-full object-contain" />
            ) : (
              <i className="fa-solid fa-image text-slate-300 text-2xl"></i>
            )}
          </div>
          <div className="space-y-1.5">
            <span className="block text-xs font-bold text-slate-600">לוגו בית הספר</span>
            <div className="flex gap-2">
              <button
                onClick={() => logoInput.current?.click()}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-100 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-upload ml-1"></i>
                {profile.logoDataUrl ? 'החלפת לוגו' : 'העלאת לוגו'}
              </button>
              {profile.logoDataUrl && (
                <button
                  onClick={() => onRemoveLogo()}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-100 transition-colors cursor-pointer"
                >
                  הסרה
                </button>
              )}
            </div>
            <input ref={logoInput} type="file" accept="image/*" onChange={handleLogo} className="hidden" />
          </div>
        </div>

        {/* identity fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="שם בית הספר">
            <input
              type="text"
              value={actionPlan.schoolName}
              onChange={(e) => onUpdateActionPlan({ schoolName: e.target.value })}
              placeholder="שם בית הספר"
              className={inputCls}
            />
          </Field>
          <Field label="שם המנהל/ת">
            <input
              type="text"
              value={profile.principalName}
              onChange={(e) => onUpdateProfile({ principalName: e.target.value })}
              placeholder="שם מלא"
              className={inputCls}
            />
          </Field>
          <Field label="ותק המנהל/ת בתפקיד">
            <input
              type="text"
              value={profile.principalSeniority}
              onChange={(e) => onUpdateProfile({ principalSeniority: e.target.value })}
              placeholder='למשל: 8 שנים'
              className={inputCls}
            />
          </Field>
          <Field label="כמות תלמידים">
            <input
              type="text"
              value={profile.studentCount}
              onChange={(e) => onUpdateProfile({ studentCount: e.target.value })}
              placeholder="למשל: 640"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="חזון בית הספר">
          <textarea
            value={profile.vision}
            onChange={(e) => onUpdateProfile({ vision: e.target.value })}
            rows={3}
            placeholder="נסחו את החזון הבית-ספרי…"
            className={`${inputCls} leading-relaxed resize-y`}
          />
        </Field>
        <Field label="יעדים מרכזיים">
          <textarea
            value={profile.goals}
            onChange={(e) => onUpdateProfile({ goals: e.target.value })}
            rows={3}
            placeholder="היעדים המובילים של בית הספר…"
            className={`${inputCls} leading-relaxed resize-y`}
          />
        </Field>
        <Field label="ייחודיות בית הספר">
          <textarea
            value={profile.uniqueness}
            onChange={(e) => onUpdateProfile({ uniqueness: e.target.value })}
            rows={3}
            placeholder="מה מייחד את בית הספר? (תוכניות דגל, אופי קהילתי, מגמות…)"
            className={`${inputCls} leading-relaxed resize-y`}
          />
        </Field>

        {/* file attachments */}
        <Field label="קבצים מצורפים (מצגת / מסמך זהות בית ספרית)">
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
            <button
              onClick={() => filesInput.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-paperclip"></i>
              הוספת קבצים
            </button>
            <input
              ref={filesInput}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.key,.odp,image/*"
              onChange={handleFiles}
              className="hidden"
            />
            {profile.files.length > 0 ? (
              <ul className="space-y-1.5">
                {profile.files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <i className="fa-solid fa-file text-slate-400 text-xs shrink-0"></i>
                      <span className="text-xs font-medium text-slate-700 truncate">{f.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">{fmtSize(f.size)}</span>
                    </span>
                    <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-rose-600 transition-colors shrink-0" title="הסרה">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-400">לא צורפו קבצים עדיין.</p>
            )}
            <p className="text-[10px] text-slate-400">הקבצים נשמרים באחסון מאובטח ונגישים לבית הספר שלכם בלבד.</p>
          </div>
        </Field>
      </Card>

      {/* ============ 2. The school's own principles ============ */}
      <div
        ref={principlesCard}
        className={`rounded-2xl scroll-mt-24 transition-shadow duration-500 ${
          highlight ? 'ring-2 ring-amber-400 ring-offset-2' : ''
        }`}
      >
      <Card
        icon="fa-solid fa-star"
        title="העקרונות הייחודיים של בית הספר"
        subtitle={`עד ${SCHOOL_PRINCIPLE_SLOTS} עקרונות משלכם, לצד העקרונות העירוניים. עיקרון ייחודי מתנהג ככל עיקרון אחר — הוא מופיע בתפריט, נכלל באבחון ובמפת העכביש, אפשר לתכנן עליו יוזמות בית-ספריות, והוא נכנס למסמך תוכנית העבודה.`}
        accent="text-amber-600 bg-amber-50"
      >
        {notice && (
          <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
            {notice}
          </p>
        )}

        {owned.length === 0 ? (
          <p className="text-xs text-slate-400 italic">
            עדיין לא הוגדר עיקרון ייחודי. אם יש בבית הספר תחום ייחודי שאינו מיוצג בעקרונות
            העירוניים — זה המקום להוסיף אותו.
          </p>
        ) : (
          <ul className="space-y-2">
            {owned.map((p) => {
              const colors = principleTheme(p.colorName);
              return (
                <li
                  key={p.uuid}
                  className="flex items-center gap-3 border border-slate-200 rounded-xl p-3 bg-slate-50/40"
                >
                  <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${colors.badge}`}>
                    <i className={p.icon} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{p.title}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      עיקרון {displayNumbers[p.id] ?? p.id}
                      {p.shortLabel ? ` · על מפת העכביש: ${p.shortLabel}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => { setNotice(''); setWizard({ editing: p }); }}
                    aria-label={`עריכת ${p.title}`}
                    className="text-slate-400 hover:text-primary-600 p-2 rounded-lg hover:bg-white cursor-pointer"
                  >
                    <i className="fa-solid fa-pen-to-square text-sm" />
                  </button>
                  <button
                    onClick={() => { setNotice(''); askDelete(p); }}
                    aria-label={`מחיקת ${p.title}`}
                    className="text-slate-400 hover:text-rose-600 p-2 rounded-lg hover:bg-white cursor-pointer"
                  >
                    <i className="fa-solid fa-trash-can text-sm" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setNotice(''); setWizard({}); }}
            disabled={slotsLeft <= 0 || !schoolId}
            title={
              slotsLeft <= 0
                ? `בית הספר כבר הגדיר ${SCHOOL_PRINCIPLE_SLOTS} עקרונות ייחודיים. כדי להוסיף אחר, יש למחוק אחד מהם.`
                : undefined
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-plus"></i>
            הוספת עיקרון ייחודי
          </button>
          <span className="text-[11px] font-bold text-slate-400">
            {owned.length}/{SCHOOL_PRINCIPLE_SLOTS} בשימוש
          </span>
        </div>
      </Card>
      </div>

      {wizard && schoolId && (
        <SchoolPrincipleWizard
          owner={{ schoolId, userId }}
          editing={
            wizard.editing
              ? {
                  principle: wizard.editing,
                  rubric: rubrics.find((r) => r.id === wizard.editing!.id),
                }
              : undefined
          }
          used={owned.length}
          onClose={() => setWizard(null)}
          onSaved={(message) => {
            setWizard(null);
            setNotice(message);
            onPrinciplesChanged();
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`למחוק את "${pendingDelete.title}"?`}
          confirmLabel="מחיקה לצמיתות"
          tone="danger"
          busy={deleting || !footprint}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        >
          {!footprint ? (
            <p>בודקים מה תלוי בעיקרון הזה…</p>
          ) : (
            <>
              <p>יימחקו יחד עם העיקרון, ואי אפשר לשחזר:</p>
              <ul className="space-y-1 pr-4 list-disc marker:text-rose-400">
                <li>העיקרון וארבע רמות הבשלות שלו</li>
                {footprint.assessed && <li>המיפוי העצמי שביצעתם בעיקרון הזה</li>}
                {footprint.activities > 0 && (
                  <li>
                    {footprint.activities === 1
                      ? 'פעילות אחת בתוכנית העבודה'
                      : `${footprint.activities} פעילויות בתוכנית העבודה`}
                  </li>
                )}
                {footprint.hasVision && <li>תמונת הניצחון שכתבתם עליו</li>}
                {footprint.focusRoles.includes('strength') && (
                  <li>בחירתו כעוגן העוצמה — המסמך יחזור ל&quot;טרם נבחר&quot;</li>
                )}
                {footprint.focusRoles.includes('breakthrough') && (
                  <li>בחירתו כיעד פריצת דרך — המסמך יחזור ל&quot;טרם נבחר&quot;</li>
                )}
              </ul>
              <p className="text-slate-500">
                העקרונות העירוניים אינם מושפעים, ומספרי העקרונות שאחריו יתעדכנו.
              </p>
            </>
          )}
        </ConfirmDialog>
      )}

      {/* ============ 3. Reset diagnostic ============ */}
      <Card
        icon="fa-solid fa-rotate-left"
        title="איפוס נתוני האבחון"
        subtitle="מחיקת כל תשובות האבחון ודוח ה-AI. פרטי בית הספר ותוכנית הפעולה יישמרו."
        accent="text-rose-600 bg-rose-50"
      >
        <button
          onClick={() => setShowResetConfirm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-100 transition-colors cursor-pointer"
        >
          <i className="fa-solid fa-trash-can"></i>
          איפוס נתוני האבחון
        </button>
      </Card>

      {/* ============ 4. Feedback ============ */}
      <Card
        icon="fa-solid fa-comment-dots"
        title="שליחת משוב"
        subtitle="ספרו לנו מה עובד, מה חסר ומה אפשר לשפר במערכת."
        accent="text-emerald-600 bg-emerald-50"
      >
        {feedbackSent ? (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <i className="fa-solid fa-circle-check"></i>
            תודה! המשוב נשלח בהצלחה.
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              placeholder="כתבו כאן את המשוב שלכם…"
              className={`${inputCls} leading-relaxed resize-y`}
            />
            <button
              onClick={() => { if (feedback.trim()) { setFeedbackSent(true); setFeedback(''); } }}
              disabled={!feedback.trim()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              <i className="fa-solid fa-paper-plane"></i>
              שליחת משוב
            </button>
            <p className="text-[10px] text-slate-400">הדגמה — בהמשך המשוב יישלח וירוכז עבור צוות הפיתוח.</p>
          </div>
        )}
      </Card>

      {/* ============ 5. About ============ */}
      <Card
        icon="fa-solid fa-circle-info"
        title="אודות המערכת"
        accent="text-slate-600 bg-slate-100"
      >
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
          <p>
            <strong className="text-slate-900">הפלנר (Holon School Educational Planner)</strong> — העוזר החכם לבניית
            תוכנית העצמה בית ספרית, ברוח עקרונות תמונת העתיד והמציאות המשתנה.
          </p>
          <p>
            הכלי מלווה את הנהלת בית הספר במסע: היכרות עם העקרונות, אבחון בשלות עצמי, תכנון פעולות והפקת תוכנית עבודה שנתית.
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs font-mono text-slate-500 pt-2 border-t border-slate-100">
            <span><strong>גרסה:</strong> v{version}</span>
            <span><strong>פיתוח:</strong> מינהל החינוך, עיריית חולון</span>
          </div>
        </div>
      </Card>

      {/* -------- reset confirm modal -------- */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowResetConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-6 text-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 text-xl shrink-0">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">איפוס נתוני האבחון</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  פעולה זו תמחק את כל תשובות האבחון ואת דוח ה-AI. פרטי בית הספר ותוכנית הפעולה יישמרו. לא ניתן לשחזר — להמשיך?
                </p>
              </div>
            </div>
            <div className="flex gap-2.5 justify-end pt-2">
              <button
                onClick={() => { onResetDiagnostic(); setShowResetConfirm(false); }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-rose-600/10 cursor-pointer"
              >
                איפוס
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
