import React, { useState } from 'react';
import { ActionPlan } from '../types';
import { Button } from './ui/Button';

interface OnboardingProps {
  actionPlan: ActionPlan;
  onUpdateActionPlan: (fields: Partial<ActionPlan>) => void;
  onContinue: () => void;
}

/** Holon secondary schools — the login picker list. */
const SCHOOLS: string[] = [
  'אורט - למדע וטכנולוגיה',
  'אילון',
  'אלון (תיכון ק"ש-אלון)',
  'ארן',
  'הייטק היי (פרס ברוח הייטק היי)',
  'הראל (הראל ק. חינוך בנ"ע)',
  'הרצוג',
  'טומשין',
  'יבנה (תיכון יבנה)',
  'יונתן (מקיף ע"ש יונתן נתניהו)',
  'מיטרני',
  'נבון (נבון יצחק)',
  'נעמת תיכון טכנולוגי',
  'עתידים',
  'קוגל',
  'קציר',
  'קרית שרת',
];

// Phase 2: validate against the DB. For now there is no auth backend, so every
// attempt fails by design.
const checkPassword = (_school: string, _password: string): boolean => false;

/**
 * Step 1 — login / "identify your school".
 * The principal picks the school from a list and enters a password. Real auth
 * lands in Phase 2 (passwords stored in the DB); until then any submission
 * returns "סיסמא לא נכונה".
 */
export const Onboarding: React.FC<OnboardingProps> = ({ actionPlan, onUpdateActionPlan, onContinue }) => {
  const [selectedSchool, setSelectedSchool] = useState<string>(actionPlan.schoolName || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = selectedSchool.trim().length > 0 && password.trim().length > 0;

  const handleLogin = () => {
    if (checkPassword(selectedSchool, password)) {
      onUpdateActionPlan({ schoolName: selectedSchool });
      onContinue();
    } else {
      setError('סיסמא לא נכונה');
    }
  };

  return (
    <div className="max-w-2xl mx-auto" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Accent strip header */}
        <div className="bg-primary-50 border-b border-slate-200 p-6 md:p-8 space-y-3 text-right">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700">
            <i className="fa-solid fa-school text-xs"></i>
            כניסה לערכת הכלים
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
            הפלנר <span className="text-slate-400 font-medium">(Holon School Educational Planner)</span>
          </h1>
          <p className="text-sm text-primary-700 font-semibold leading-relaxed">
            העוזר החכם שלך לבניית תוכנית העצמה בית ספרית ברוח עקרונות תמונת העתיד והמציאות המשתנה
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            בחרו את בית הספר והזינו סיסמה כדי להיכנס. שם בית הספר יופיע בתוכנית העבודה ובדוח להדפסה.
          </p>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5 text-right">
              <label className="block text-sm font-semibold text-slate-700">בית הספר</label>
              <select
                value={selectedSchool}
                onChange={(e) => {
                  setSelectedSchool(e.target.value);
                  setError(null);
                }}
                className={`w-full p-3 text-sm bg-white text-slate-900 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  selectedSchool ? 'border-slate-300' : 'border-slate-300 text-slate-400'
                }`}
              >
                <option value="" disabled>
                  בחרו את בית הספר מהרשימה…
                </option>
                {SCHOOLS.map((s) => (
                  <option key={s} value={s} className="text-slate-900">
                    {s}
                  </option>
                ))}
              </select>
            </div>

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

          {/* Placeholder note: real auth (passwords in DB) lands in Phase 2 */}
          <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <i className="fa-solid fa-circle-info mt-0.5 text-slate-400"></i>
            <span>
              מסך הכניסה בבנייה: בהמשך הסיסמאות יאומתו מול בסיס הנתונים של המערכת. בשלב זה הכניסה אינה פעילה עדיין.
            </span>
          </div>

          <Button onClick={handleLogin} disabled={!canSubmit} size="lg" className="w-full">
            <span>כניסה לערכת הכלים</span>
            <i className="fa-solid fa-arrow-left"></i>
          </Button>
        </div>
      </div>
    </div>
  );
};
