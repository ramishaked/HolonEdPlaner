import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { PRINCIPLES_DATA, MATURITY_RUBRICS } from '../data';
import { DiagnosticAnswers, ActionPlan, DiagnosticResponse } from '../types';
import { RadarChart } from './RadarChart';
import { PrincipleMenu } from './PrincipleMenu';

interface DiagnosticViewProps {
  step: 'assess' | 'plan' | 'export';
  scores: { [key: number]: number };
  answers: DiagnosticAnswers;
  onUpdateAnswer: (principleId: number, fields: Partial<DiagnosticResponse>) => void;
  actionPlan: ActionPlan;
  onUpdateActionPlan: (fields: Partial<ActionPlan>) => void;
  onClearData: () => void;
  aiResult: any;
  onUpdateAiResult: (result: any) => void;
  /** Jump to a principle's explanation page in the orient zone. */
  onOpenPrincipleInfo?: (id: number) => void;
}

export const DiagnosticView: React.FC<DiagnosticViewProps> = ({
  step,
  scores,
  answers,
  onUpdateAnswer,
  actionPlan,
  onUpdateActionPlan,
  onClearData,
  aiResult,
  onUpdateAiResult,
  onOpenPrincipleInfo,
}) => {
  const [activeTab, setActiveTab] = useState<number>(1); // Active principle ID for questionnaire
  const [draggedOrHoveredId, setDraggedOrHoveredId] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  // Assess: whether the menu's "מה קורה כאן?" entry is selected (zone explanation).
  const [showZoneIntro, setShowZoneIntro] = useState(false);
  // Hover flyout for maturity-level descriptions (portaled, never clipped).
  const [maturityTip, setMaturityTip] = useState<{ top: number; left: number; text: string } | null>(null);

  // AI Strategic wizard state
  const [aiState, setAiState] = useState<'idle' | 'initiating' | 'questions' | 'generating' | 'completed'>(
    aiResult ? 'completed' : 'idle'
  );
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [aiUserAnswers, setAiUserAnswers] = useState<string[]>(['', '', '']);
  const [aiIntro, setAiIntro] = useState<string>('');
  const [aiStrengthId, setAiStrengthId] = useState<number | null>(null);
  const [aiBreakthroughIds, setAiBreakthroughIds] = useState<number[]>([]);
  const [aiError, setAiError] = useState<string>('');
  const [aiAppliedSuccessfully, setAiAppliedSuccessfully] = useState(false);

  const handleAiInitiate = async () => {
    setAiError('');
    setAiState('initiating');
    setAiAppliedSuccessfully(false);
    try {
      const res = await fetch('/api/ai/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scores,
          answers,
          schoolName: actionPlan.schoolName,
          schoolYear: actionPlan.schoolYear
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to initiate AI diagnostic check.');
      }
      const data = await res.json();
      setAiQuestions(data.questions || []);
      setAiIntro(data.introText || '');
      setAiStrengthId(data.strengthId || null);
      setAiBreakthroughIds(data.breakthroughIds || []);
      setAiUserAnswers(new Array((data.questions || []).length).fill(''));
      setAiState('questions');
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'שגיאה בחיבור לבינה המלאכותית. ודא כי סרבר ה-AI פועל בהצלחה.');
      setAiState('idle');
    }
  };

  const handleAiGenerate = async () => {
    setAiError('');
    setAiState('generating');
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scores,
          answers,
          strengthId: aiStrengthId,
          breakthroughIds: aiBreakthroughIds,
          questions: aiQuestions,
          userAnswers: aiUserAnswers,
          schoolName: actionPlan.schoolName,
          schoolYear: actionPlan.schoolYear
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to generate breakthrough strategy.');
      }
      const data = await res.json();
      onUpdateAiResult(data);
      setAiState('completed');
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'שגיאה ביצירת הדו"ח מבוסס AI. אנא נסה שנית.');
      setAiState('questions');
    }
  };

  const handleApplyAiRecommendations = () => {
    if (!aiResult) return;
    const { autoFill } = aiResult;
    onUpdateActionPlan({
      strengths: aiStrengthId ? [aiStrengthId] : actionPlan.strengths,
      breakthroughs: aiBreakthroughIds.length > 0 ? aiBreakthroughIds : actionPlan.breakthroughs,
      strengthReason: autoFill.strengthReason,
      breakthroughReason1: autoFill.breakthroughReason1,
      breakthroughReason2: autoFill.breakthroughReason2,
      organizationalSacrifice: autoFill.organizationalSacrifice
    });
    setAiAppliedSuccessfully(true);
    // Auto-scroll down to the form
    setTimeout(() => {
      const el = document.getElementById('action-plan-form');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 200);
  };

  // Auto calculate recommended strengths and breakthroughs based on scores
  useEffect(() => {
    const scoreList = Object.entries(scores).map(([id, score]) => ({
      id: parseInt(id),
      score: score as number,
    }));
    
    if (scoreList.length > 0) {
      // Sort scores
      const sorted = [...scoreList].sort((a, b) => b.score - a.score);
      const topId = sorted[0]?.id;
      // Get bottom two
      const bottom = [...scoreList].sort((a, b) => a.score - b.score);
      const bot1 = bottom[0]?.id;
      const bot2 = bottom[1]?.id;

      // Only auto-initialize if currently empty to avoid overwriting manual adjustments
      if (actionPlan.strengths.length === 0 && topId) {
        onUpdateActionPlan({ strengths: [topId] });
      }
      if (actionPlan.breakthroughs.length === 0 && bot1 && bot2) {
        onUpdateActionPlan({ breakthroughs: [bot1, bot2] });
      }
    }
  }, [scores]);

  const currentPrinciple = PRINCIPLES_DATA.find((p) => p.id === activeTab) || PRINCIPLES_DATA[0];
  const activeRubrics = MATURITY_RUBRICS.find((r) => r.id === activeTab)?.levels || [];
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

  // Printing trigger
  const handlePrint = () => {
    window.print();
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

      {step === 'assess' && (
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
                במתחם זה ממפים את רמת הבשלות של בית הספר בכל אחד משבעת העקרונות: בוחרים רמת בשלות, מדרגים את שלושת צירי "מעגל הזהב" ומוסיפים הערכה מילולית.
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
                    עיקרון {currentPrinciple.id}
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
      )}

      {/* Operative Strategy Canvas block (חלק ג') — Plan + Export steps */}
      {step !== 'assess' && (
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-right">
        
        {/* Banner */}
        <div className="bg-primary-50 border-b border-slate-200 p-6 md:p-8 space-y-3">
          <h2 className="text-xl md:text-3xl font-bold text-slate-900">קנבס גזירה אופרטיבית ותוכנית העבודה השנתית</h2>
          <p className="text-xs md:text-sm text-slate-600 leading-normal max-w-4xl">
            בהתאם לתוצאות במפת העכביש, סמנו את עוגני העוצמה הבית-ספריים שימנפו את העבודה, את שני יעדי פריצת הדרך הקריטיים שיקבלו תשומת לב מוגברת, ואת הוויתור המשמעותי שיאפשר זאת.
          </p>
        </div>

        <div className="p-6 md:p-8 space-y-8" id="action-plan-form">

          {step === 'plan' && (<>
          {/* AI Advisor Panel */}
          <div className="bg-slate-50 border border-primary-100 p-6 rounded-2xl space-y-6 text-right">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-primary-100/60 pb-5">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <i className="fa-solid fa-sparkles text-primary-600 animate-pulse"></i>
                  <span>מערכת ייעוץ אסטרטגית מבוססת בינה מלאכותית</span>
                </h3>
                <p className="text-xs text-slate-500">
                  ניתוח עצמאי חכם המזהה את עוגן העוצמה שלכם ושני יעדי פריצת הדרך, מייצר שאלות מיקוד ולאחר מכן מציע חזון אופרטיבי, סדירויות ושלבים מעשיים.
                </p>
              </div>
              <div>
                {aiState === 'idle' && (
                  <button
                    onClick={handleAiInitiate}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 active:bg-primary-800 rounded-xl transition shadow-md hover:shadow-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                    שאל את ה-AI והתחל אבחון
                  </button>
                )}
                {aiState !== 'idle' && (
                  <button
                    onClick={() => {
                      setAiState('idle');
                      onUpdateAiResult(null);
                      setAiAppliedSuccessfully(false);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-red-500 hover:bg-slate-50 rounded-lg transition"
                  >
                    אפס וערוך מחדש
                  </button>
                )}
              </div>
            </div>

            {aiError && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 text-rose-800 text-xs text-right">
                <i className="fa-solid fa-circle-exclamation mt-0.5 text-rose-500 text-sm"></i>
                <div className="space-y-1">
                  <p className="font-bold">חל עיכוב קטן בחיבור לשרת ה-AI</p>
                  <p>{aiError}</p>
                </div>
              </div>
            )}

            {/* Step 1: Initiating (Loading questions) */}
            {aiState === 'initiating' && (
              <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-700 animate-pulse">מנתח את ממצאי האבחון הבית-ספרי שלכם...</p>
                  <p className="text-xs text-slate-400">הבינה המלאכותית מנסחת כעת 3 שאלות הבהרה ממוקדות שיעזרו לדייק את תוכנית העבודה.</p>
                </div>
              </div>
            )}

            {/* Step 2: Answering clarifying questions */}
            {aiState === 'questions' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="p-4 bg-primary-50/50 border border-primary-100/50 rounded-xl text-slate-800 text-xs leading-relaxed">
                  <p className="font-bold text-primary-950 mb-1">ניתוח ראשוני של מערכת ה-AI:</p>
                  <p className="text-slate-600">{aiIntro}</p>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-xs text-slate-700 border-r-2 border-amber-500 pr-2">אנא השיבו על שאלות המיקוד הבאות על מנת שהתוכנית תהיה מותאמת בדיוק לכם:</h4>
                  
                  {aiQuestions.map((question, idx) => (
                    <div key={idx} className="space-y-2 p-4 bg-white border border-slate-200 rounded-xl">
                      <label className="block text-xs font-bold text-slate-800 leading-normal">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold ml-1.5">{idx + 1}</span>
                        {question}
                      </label>
                      <textarea
                        value={aiUserAnswers[idx]}
                        onChange={(e) => {
                          const updated = [...aiUserAnswers];
                          updated[idx] = e.target.value;
                          setAiUserAnswers(updated);
                        }}
                        placeholder="הקלד כאן תשובה או התייחסות חופשית מהשטח..."
                        rows={2}
                        className="w-full p-3 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition text-right"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleAiGenerate}
                    className="px-6 py-2.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-circle-check"></i>
                    ייצר תוכנית עבודה אסטרטגית מלאה
                  </button>
                  <button
                    onClick={handleAiGenerate}
                    className="px-5 py-2.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition cursor-pointer"
                  >
                    דלג על השאלות וייצר כעת
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Generating Plan Loader */}
            {aiState === 'generating' && (
              <div className="py-10 flex flex-col items-center justify-center space-y-4 text-center">
                <div className="relative">
                  <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                  <i className="fa-solid fa-sparkles text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping"></i>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-800 animate-pulse">מחולל את תוכנית העבודה האסטרטגית שלכם...</p>
                  <div className="flex flex-col gap-1 text-xs text-slate-400">
                    <p>• מגדיר חזון אופרטיבי לשנה הראשונה</p>
                    <p>• מעצב סדירויות ארגוניות ושינוי מערכת השעות</p>
                    <p>• בונה אבני דרך מתוזמנות לפריצות הדרך</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Display Finished Plan */}
            {aiState === 'completed' && aiResult && (
              <div className="space-y-6 animate-fadeIn">
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center justify-between text-right">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <i className="fa-solid fa-circle-check text-base"></i>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-950">תוכנית העבודה האסטרטגית שלכם מוכנה!</h4>
                      <p className="text-xs text-emerald-700">התוכנית כוללת פירוט עבור עוגן העוצמה, שתי פריצות הדרך והוויתור הארגוני.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleApplyAiRecommendations}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg transition shadow flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-file-import"></i>
                    החל את ההמלצות על קנבס העבודה
                  </button>
                </div>

                {/* Quick Tips */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-primary-100/40 pb-5">
                  {aiResult.quickTips?.map((tip, idx) => (
                    <div key={idx} className="p-3 bg-primary-50/20 border border-primary-100/10 rounded-xl space-y-1">
                      <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">טיפ יישום {idx + 1}</span>
                      <p className="text-xs text-slate-700 leading-normal font-medium">{tip}</p>
                    </div>
                  ))}
                </div>

                {/* The Plan content */}
                <div className="p-6 md:p-8 bg-slate-50 text-slate-700 rounded-2xl border border-slate-200 max-h-[500px] overflow-y-auto font-sans leading-relaxed text-right space-y-6">
                  <div className="flex items-center gap-2 text-primary-700 font-bold text-xs pb-3 border-b border-slate-200">
                    <i className="fa-solid fa-file-lines"></i>
                    <span>תוצר אופרטיבי - בינה מלאכותית (Generative AI)</span>
                  </div>
                  <div className="markdown-body max-w-none text-right text-xs md:text-sm space-y-4">
                    <ReactMarkdown>{aiResult.summaryHtml}</ReactMarkdown>
                  </div>
                </div>

                {aiAppliedSuccessfully && (
                  <div className="p-4 bg-primary-50 border border-primary-100 rounded-xl text-xs text-primary-900 flex items-center gap-2 animate-bounce">
                    <i className="fa-solid fa-sparkles text-primary-600"></i>
                    <span>ההמלצות הועתקו והוזנו בהצלחה מעוררת השראה ישירות לתוך קנבס העבודה למטה!</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Metadata info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">שם בית הספר לקובץ ההדפסה:</label>
              <input
                type="text"
                value={actionPlan.schoolName}
                onChange={(e) => onUpdateActionPlan({ schoolName: e.target.value })}
                placeholder="הקלד כאן את שם בית הספר..."
                className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">שנת לימודים:</label>
              <input
                type="text"
                value={actionPlan.schoolYear}
                onChange={(e) => onUpdateActionPlan({ schoolYear: e.target.value })}
                placeholder="למשל: תשפ&quot;ז (2026-2027)"
                className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Box 1: Strengths Piller */}
            <div className="p-5 rounded-2xl border border-primary-100 bg-primary-50/20 space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-primary-700 uppercase">מינוף הקיים</span>
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <i className="fa-solid fa-crown text-primary-600"></i>
                  <span>עוגן העוצמה הבית-ספרי</span>
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  העיקרון שיקבל את הציון הגבוה ביותר במפה או אחד שיש לגביו תשתית פועלת רחבה שנמשיך לשכלל.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">בחר את עיקרון העוצמה:</label>
                <select
                  value={actionPlan.strengths[0] || ""}
                  onChange={(e) => onUpdateActionPlan({ strengths: e.target.value ? [parseInt(e.target.value)] : [] })}
                  className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                >
                  <option value="">-- בחר מלשימת העקרונות --</option>
                  {PRINCIPLES_DATA.map((p) => (
                    <option key={p.id} value={p.id}>
                      עיקרון {p.id}: {p.title} (ציון {scores[p.id]?.toFixed(1) || '1.0'})
                    </option>
                  ))}
                </select>

                <textarea
                  value={actionPlan.strengthReason || ""}
                  onChange={(e) => onUpdateActionPlan({ strengthReason: e.target.value })}
                  placeholder="רשמו כאן נימוק קונקרטי והוכחה מהרדאר לגבי עוגן זה ואיך נפעל להרחיב אותו עוד..."
                  rows={4}
                  className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-light"
                />
              </div>
            </div>

            {/* Box 2: Breakthrough Targets (Needs two breakthroughs) */}
            <div className="p-5 rounded-2xl border border-emerald-100 bg-emerald-50/20 space-y-4 lg:col-span-2">
              <div className="space-y-1">
                <span className="text-xs font-bold text-emerald-700 uppercase">הובלת שינוי עמוק</span>
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <i className="fa-solid fa-rocket text-emerald-600"></i>
                  <span>שני יעדי פריצת הדרך לשנה הקרובה</span>
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  שני העקרונות שנבחרו מתוך האבחון הנמוך אך קריטיים ובעלי פוטנציאל ההשתפרות הגדול ביותר. המנהל מגדיר את שני היעדים לקראת ספטמבר.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Breakthrough 1 */}
                <div className="bg-white p-4 rounded-xl border border-emerald-100 space-y-3">
                  <label className="block text-xs font-bold text-slate-800">יעד פריצת דרך ראשון:</label>
                  <select
                    value={actionPlan.breakthroughs[0] || ""}
                    onChange={(e) => {
                      const updated = [...actionPlan.breakthroughs];
                      updated[0] = parseInt(e.target.value);
                      onUpdateActionPlan({ breakthroughs: updated });
                    }}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                  >
                    <option value="">-- בחר עיקרון ראשון --</option>
                    {PRINCIPLES_DATA.map((p) => (
                      <option key={p.id} value={p.id}>
                        עיקרון {p.id}: {p.title} (ציון {scores[p.id]?.toFixed(1) || '1.0'})
                      </option>
                    ))}
                  </select>

                  <textarea
                    value={actionPlan.breakthroughReason1 || ""}
                    onChange={(e) => onUpdateActionPlan({ breakthroughReason1: e.target.value })}
                    placeholder="פרט את החזון האופרטיבי, הסדירות הפועלת ואבן הדרך הראשונה לאחד בספטמבר לעיקרון זה..."
                    rows={4}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>

                {/* Breakthrough 2 */}
                <div className="bg-white p-4 rounded-xl border border-emerald-100 space-y-3">
                  <label className="block text-xs font-bold text-slate-800">יעד פריצת דרך שני:</label>
                  <select
                    value={actionPlan.breakthroughs[1] || ""}
                    onChange={(e) => {
                      const updated = [...actionPlan.breakthroughs];
                      updated[1] = parseInt(e.target.value);
                      onUpdateActionPlan({ breakthroughs: updated });
                    }}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                  >
                    <option value="">-- בחר עיקרון שני --</option>
                    {PRINCIPLES_DATA.map((p) => (
                      <option key={p.id} value={p.id}>
                        עיקרון {p.id}: {p.title} (ציון {scores[p.id]?.toFixed(1) || '1.0'})
                      </option>
                    ))}
                  </select>

                  <textarea
                    value={actionPlan.breakthroughReason2 || ""}
                    onChange={(e) => onUpdateActionPlan({ breakthroughReason2: e.target.value })}
                    placeholder="פרט את החזון האופרטיבי, הסדירות הפועלת ואבן הדרך הראשונה לאחד בספטמבר לעיקרון זה..."
                    rows={4}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>

              </div>
            </div>

          </div>

          </>)}

          {step === 'export' && (<>
          {/* Export step — confirm details for the printed report */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">שם בית הספר לקובץ ההדפסה:</label>
              <input
                type="text"
                value={actionPlan.schoolName}
                onChange={(e) => onUpdateActionPlan({ schoolName: e.target.value })}
                placeholder="הקלד כאן את שם בית הספר..."
                className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">שנת לימודים:</label>
              <input
                type="text"
                value={actionPlan.schoolYear}
                onChange={(e) => onUpdateActionPlan({ schoolYear: e.target.value })}
                placeholder="למשל: תשפ&quot;ז (2026-2027)"
                className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Large prominent feedback block with PDF print CTA */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between flex-col md:flex-row gap-4">
            <div className="text-right space-y-1">
              <h5 className="font-bold text-sm text-slate-900">מוכנים להדגשת היעדים?</h5>
              <p className="text-xs text-slate-500">לחצו על ייצוא הדוח כדי לקבל דוח משולב, המכיל את מפת העכביש לדיון הנהלה ומועצות פדגוגיות.</p>
            </div>
            
            <button
              onClick={handlePrint}
              className="px-6 py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-600/10 hover:shadow-primary-600/20 text-xs flex items-center gap-2 cursor-pointer w-full md:w-auto justify-center"
            >
              <i className="fa-solid fa-file-pdf"></i>
              <span>הורדה והדפסה</span>
            </button>
          </div>
          </>)}

        </div>

      </section>
      )}

      {/* Embedded hidden printable area specific for standard paper output rendering */}
      <div className="hidden print:block print:bg-white text-slate-900 p-8 space-y-6 bg-white" id="executive-printed-canvas" style={{ direction: 'rtl' }}>
        <div className="text-center space-y-2 border-b-2 border-slate-900 pb-4">
          <h1 className="text-2xl font-bold">מדריך שבעת העקרונות של מנהל החינוך</h1>
          <h2 className="text-xl font-bold">תוכנית עבודה אסטרטגית שנתית ומפת בשלות</h2>
          <div className="flex justify-center gap-8 text-xs font-mono font-medium text-slate-600 pt-2">
            <span><strong>בית ספר:</strong> {actionPlan.schoolName || '___________'}</span>
            <span><strong>שנת לימודים:</strong> {actionPlan.schoolYear || '_______'}</span>
            <span><strong>תאריך פלט:</strong> {new Date().toLocaleDateString('he-IL')}</span>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <h3 className="text-lg font-bold border-r-4 border-primary-600 pr-2">א. סיכום הבשלות ומפת העכביש הבית-ספרית</h3>
          <p className="text-xs text-slate-600 leading-normal">
            תרשים זה מציג את רמות הבשלות של בית הספר ב-7 העקרונות (ממוצע משוקלל על בסיס ציר הלמה, האיך והמה במעגל הזהב).
          </p>

          <table className="border-collapse border border-slate-200 w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-200 p-2 font-bold">#</th>
                <th className="border border-slate-200 p-2 font-bold">העיקרון הפדגוגי</th>
                <th className="border border-slate-200 p-2 font-bold">ציון משוקלל</th>
                <th className="border border-slate-200 p-2 font-bold font-light">הוכחות וצידוקים מהשטח</th>
              </tr>
            </thead>
            <tbody>
              {PRINCIPLES_DATA.map((p) => {
                const score = scores[p.id] || 1;
                const ans = answers[p.id];
                return (
                  <tr key={p.id}>
                    <td className="border border-slate-200 p-2 font-mono">{p.id}</td>
                    <td className="border border-slate-200 p-2 font-bold">{p.title}</td>
                    <td className="border border-slate-200 p-2 font-mono font-bold text-center">{score.toFixed(1)}</td>
                    <td className="border border-slate-200 p-2 text-slate-700 italic">{ans?.evidence || 'לא נרשמו הערות'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 pt-4">
          <h3 className="text-lg font-bold border-r-4 border-primary-600 pr-2">ב. גזירה אופרטיבית ויעדי קצה</h3>
          
          <div className="space-y-3">
            <div className="border border-slate-300 p-4 rounded bg-slate-50/50">
              <h4 className="font-bold text-xs text-slate-800">● עוגן העוצמה הבית-ספרי (למינוף והעצמה):</h4>
              <p className="text-xs font-bold text-slate-700 mt-1">
                {actionPlan.strengths[0] 
                  ? `עיקרון ${actionPlan.strengths[0]}: ${PRINCIPLES_DATA.find(p => p.id === actionPlan.strengths[0])?.title}` 
                  : 'טרם נבחר עוגן'}
              </p>
              {actionPlan.strengthReason ? (
                <div className="text-xs text-slate-600 mt-2 bg-white p-3 rounded border border-slate-200 leading-relaxed font-light whitespace-pre-line text-justify">
                  <strong className="text-slate-800 font-semibold">פירוט ונימוק אופרטיבי:</strong><br />
                  {actionPlan.strengthReason}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic mt-1">לא הוזן פירוט עבור עוגן העוצמה.</p>
              )}
            </div>

            <div className="border border-slate-300 p-4 rounded bg-slate-50/50">
              <h4 className="font-bold text-xs text-slate-800">● יעד פריצת דרך ראשון במרכז העשייה:</h4>
              <p className="text-xs font-bold text-slate-700 mt-1">
                {actionPlan.breakthroughs[0] 
                  ? `עיקרון ${actionPlan.breakthroughs[0]}: ${PRINCIPLES_DATA.find(p => p.id === actionPlan.breakthroughs[0])?.title}` 
                  : 'טרם נבחר יעד'}
              </p>
              {actionPlan.breakthroughReason1 ? (
                <div className="text-xs text-slate-600 mt-2 bg-white p-3 rounded border border-slate-200 leading-relaxed font-light whitespace-pre-line text-justify">
                  <strong className="text-slate-800 font-semibold">פירוט ותוכנית פעולה:</strong><br />
                  {actionPlan.breakthroughReason1}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic mt-1">לא הוזן פירוט עבור יעד פריצת הדרך הראשון.</p>
              )}
            </div>

            <div className="border border-slate-300 p-4 rounded bg-slate-50/50">
              <h4 className="font-bold text-xs text-slate-800">● יעד פריצת דרך שני במרכז העשייה:</h4>
              <p className="text-xs font-bold text-slate-700 mt-1">
                {actionPlan.breakthroughs[1] 
                  ? `עיקרון ${actionPlan.breakthroughs[1]}: ${PRINCIPLES_DATA.find(p => p.id === actionPlan.breakthroughs[1])?.title}` 
                  : 'טרם נבחר יעד'}
              </p>
              {actionPlan.breakthroughReason2 ? (
                <div className="text-xs text-slate-600 mt-2 bg-white p-3 rounded border border-slate-200 leading-relaxed font-light whitespace-pre-line text-justify">
                  <strong className="text-slate-800 font-semibold">פירוט ותוכנית פעולה:</strong><br />
                  {actionPlan.breakthroughReason2}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic mt-1">לא הוזן פירוט עבור יעד פריצת הדרך השני.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 break-inside-avoid">
          <h3 className="text-lg font-bold border-r-4 border-primary-600 pr-2">ג. מהלך הסדנה המוסדית ופרוטוקול ההפעלה (90 דק׳)</h3>
          <div className="text-xs text-slate-700 leading-relaxed text-justify bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <p><strong>שלב א&apos;: עבודה עצמית ורפלקציה (15 דקות):</strong> כל חבר הנהלה מעריך ומסמן באופן עצמאי את רמת הבשלות ורושם הנמקה קצרה כהוכחה מהשטח.</p>
            <p><strong>שלב ב&apos;: הצפת נתונים ודיון בפערים (45 דקות) - לב הסדנה:</strong> מציגים את הדירוגים על גבי הרדאר הריק על הלוח, מנהלים דיון ממוקד סביב פערי תפיסה ומגיעים לדירוג מוסכם.</p>
            <p><strong>שלב ג&apos;: שרטוט הרדאר המוסכם הסופי (10 דקות):</strong> מחברים את הציון המוסכם של כל 7 העקרונות ומותחים קו ביניהם לקבלת מפת הבשלות המוסדית הסופית.</p>
          </div>
        </div>

        <div className="pt-16 flex justify-around text-xs font-bold pt-12 border-t border-slate-200 mt-12 break-inside-avoid">
          <div className="text-center space-y-8">
            <div className="w-32 border-b border-slate-400 h-px"></div>
            <span>חתימת מנהל/ת בית הספר</span>
          </div>
          <div className="text-center space-y-8">
            <div className="w-32 border-b border-slate-400 h-px"></div>
            <span>חתימת מפקח/ת משרד החינוך</span>
          </div>
          <div className="text-center space-y-8">
            <div className="w-32 border-b border-slate-400 h-px"></div>
            <span>מוביל/ת פדגוגיה עירונית</span>
          </div>
        </div>

      </div>

    </div>
  );
};
