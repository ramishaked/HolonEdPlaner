import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { PRINCIPLES_DATA } from './data';
import { DiagnosticAnswers, ActionPlan, DiagnosticResponse, SchoolProfile, EMPTY_SCHOOL_PROFILE } from './types';
import { OrientView } from './components/OrientView';
import { SettingsView } from './components/SettingsView';
import { DiagnosticView } from './components/DiagnosticView';
import { PlanView } from './components/PlanView';
import { ExportView } from './components/ExportView';
import { RadarChart } from './components/RadarChart';
import { Onboarding } from './components/Onboarding';
import { JourneyRail, JourneyStep } from './components/JourneyRail';
import { StepFooter } from './components/StepFooter';
import { MenuSelection, PRINCIPLE_SHORT_TITLES } from './components/PrincipleMenu';

// The explicit customer-journey "מתחמים" (zones). Onboarding is the entry; the
// rest are the working zones. principle_detail is a sub-view of orient (not a zone).
type Step = 'onboarding' | 'orient' | 'assess' | 'plan' | 'export';

const JOURNEY_STEPS: JourneyStep[] = [
  { id: 'onboarding', label: 'כניסה', icon: 'fa-solid fa-right-to-bracket' },
  { id: 'orient', label: 'מתחם ההכרות', icon: 'fa-solid fa-book-open' },
  { id: 'assess', label: 'מתחם האבחון העצמי', icon: 'fa-solid fa-chart-pie' },
  { id: 'plan', label: 'מתחם התכנון', icon: 'fa-solid fa-bullseye' },
  { id: 'export', label: 'מתחם ההפקה', icon: 'fa-solid fa-file-pdf' },
];

