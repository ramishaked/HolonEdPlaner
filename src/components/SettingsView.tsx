import React, { useRef, useState } from 'react';
import { ActionPlan, SchoolProfile } from '../types';

interface SettingsViewProps {
  profile: SchoolProfile;
  onUpdateProfile: (fields: Partial<SchoolProfile>) => void;
  actionPlan: ActionPlan;
  onUpdateActionPlan: (fields: Partial<ActionPlan>) => void;
  onResetDiagnostic: () => void;
  onClose: () => void;
}

const APP_VERSION = '0.3 (Demo)';

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
}) => {
  const logoInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminNotice, setAdminNotice] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onUpdateProfile({ logoDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    if (list.length === 0) return;
    onUpdateProfile({
      files: [...profile.files, ...list.map((f) => ({ name: f.name, size: f.size, type: f.type }))],
    });
    e.target.value = '';
  };

  const removeFile = (idx: number) =>
    onUpdateProfile({ files: profile.files.filter((_, i) => i !== idx) });

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
            <p className="text-xs text-slate-500">זהות בית הספר, ניהול נתונים ומידע על המערכת</p>
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
                  onClick={() => onUpdateProfile({ logoDataUrl: '' })}
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
            <p className="text-[10px] text-slate-400">בשלב זה נשמרת רשימת הקבצים בלבד. אחסון הקבצים עצמם בענן יתווסף בהמשך.</p>
          </div>
        </Field>
      </Card>

      {/* ============ 2. Admin screen ============ */}
      <Card
        icon="fa-solid fa-user-shield"
        title="מסך מנהל המערכת"
        subtitle="כניסה מאובטחת לניהול המערכת ברמה העירונית. נדרשת סיסמת ניהול."
        accent="text-indigo-600 bg-indigo-50"
      >
        <button
          onClick={() => { setAdminOpen(true); setAdminNotice(false); setAdminPassword(''); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
        >
          <i className="fa-solid fa-lock"></i>
          כניסה למסך מנהל המערכת
        </button>
      </Card>

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
            תוכנית העצמה בית ספרית, ברוח שבעת עקרונות תמונת העתיד והמציאות המשתנה.
          </p>
          <p>
            הכלי מלווה את הנהלת בית הספר במסע: היכרות עם העקרונות, אבחון בשלות עצמי, תכנון פעולות והפקת תוכנית עבודה שנתית.
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs font-mono text-slate-500 pt-2 border-t border-slate-100">
            <span><strong>גרסה:</strong> {APP_VERSION}</span>
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

      {/* -------- admin password modal -------- */}
      {adminOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setAdminOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 p-6 space-y-4 text-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg shrink-0">
                <i className="fa-solid fa-user-shield"></i>
              </span>
              <h3 className="text-base font-bold text-slate-900">כניסה למסך מנהל המערכת</h3>
            </div>
            {adminNotice ? (
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                <i className="fa-solid fa-screwdriver-wrench"></i>
                מסך מנהל המערכת בבנייה ויתווסף בקרוב.
              </div>
            ) : (
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && adminPassword.trim()) setAdminNotice(true); }}
                placeholder="סיסמת ניהול…"
                autoFocus
                className={inputCls}
              />
            )}
            <div className="flex gap-2.5 justify-end pt-1">
              {!adminNotice && (
                <button
                  onClick={() => setAdminNotice(true)}
                  disabled={!adminPassword.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  כניסה
                </button>
              )}
              <button
                onClick={() => setAdminOpen(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                סגירה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
