import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePrinciples } from '../lib/PrinciplesContext';
import { DiagnosticAnswers, DiagnosticResponse } from '../types';
import { RadarChart } from './RadarChart';
import { PrincipleMenu } from './PrincipleMenu';

interface DiagnosticViewProps {
  scores: { [key: number]: number };
  answers: DiagnosticAnswers;
  onUpdateAnswer: (principleId: number, fields: Partial<DiagnosticResponse>) => void;
  onClearData: () => void;
  /** Jump to a principle's explanation page in the orient zone. */
  onOpenPrincipleInfo?: (id: number) => void;
  /** Opens settings at the unique-principles card. */
  onAddPrinciple?: () => void;
}

export const DiagnosticView: React.FC<DiagnosticViewProps> = ({
  scores,
  answers,
  onUpdateAnswer,
  onClearData,
  onOpenPrincipleInfo,
  onAddPrinciple,
}) => {
  const { principles, rubrics, displayNumbers } = usePrinciples();
  const [activeTab, setActiveTab] = useState<number>(1); // Active principle ID for questionnaire
  const [draggedOrHoveredId, setDraggedOrHoveredId] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  // Assess: whether the menu's "מה קורה כאן?" entry is selected (zone explanation).
  const [showZoneIntro, setShowZoneIntro] = useState(false);
  // Hover flyout for maturity-level descriptions (portaled, never clipped).
  const [maturityTip, setMaturityTip] = useState<{ top: number; left: number; text: string } | null>(null);

  const currentPrinciple = principles.find((p) => p.id === activeTab) || principles[0];
  const activeRubrics = rubrics.find((r) => r.id === activeTab)?.levels || [];
  const activeAnswer = answers[activeTab] || {
    whyScore: 1,
    howScore: 1,
    whatScore: 1,
    selectedMaturityLevel: 1,
    evidence: "",
  };

  const getMaturityColor = (level: number) => {
    switch (level) {
      case 1: return 'border-red-200 bg-red-50 text-red-800';
      case 2: return 'border-amber-200 bg-amber-50 text-amber-800';
      case 3: return 'border-blue-200 bg-blue-50 text-blue-800';
      case 4: return 'border-primary-200 bg-primary-50 text-primary-800';
      default: return 'border-slate-200 bg-slate-50 text-slate-800';
    }
  };

  const completedCount = Object.keys(answers).length;


  return (
    <div className="space-y-10">
      
      {/* Custom Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 select-none animate-fade-in" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-6 text-right animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 text-xl shrink-0">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">איפוס נתוני אבחון</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  ברגע שתמשיך ותלחץ כן, נתוני האבחון יאפסו- להמשיך?
                </p>
              </div>
            </div>
            
            <div className="flex gap-2.5 justify-end pt-2">
              <button
                onClick={() => {
                  onClearData();
                  setShowResetConfirm(false);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-rose-600/10 cursor-pointer"
              >
                כן
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                לא
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-6 items-start" dir="rtl">
        {/* Shared principles menu (right) — with a top "מה קורה כאן?" entry */}
        <PrincipleMenu
          selected={showZoneIntro ? 'intro' : activeTab}
          onSelect={(id) => {
            if (id === 'intro') setShowZoneIntro(true);
            else { setShowZoneIntro(false); setActiveTab(id); }
          }}
          scores={scores}
          answers={answers}
          onAddPrinciple={onAddPrinciple}
          title="עקרונות המיפוי"
          introLabel="מה קורה כאן?"
          introIcon="fa-solid fa-circle-question"
          introSummary="הסבר על מתחם האבחון העצמי ואופן השימוש בו."
        />

        <main className="flex-1 min-w-0 space-y-6">

          {showZoneIntro ? (
            /* Zone explanation (the menu "מה קורה כאן?" entry) */
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-4 text-right animate-fade-in">
              <h2 className="text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-circle-question text-primary-500"></i>
                מה קורה כאן?
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
                במתחם זה ממפים את רמת הבשלות של בית הספר בכל אחד מהעקרונות: בוחרים רמת בשלות, מדרגים את שלושת צירי "מעגל הזהב" ומוסיפים הערכה מילולית.
                התמונה המלאה מצטיירת בזמן אמת במפת העכביש.
              </p>
              <button
                type="button"
                disabled
                title="בקרוב — הסבר מורחב על תהליך האבחון"
                aria-label="ספר לי עוד על האבחון — בקרוב"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-400 bg-slate-100/70 border border-slate-200 cursor-not-allowed select-none"
              >
                <i className="fa-solid fa-book-open"></i>
                <span>ספר לי עוד על האבחון</span>
                <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">בקרוב</span>
              </button>
            </div>
          ) : (
            <>
            {/* Current principle header + jump to its explanation page */}
            <div
              className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-sm border-r-8 flex items-center justify-between gap-4"
              style={{ borderRightColor: currentPrinciple.accentColor }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${currentPrinciple.accentColor}1a` }}
                >
                  <i className={`${currentPrinciple.icon} text-lg`} style={{ color: currentPrinciple.accentColor }}></i>
                </span>
                <div className="min-w-0">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: currentPrinciple.accentColor }}>
                    עיקרון {displayNumbers[currentPrinciple.id] ?? currentPrinciple.id}
                  </span>
                  <h3 className="text-lg md:text-2xl font-bold text-slate-900 leading-tight">{currentPrinciple.title}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenPrincipleInfo?.(activeTab)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-100 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-arrow-up-right-from-square"></i>
                <span className="hidden sm:inline">עוד על העקרון</span>
                <span className="sm:hidden">הסבר</span>
              </button>
            </div>

            {/* Radar (right, always visible) + metrics (left): maturity then golden-circle */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              <div className="w-full lg:w-[60%] lg:sticky lg:top-36 shrink-0">
                <RadarChart
                  scores={scores}
                  activeId={draggedOrHoveredId || activeTab}
                  onHoverPrinciple={(id) => setDraggedOrHoveredId(id)}
                  onSelectPrinciple={(id) => setActiveTab(id)}
                />
              </div>

              <div className="flex-1 min-w-0 w-full space-y-5">

                {/* Maturity level — compact, descriptions on hover */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-800">רמת הבשלות הנוכחית של בית הספר</h4>
                  <div className="space-y-1.5">
                    {activeRubrics.map((rubric) => {
                      const isSelected = activeAnswer.selectedMaturityLevel === rubric.level;
                      const showTip = (el: HTMLElement) => {
                        const r = el.getBoundingClientRect();
                        const W = 260, gap = 8;
                        let left = r.left - gap - W;
                        if (left < 8) left = r.right + gap;
                        setMaturityTip({ top: r.top + r.height / 2, left, text: rubric.description });
                      };
                      return (
                        <button
                          key={rubric.level}
                          type="button"
                          onClick={() => onUpdateAnswer(activeTab, { selectedMaturityLevel: rubric.level })}
                          onMouseEnter={(e) => showTip(e.currentTarget)}
                          onMouseLeave={() => setMaturityTip(null)}
                          onFocus={(e) => showTip(e.currentTarget)}
                          onBlur={() => setMaturityTip(null)}
                          className={`w-full flex items-center gap-2 p-2.5 rounded-xl border border-r-4 text-right cursor-pointer transition-all ${
                            isSelected
                              ? 'border-primary-600 bg-primary-50/40 border-r-primary-600 shadow-sm'
                              : 'border-slate-200/60 bg-white hover:bg-slate-50 border-r-slate-300'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full text-[0.65rem] font-bold text-white flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary-600' : 'bg-slate-400'}`}>
                            {rubric.level}
                          </span>
                          <span className="flex-1 text-xs font-bold text-slate-900">{rubric.name}</span>
                          <i className="fa-solid fa-circle-info text-slate-300 text-xs shrink-0"></i>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Golden-circle 3 axes — directly after the maturity level */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-800">דירוג שלושת צירי "מעגל הזהב" (1–4)</h4>
                  <div className="space-y-1.5">
                    {([
                      { key: 'whyScore', title: 'ציר התרבות (הלמה)', sub: 'הבנה והזדהות עם המטרה' },
                      { key: 'howScore', title: 'ציר הסדירויות (האיך)', sub: 'עוגנים מובנים במערכת השעות' },
                      { key: 'whatScore', title: 'ציר התוצרים (המה)', sub: 'תוצרים מדידים של מורה ותלמיד' },
                    ] as const).map((axis) => {
                      const val = activeAnswer[axis.key];
                      return (
                        <div key={axis.key} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50/60 rounded-xl border border-slate-200">
                          <div className="min-w-0">
                            <span className="block text-xs font-bold text-primary-700">{axis.title}</span>
                            <span className="text-[0.7rem] text-slate-400">{axis.sub}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {[1, 2, 3, 4].map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() =>
                                  onUpdateAnswer(
                                    activeTab,
                                    axis.key === 'whyScore'
                                      ? { whyScore: num }
                                      : axis.key === 'howScore'
                                        ? { howScore: num }
                                        : { whatScore: num }
                                  )
                                }
                                className={`w-7 h-7 rounded text-xs font-mono font-bold transition-all ${
                                  val === num ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

            {/* Free text — the manager's note for this principle */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
              <h4 className="text-sm font-bold text-slate-800">הערכה מילולית והערות המנהל/ת על עיקרון זה</h4>
              <textarea
                value={activeAnswer.evidence}
                onChange={(e) => onUpdateAnswer(activeTab, { evidence: e.target.value })}
                placeholder="רשמו כאן הערכה כללית, נתונים, הוכחות לקביעת הרמה או דברים שעלו בדיון עם רכזי המקצוע או היועצת..."
                rows={4}
                className="w-full p-3 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            </>
          )}

        </main>

        {/* Maturity description flyout — portaled so it is never clipped */}
        {maturityTip &&
          createPortal(
            <div
              className="pointer-events-none fixed z-[60] w-[260px] print:hidden"
              style={{ top: maturityTip.top, left: maturityTip.left, transform: 'translateY(-50%)' }}
              dir="rtl"
            >
              <div className="bg-white border border-slate-200 shadow-lg rounded-xl p-3 text-right">
                <p className="text-[0.7rem] leading-snug text-slate-600">{maturityTip.text}</p>
              </div>
            </div>,
            document.body
          )}
      </div>

    </div>
  );
};
