import React from 'react';

export interface JourneyStep {
  id: string;
  label: string;
  icon: string; // FontAwesome class
}

interface JourneyRailProps {
  steps: JourneyStep[];
  currentStep: string;
  onSelect: (id: string) => void;
  assessProgress?: { done: number; total: number };
}

/**
 * Sticky horizontal RTL stepper that makes the main workflow explicit.
 * Free-roam: every step is clickable (a workshop team jumps around).
 * "You are here" = current highlighted; passed steps get a check; the Assess
 * step shows live X/total progress.
 */
export const JourneyRail: React.FC<JourneyRailProps> = ({ steps, currentStep, onSelect, assessProgress }) => {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  const pct = assessProgress ? Math.round((assessProgress.done / assessProgress.total) * 100) : 0;
  const complete = assessProgress ? assessProgress.done >= assessProgress.total : false;

  return (
    <nav className="sticky top-16 z-30 bg-white border-b border-slate-200 print:hidden" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <ol className="flex items-center gap-1 md:gap-2 overflow-x-auto scrollbar-none py-2.5">
          {steps.map((step, idx) => {
            const isCurrent = step.id === currentStep;
            const isDone = idx < currentIndex;
            return (
              <li key={step.id} className="flex items-center shrink-0">
                <button
                  onClick={() => onSelect(step.id)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                      : isDone
                        ? 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                        : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-mono ${
                      isCurrent
                        ? 'bg-white/20 text-white'
                        : isDone
                          ? 'bg-primary-200/70 text-primary-700'
                          : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isDone ? <i className="fa-solid fa-check"></i> : idx + 1}
                  </span>
                  <span className="whitespace-nowrap hidden sm:inline">{step.label}</span>
                  {step.id === 'assess' && assessProgress && (
                    <span
                      className={`text-xs font-mono px-1.5 py-0.5 rounded-full ${
                        isCurrent ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-600'
                      }`}
                    >
                      {assessProgress.done}/{assessProgress.total}
                    </span>
                  )}
                </button>
                {idx < steps.length - 1 && (
                  <i className="fa-solid fa-chevron-left text-xs text-slate-300 mx-0.5 md:mx-1"></i>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Persistent overall progress — always visible across every step */}
      {assessProgress && (
        <div className="border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-1.5 flex items-center gap-3">
            <span className="text-xs md:text-xs font-bold text-slate-500 whitespace-nowrap flex items-center gap-1.5 shrink-0">
              <i className={`fa-solid ${complete ? 'fa-circle-check text-emerald-500' : 'fa-square-poll-horizontal text-primary-500'}`}></i>
              <span className="hidden sm:inline">התקדמות מיפוי שבעת העקרונות</span>
              <span className="sm:hidden">מיפוי העקרונות</span>
            </span>
            <div className="relative flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`absolute top-0 right-0 h-full rounded-full transition-all duration-500 ease-out ${
                  complete ? 'bg-gradient-to-l from-emerald-500 to-emerald-600' : 'bg-gradient-to-l from-primary-500 to-primary-600'
                }`}
                style={{ width: `${pct}%` }}
              ></div>
            </div>
            <span className="text-xs md:text-xs font-mono font-bold text-slate-700 min-w-[4.5rem] text-left shrink-0">
              {complete ? 'הושלם ✓' : `${assessProgress.done}/${assessProgress.total} · ${pct}%`}
            </span>
          </div>
        </div>
      )}
    </nav>
  );
};