export default function App() {
  // Load answers and action plan from localStorage to avoid losing data
  const [answers, setAnswers] = useState<DiagnosticAnswers>(() => {
    try {
      const saved = localStorage.getItem('school_diagnostic_answers_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [actionPlan, setActionPlan] = useState<ActionPlan>(() => {
    try {
      const saved = localStorage.getItem('school_action_plan_v1');
      return saved ? JSON.parse(saved) : {
        strengths: [],
        breakthroughs: [],
        organizationalSacrifice: "",
        schoolName: "",
        schoolYear: "",
        strengthReason: "",
        breakthroughReason1: "",
        breakthroughReason2: "",
      };
    } catch {
      return {
        strengths: [],
        breakthroughs: [],
        organizationalSacrifice: "",
        schoolName: "",
        schoolYear: "",
        strengthReason: "",
        breakthroughReason1: "",
        breakthroughReason2: "",
      };
    }
  });

  // Start on onboarding, but skip it for a returning session that already
  // identified its school.
  const [currentStep, setCurrentStep] = useState<Step>(() =>
    (actionPlan.schoolName || '').trim().length > 0 ? 'orient' : 'onboarding'
  );

  // Orient zone selection, lifted here so other zones can deep-link to a
  // principle's explanation page (e.g. assess → "עבור לדף ההסבר").
  const [orientSelected, setOrientSelected] = useState<MenuSelection>('intro');

  // Settings screen (opened from the gear in the top bar).
  const [showSettings, setShowSettings] = useState(false);

  // School identity profile ("business card") — persisted separately.
  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile>(() => {
    try {
      const saved = localStorage.getItem('school_profile_v1');
      return saved ? { ...EMPTY_SCHOOL_PROFILE, ...JSON.parse(saved) } : EMPTY_SCHOOL_PROFILE;
    } catch {
      return EMPTY_SCHOOL_PROFILE;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('school_profile_v1', JSON.stringify(schoolProfile));
    } catch {
      /* storage quota (e.g. large logo) — ignore for the demo */
    }
  }, [schoolProfile]);

  const handleUpdateProfile = (fields: Partial<SchoolProfile>) =>
    setSchoolProfile((prev) => ({ ...prev, ...fields }));

  // Keep localStorage sync in effect
  useEffect(() => {
    localStorage.setItem('school_diagnostic_answers_v1', JSON.stringify(answers));
  }, [answers]);

  useEffect(() => {
    localStorage.setItem('school_action_plan_v1', JSON.stringify(actionPlan));
  }, [actionPlan]);

  const [aiResult, setAiResult] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('school_diagnostic_ai_result_v1');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (aiResult) {
      localStorage.setItem('school_diagnostic_ai_result_v1', JSON.stringify(aiResult));
    } else {
      localStorage.removeItem('school_diagnostic_ai_result_v1');
    }
  }, [aiResult]);

  // Compute live scores for the spider radar chart
  const scores = PRINCIPLES_DATA.reduce((acc, p) => {
    const ans = answers[p.id];
    if (ans) {
      const maturityLevel = ans.selectedMaturityLevel ?? 1;
      const goldenCircleAvg = (ans.whyScore + ans.howScore + ans.whatScore) / 3;
      acc[p.id] = (maturityLevel * 0.7) + (goldenCircleAvg * 0.3);
    } else {
      acc[p.id] = 1.0; // Baseline default maturity score
    }
    return acc;
  }, {} as { [key: number]: number });

  // Count how many keys are fully defined
  const diagnosticCompletedCount = Object.keys(answers).length;

  // Navigate to a journey step (scroll to top for a clean step transition).
  const goToStep = (step: Step) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // React state handlers
  const handleUpdateAnswer = (principleId: number, fields: Partial<DiagnosticResponse>) => {
    setAnswers((prev) => {
      const prevAns = prev[principleId] || {
        whyScore: 1,
        howScore: 1,
        whatScore: 1,
        selectedMaturityLevel: 1,
        evidence: "",
      };
      return {
        ...prev,
        [principleId]: {
          ...prevAns,
          ...fields,
        },
      };
    });
  };

  const handleUpdateActionPlan = (fields: Partial<ActionPlan>) => {
    setActionPlan((prev) => ({
      ...prev,
      ...fields,
    }));
  };

  // Reset only the diagnostic data (assessment answers + AI report). School
  // identity and the action plan are intentionally preserved.
  const handleResetDiagnostic = () => {
    setAnswers({});
    setAiResult(null);
  };

  const handleClearData = () => {
    setAnswers({});
    setActionPlan({
      strengths: [],
      breakthroughs: [],
      organizationalSacrifice: "",
      schoolName: "",
      schoolYear: "",
      strengthReason: "",
      breakthroughReason1: "",
      breakthroughReason2: "",
    });
    setAiResult(null);
    localStorage.removeItem('school_diagnostic_answers_v1');
    localStorage.removeItem('school_action_plan_v1');
    localStorage.removeItem('school_diagnostic_ai_result_v1');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans flex flex-col justify-between" style={{ direction: 'rtl' }}>

      {/* Fixed top app bar — clean white, monday/SaaS feel */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white text-slate-900 border-b border-slate-200 shadow-sm z-40 px-4 md:px-8 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="מינהל החינוך - עיריית חולון, עיר הילדים"
            className="h-11 w-auto object-contain shrink-0"
          />
          <div>
            <h1 className="font-bold text-xs md:text-sm text-slate-900 leading-tight">
              הפלנר <span className="text-slate-400 font-medium">(Holon School Educational Planner)</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium hidden md:block">העוזר החכם שלך לבניית תוכנית העצמה בית ספרית ברוח עקרונות תמונת העתיד והמציאות המשתנה</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {actionPlan.schoolName && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <i className="fa-solid fa-school text-primary-600 text-xs"></i>
              <span className="hidden sm:inline">{actionPlan.schoolName}</span>
              {actionPlan.schoolYear && <span className="text-slate-400 font-mono text-xs">· {actionPlan.schoolYear}</span>}
            </div>
          )}

          {/* Settings — opens the full settings screen */}
          <button
            type="button"
            title="הגדרות"
            aria-label="הגדרות"
            onClick={() => { setShowSettings((s) => !s); window.scrollTo({ top: 0 }); }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              showSettings ? 'text-slate-700 bg-slate-100' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <i className="fa-solid fa-gear text-base"></i>
          </button>
        </div>
      </header>

      {/* Spacer for the fixed header */}
      <div className="h-16 print:hidden"></div>

      {/* Persistent journey rail — hidden while the settings screen is open */}
      {!showSettings && (
        <JourneyRail
          steps={JOURNEY_STEPS}
          currentStep={currentStep}
          onSelect={(id) => goToStep(id as Step)}
          assessProgress={{ done: diagnosticCompletedCount, total: 7 }}
          coverage={PRINCIPLES_DATA.map((p) => ({
            id: p.id,
            title: PRINCIPLE_SHORT_TITLES[p.id] ?? p.title,
            assessed: !!answers[p.id],
          }))}
        />
      )}

      {/* Main body canvas container */}
      <main className="flex-grow pt-6 pb-12 max-w-7xl mx-auto w-full px-4 md:px-8 print:pt-0 print:pb-0 print:max-w-full">
        {showSettings ? (
          <SettingsView
            profile={schoolProfile}
            onUpdateProfile={handleUpdateProfile}
            actionPlan={actionPlan}
            onUpdateActionPlan={handleUpdateActionPlan}
            onResetDiagnostic={handleResetDiagnostic}
            onClose={() => setShowSettings(false)}
          />
        ) : currentStep === 'export' ? (
          <>
            <ExportView
              scores={scores}
              answers={answers}
              actionPlan={actionPlan}
              onUpdateActionPlan={handleUpdateActionPlan}
              aiResult={aiResult}
            />
            <div className="print:hidden">
              <StepFooter
                steps={JOURNEY_STEPS}
                currentStep={currentStep}
                onNavigate={(id) => goToStep(id as Step)}
              />
            </div>
          </>
        ) : (
        <div className="print:hidden">
          {currentStep === 'onboarding' && (
            <Onboarding
              actionPlan={actionPlan}
              onUpdateActionPlan={handleUpdateActionPlan}
              onContinue={() => goToStep('orient')}
            />
          )}

          {currentStep === 'orient' && (
            <OrientView
              scores={scores}
              answers={answers}
              selected={orientSelected}
              onSelect={setOrientSelected}
            />
          )}

          {currentStep === 'plan' && (
            <PlanView
              scores={scores}
              answers={answers}
              onOpenPrincipleInfo={(id) => {
                setOrientSelected(id);
                goToStep('orient');
              }}
            />
          )}

          {currentStep === 'assess' && (
            <DiagnosticView
              step={currentStep}
              scores={scores}
              answers={answers}
              onUpdateAnswer={handleUpdateAnswer}
              actionPlan={actionPlan}
              onUpdateActionPlan={handleUpdateActionPlan}
              onClearData={handleClearData}
              aiResult={aiResult}
              onUpdateAiResult={setAiResult}
              onOpenPrincipleInfo={(id) => {
                setOrientSelected(id);
                goToStep('orient');
              }}
            />
          )}

          {/* Consistent prev/next at the bottom of every step (not onboarding) */}
          {currentStep !== 'onboarding' && (
            <StepFooter
              steps={JOURNEY_STEPS}
              currentStep={currentStep}
              onNavigate={(id) => goToStep(id as Step)}
            />
          )}
        </div>
        )}

        {/* Printable Section - Native Paper Format Rendering Toggle (not for the
            export zone, which prints its own live document preview, nor settings) */}
        {!showSettings && currentStep !== 'export' && (
        <div className="hidden print:block bg-white p-4">

          {/* PAGE 1: HEADER & RADAR SPIDER MAP */}
          <div className="text-center space-y-3 pb-6 border-b-2 border-slate-900">
            <h1 className="text-3xl font-bold">הפלנר · Holon School Educational Planner</h1>
            <h2 className="text-xl font-bold text-primary-950">פרוטוקול אבחון ותוכנית עבודה אסטרטגית שנתית</h2>
            <div className="flex justify-center gap-10 text-sm font-medium text-slate-700 font-mono">
              <span><strong>בית ספר:</strong> {actionPlan.schoolName || '___________'}</span>
              <span><strong>שנת לימודים:</strong> {actionPlan.schoolYear || '_______'}</span>
              <span><strong>תאריך פלט:</strong> {new Date().toLocaleDateString('he-IL')}</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center my-8" style={{ pageBreakInside: 'avoid' }}>
            <div className="w-full max-w-[340px] border border-slate-200 p-4 rounded-2xl shadow-sm bg-white">
              <RadarChart scores={scores} />
            </div>
          </div>

          <div className="space-y-4 pt-6">
            <h3 className="text-lg font-bold border-r-4 border-primary-600 pr-2">א. סיכום בשלות 7 העקרונות הפדגוגיים</h3>
            <p className="text-xs text-slate-600 leading-relaxed text-justify">
              מדדי הבשלות מחושבים כממוצע של שלושת צירי מעגל הזהב (הלמה - תרבות, האיך - סדירויות במערכת השעות והמה - תוצרים).
            </p>

            <table className="w-full border-collapse border border-slate-200 text-right text-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-200 p-2.5 font-bold">#</th>
                  <th className="border border-slate-200 p-2.5 font-bold">העיקרון הפדגוגי</th>
                  <th className="border border-slate-200 p-2.5 font-bold text-center">ציון בשלות ממוצע</th>
                  <th className="border border-slate-200 p-2.5 font-medium">ביאורים וראיות מהשטח</th>
                </tr>
              </thead>
              <tbody>
                {PRINCIPLES_DATA.map((p) => {
                  const score = scores[p.id] || 1;
                  const ans = answers[p.id];
                  return (
                    <tr key={p.id}>
                      <td className="border border-slate-200 p-2.5 font-mono text-center">{p.id}</td>
                      <td className="border border-slate-200 p-2.5 font-bold">{p.title}</td>
                      <td className="border border-slate-200 p-2.5 font-mono font-bold text-center bg-slate-50">{score.toFixed(1)}</td>
                      <td className="border border-slate-200 p-2.5 text-slate-700 italic">{ans?.evidence || 'לא תועדו נתונים/הערות'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* PAGE BREAK TO PAGE 2: OPERATIVE CANVAS */}
          <div style={{ pageBreakBefore: 'always' }} className="pt-8"></div>

          <div className="space-y-6 pt-4">
            <h3 className="text-lg font-bold border-r-4 border-primary-600 pr-2">ב. קנבס גזירה אופרטיבית ויעדי קצה בית-ספריים</h3>
            <p className="text-xs text-slate-600 leading-relaxed text-justify">
              להבטחת ההטמעה, בחרה ההנהלה עוגן עוצמה מרכזי אחד ושני יעדי פריצת דרך למיקוד שנתי, תוך ביצוע ויתור פדגוגי מודע.
            </p>

            <div className="space-y-5">
              <div className="border border-slate-200 p-4 rounded-xl bg-slate-50/50">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">● עוגן העוצמה הבית-ספרי (לשימור ושכלול):</h4>
                <p className="text-sm text-primary-950 font-bold mt-1">
                  {actionPlan.strengths[0]
                    ? `עיקרון ${actionPlan.strengths[0]}: ${PRINCIPLES_DATA.find(p => p.id === actionPlan.strengths[0])?.title}`
                    : 'טרם נבחר עוגן'}
                </p>
                <div className="text-xs text-slate-700 mt-2 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed text-justify">
                  {actionPlan.strengthReason || 'לא הוזן פירוט להנמקת העוצמה.'}
                </div>
              </div>

              <div className="border border-slate-200 p-4 rounded-xl bg-slate-50/50">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">● יעד פריצת דרך ראשון להורדה לשטח:</h4>
                <p className="text-sm text-primary-950 font-bold mt-1">
                  {actionPlan.breakthroughs[0]
                    ? `עיקרון ${actionPlan.breakthroughs[0]}: ${PRINCIPLES_DATA.find(p => p.id === actionPlan.breakthroughs[0])?.title}`
                    : 'טרם נבחר יעד'}
                </p>
                <div className="text-xs text-slate-700 mt-2 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed text-justify">
                  {actionPlan.breakthroughReason1 || 'לא הוזן פירוט להורדה לשטח עבור יעד 1.'}
                </div>
              </div>

              <div className="border border-slate-200 p-4 rounded-xl bg-slate-50/50">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">● יעד פריצת דרך שני להורדה לשטח:</h4>
                <p className="text-sm text-primary-950 font-bold mt-1">
                  {actionPlan.breakthroughs[1]
                    ? `עיקרון ${actionPlan.breakthroughs[1]}: ${PRINCIPLES_DATA.find(p => p.id === actionPlan.breakthroughs[1])?.title}`
                    : 'טרם נבחר יעד'}
                </p>
                <div className="text-xs text-slate-700 mt-2 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed text-justify">
                  {actionPlan.breakthroughReason2 || 'לא הוזן פירוט להורדה לשטח עבור יעד 2.'}
                </div>
              </div>

              <div className="border border-slate-200 p-4 rounded-xl bg-rose-50/40 border-rose-200">
                <h4 className="font-bold text-xs text-rose-900 uppercase tracking-wide flex items-center gap-1">
                  <span>● הוויתור הארגוני המנהיגותי (חוק השבתון):</span>
                </h4>
                <p className="text-xs text-slate-500 italic mt-0.5">"מה אנו מפסיקים לעשות על מנת לפנות קשב לחבר המורים לעסוק בשני יעדי פריצת דרך אלו?"</p>
                <div className="text-xs text-rose-950 font-medium mt-2 bg-white p-2.5 rounded-lg border border-rose-100 leading-relaxed text-justify shadow-inner">
                  {actionPlan.organizationalSacrifice || 'לא הוגדר ויתור ארגוני.'}
                </div>
              </div>
            </div>
          </div>

          {/* PAGE BREAK TO PAGE 3: SPECIAL AI STRATEGIC REPORT */}
          {aiResult && (
            <>
              <div style={{ pageBreakBefore: 'always' }} className="pt-8"></div>
              <div className="space-y-6 pt-4">
                <h3 className="text-lg font-bold border-r-4 border-primary-600 pr-2">ג. דוח אסטרטגי פדגוגי מורחב מבוסס AI</h3>

                {/* 3 implementation quick tips checked list */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4">
                  {aiResult.quickTips?.map((tip: string, idx: number) => (
                    <div key={idx} className="p-3 bg-primary-50/40 border border-primary-100 rounded-xl space-y-1">
                      <span className="text-xs font-bold text-primary-800 uppercase tracking-wider">ראשי יישום {idx + 1}</span>
                      <p className="text-xs text-slate-900 leading-normal font-medium">{tip}</p>
                    </div>
                  ))}
                </div>

                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-right leading-relaxed font-sans shadow-inner">
                  <div className="markdown-body text-slate-900 text-xs md:text-sm space-y-4">
                    <ReactMarkdown>{aiResult.summaryHtml}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* PAGE 4: PROTOCOLS AND SIGNATURES */}
          <div style={{ pageBreakBefore: 'always' }} className="pt-8"></div>

          <div className="space-y-6 pt-4">
            <h3 className="text-lg font-bold border-r-4 border-primary-600 pr-2">ד. מהלך הסדנה המוסדית ופרוטוקול ההפעלה להנהלות</h3>
            <div className="text-xs text-slate-700 leading-relaxed text-justify bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 shadow-inner">
              <p><strong>שלב א&apos;: עבודה עצמית ורפלקציה (15 דקות):</strong> כל חבר הנהלה (מנהל, סגנים, רכז פדגוגי, רכז תקשוב, יועצת) מעריך ומסמן באופן עצמאי את רמת הבשלות ורושם הנמקה קצרה כהוכחה מהשטח.</p>
              <p><strong>שלב ב&apos;: הצפת נתונים ודיון בפערים (45 דקות) - לב הסדנה:</strong> מציגים את הדירוגים על גבי הרדאר הריק על הלוח. מנהלים דיון ממוקד סביב פערי התפיסה ומגיעים לדירוג מוסכם.</p>
              <p><strong>שלב ג&apos;: שרטוט הרדאר המוסכם הסופי (10 דקות):</strong> מחברים את הציון המוסכם של כל 7 העקרונות ומותחים קו ביניהם לקבלת מפת הבשלות המוסדית הסופית.</p>
            </div>
          </div>

          <div className="pt-24 flex justify-around text-xs font-bold border-t border-slate-300 mt-20" style={{ pageBreakInside: 'avoid' }}>
            <div className="text-center space-y-12">
              <div className="w-36 border-b border-slate-400 h-px"></div>
              <span>חתימת מנהל/ת בית הספר</span>
            </div>
            <div className="text-center space-y-12">
              <div className="w-36 border-b border-slate-400 h-px"></div>
              <span>חתימת מפקח/ת משרד החינוך</span>
            </div>
            <div className="text-center space-y-12">
              <div className="w-36 border-b border-slate-400 h-px"></div>
              <span>מוביל/ת פדגוגיה עירונית</span>
            </div>
          </div>

        </div>
        )}
      </main>

      {/* Quiet educational footer */}
      <footer className="bg-slate-50 text-slate-500 py-8 border-t border-slate-200 print:hidden mt-12 text-center text-xs space-y-2">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary-50 text-primary-600 rounded flex items-center justify-center font-bold">
              <i className="fa-solid fa-gem text-xs"></i>
            </div>
            <p className="font-medium text-slate-600">הפלנר · Holon School Educational Planner © 2026</p>
          </div>
          <div className="flex gap-4">
            <span className="hover:text-slate-900 transition-colors">תמיכה באבחון והנהלות</span>
            <span className="text-slate-300">|</span>
            <span className="hover:text-slate-900 transition-colors">אקו-סיסטם ארגוני</span>
            <span className="text-slate-300">|</span>
            <span className="hover:text-slate-900 transition-colors">עקרונות המנהיגות</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 font-mono">מפותח לרווחת הקהילות החינוכיות למימוש תוכניות העבודה השנתיות</p>
      </footer>
    </div>
  );
}
