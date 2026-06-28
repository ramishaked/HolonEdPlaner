import React from 'react';
import { ActionPlan } from '../types';
import { Button } from './ui/Button';

interface OnboardingProps {
  actionPlan: ActionPlan;
  onUpdateActionPlan: (fields: Partial<ActionPlan>) => void;
  onContinue: () => void;
}

/**
 * Step 1 — onboarding / "identify your school".
 * Placeholder for now: captures school name + year into the existing actionPlan
 * state. In Phase 2 this is where the real "pick school from list + password"
 * login slots in (after the DB exists).
 */
export const Onboarding: React.FC<OnboardingProps> = ({ actionPlan, onUpdateActionPlan, onContinue }) => {
  const canContinue = (actionPlan.schoolName || '').trim().length > 0;

  return (
    <div className="max-w-2xl mx-auto" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Accent strip header */}
        <div className="bg-primary-50 border-b border-slate-200 p-6 md:p-8 space-y-3 text-right">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700">
            <i className="fa-solid fa-school text-xs"></i>
            כניסה לערכת הכלים
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">ברוכים הבאים לקיט שבעת העקרונות</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            לפני שמתחילים, נזהה את בית הספר. הפרטים יופיעו בתוכנית העבודה ובדוח להדפסה.
          </p>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5 text-right">
              <label className="block text-sm font-semibold text-slate-700">שם בית הספר</label>
              <input
                type="text"
                value={actionPlan.schoolName}
                onChange={(e) => onUpdateActionPlan({ schoolName: e.target.value })}
                placeholder="הקלידו את שם בית הספר..."
                autoFocus
                className="w-full p-3 text-sm bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="space-y-1.5 text-right">
              <label className="block text-sm font-semibold text-slate-700">שנת לימודים</label>
              <input
                type="text"
                value={actionPlan.schoolYear}
                onChange={(e) => onUpdateActionPlan({ schoolYear: e.target.value })}
                placeholder='למשל: תשפ"ז (2026-2027)'
                className="w-full p-3 text-sm bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Placeholder note: real login lands here in Phase 2 */}
          <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <i className="fa-solid fa-circle-info mt-0.5 text-slate-400"></i>
            <span>
              בהמשך הפיתוח כאן ייכנס מסך כניסה מאובטח: בחירת בית הספר מתוך רשימה והזנת סיסמה. בשלב זה רושמים את שם בית הספר בלבד.
            </span>
          </div>

          <Button onClick={onContinue} disabled={!canContinue} size="lg" className="w-full">
            <span>כניסה לערכת הכלים</span>
            <i className="fa-solid fa-arrow-left"></i>
          </Button>
        </div>
      </div>
    </div>
  );
};
