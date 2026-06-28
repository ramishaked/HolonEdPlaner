import React from 'react';

interface FooterStep {
  id: string;
  label: string;
}

interface StepFooterProps {
  steps: FooterStep[];
  currentStep: string;
  onNavigate: (id: string) => void;
}

/**
 * One consistent prev/next bar at the bottom of every step page.
 * Back → previous step, Continue → next step. Replaces all the scattered,
 * ad-hoc "go to X" buttons from the old flat layout.
 */
export const StepFooter: React.FC<StepFooterProps> = ({ steps, currentStep, onNavigate }) => {
  const idx = steps.findIndex((s) => s.id === currentStep);
  const prev = idx > 0 ? steps[idx - 1] : null;
  const next = idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : null;

  if (!prev && !next) return null;

  return (
    <div className="mt-10 pt-5 border-t border-slate-200 flex items-center justify-between gap-4 print:hidden" dir="rtl">
      {prev ? (
        <button
          onClick={() => onNavigate(prev.id)}
          className="px-5 py-2.5 text-xs md:text-sm font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
        >
          <i className="fa-solid fa-arrow-right text-xs"></i>
          <span>חזרה: {prev.label}</span>
        </button>
      ) : (
        <span />
      )}

      {next ? (
        <button
          onClick={() => onNavigate(next.id)}
          className="px-6 py-3 text-xs md:text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md shadow-primary-600/20 transition-all flex items-center gap-2 cursor-pointer"
        >
          <span>המשך: {next.label}</span>
          <i className="fa-solid fa-arrow-left text-xs"></i>
        </button>
      ) : (
        <span />
      )}
    </div>
  );
};
