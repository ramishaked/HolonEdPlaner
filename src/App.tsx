import { useState, useEffect, useRef } from 'react';
import { version } from '../package.json';
import { usePrinciples } from './lib/PrinciplesContext';
import { DiagnosticAnswers, ActionPlan, DiagnosticResponse, SchoolProfile, PrinciplePlan, EMPTY_SCHOOL_PROFILE } from './types';
import { OrientView } from './components/OrientView';
import { SettingsView } from './components/SettingsView';
import { DiagnosticView } from './components/DiagnosticView';
import { PlanView } from './components/PlanView';
import { ExportView } from './components/ExportView';
import { RadarChart } from './components/RadarChart';
import { Onboarding } from './components/Onboarding';
import { supabase } from './lib/supabase';
import {
  ensureCurrentPlan,
  loadAssessments,
  loadActionPlan,
  saveAssessment,
  saveActionPlanFields,
  saveFocus,
  clearAssessments,
  loadSchoolProfile,
  saveSchoolProfile,
  loadPrinciplePlans,
  savePrinciplePlans,
  loadExportConfig,
  saveExportConfig,
  loadSchoolFiles,
  uploadSchoolFiles,
  deleteSchoolFile,
  uploadLogo,
  removeLogo,
  signedUrl,
  type ExportConfig,
} from './lib/planData';
import type { Session } from '@supabase/supabase-js';
import { JourneyRail, JourneyStep } from './components/JourneyRail';
import { StepFooter } from './components/StepFooter';
import { MenuSelection } from './components/PrincipleMenu';
import { scoresFor, recommendedFocus } from './lib/scoring';
import { AdminArea } from './components/AdminArea';

// The explicit customer-journey "מתחמים" (zones). Onboarding is the entry; the
// rest are the working zones. principle_detail is a sub-view of orient (not a zone).
type Step = 'onboarding' | 'orient' | 'assess' | 'plan' | 'export';

const JOURNEY_STEPS: JourneyStep[] = [
  { id: 'orient', label: 'מתחם ההכרות', icon: 'fa-solid fa-book-open' },
  { id: 'assess', label: 'מתחם האבחון העצמי', icon: 'fa-solid fa-chart-pie' },
  { id: 'plan', label: 'מתחם התכנון', icon: 'fa-solid fa-bullseye' },
  { id: 'export', label: 'מתחם ההפקה', icon: 'fa-solid fa-file-pdf' },
];

export default function App() {
  // Principles (fixed municipal + this school's custom) come from the DB, with a
  // static fallback; keyed by order_index so the numeric-id UI is unchanged.
  const {
    principles,
    shortTitles,
    orderToId,
    displayNumbers,
    loading: principlesLoading,
    failed: principlesFailed,
    reload: reloadPrinciples,
  } = usePrinciples();

  // All school data comes from the DB once a school signs in — no localStorage.
  const [answers, setAnswers] = useState<DiagnosticAnswers>({});

  const [actionPlan, setActionPlan] = useState<ActionPlan>({
    strengths: [],
    breakthroughs: [],
    organizationalSacrifice: '',
    schoolName: '',
    schoolYear: '',
    strengthReason: '',
    breakthroughReason1: '',
    breakthroughReason2: '',
  });

  // The app itself always starts at orient; login is a separate session gate
  // (Phase 2 auth), not a journey step.
  const [currentStep, setCurrentStep] = useState<Step>('orient');

  // Supabase auth session — the gate to the whole app.
  const [session, setSession] = useState<Session | null>(null);
  const [viewerRole, setViewerRole] = useState<'school' | 'city_admin' | 'super_admin' | null>(null);
  /**
   * false while the profile lookup is still in flight. The role decides which of two
   * applications the user gets, so an unanswered role is NOT the same as "school":
   * falling through would render the school journey to a municipal admin — with another
   * school's principle set in the menu — until the answer arrived.
   */
  const [roleResolved, setRoleResolved] = useState(false);
  const [viewerMunicipalityId, setViewerMunicipalityId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // The school's current planning version (plans row) + whether its data has been
  // loaded. Saves are gated on `dataLoaded` so initial empty state can never
  // overwrite what is already in the DB.
  const [planId, setPlanId] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Per-principle plans (מתחם התכנון). Lifted here so PlanView and ExportView
  // share one DB-backed source instead of each reading localStorage.
  const [principlePlans, setPrinciplePlans] = useState<Record<number, PrinciplePlan>>({});

  // Export-document builder config (per version), DB-backed.
  const [exportConfig, setExportConfig] = useState<ExportConfig | null>(null);
  // Storage path of the school logo, so it can be replaced/removed.
  const [logoPath, setLogoPath] = useState<string | null>(null);

  // Orient zone selection, lifted here so other zones can deep-link to a
  // principle's explanation page (e.g. assess → "עבור לדף ההסבר").
  const [orientSelected, setOrientSelected] = useState<MenuSelection>('intro');

  // Settings screen (opened from the gear in the top bar).
  const [showSettings, setShowSettings] = useState(false);
  /**
   * Which settings card to scroll to on open. The principle menu links straight to the
   * unique-principles card, which sits below the business card and would otherwise be
   * off-screen — a "link" that lands on an unrelated form is not a link.
   */
  const [settingsFocus, setSettingsFocus] = useState<'principles' | null>(null);

  // School identity profile ("business card") — text fields live on the schools
  // row; logo + attachments live in Supabase Storage.
  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile>(EMPTY_SCHOOL_PROFILE);

  const handleUpdateProfile = (fields: Partial<SchoolProfile>) =>
    setSchoolProfile((prev) => ({ ...prev, ...fields }));

  // Hard reset of every school-scoped piece of state whenever the signed-in user
  // changes (including logout). Without this, the previous school's in-memory
  // data — and the localStorage caches the plan/export views still use — bleed
  // into the next school that logs in on the same tab.
  const userId = session?.user?.id ?? null;
  const prevUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevUserRef.current === userId) return;
    prevUserRef.current = userId;

    setAnswers({});
    setActionPlan({
      strengths: [],
      breakthroughs: [],
      organizationalSacrifice: '',
      schoolName: '',
      schoolYear: '',
      strengthReason: '',
      breakthroughReason1: '',
      breakthroughReason2: '',
    });
    setSchoolProfile(EMPTY_SCHOOL_PROFILE);
    setPrinciplePlans({});
    setExportConfig(null);
    setLogoPath(null);
    setPlanId(null);
    setSchoolId(null);
    setDataLoaded(false);

    // Sweep away any pre-DB leftovers so they can never surface for a school.
    for (const k of [
      'school_diagnostic_answers_v1',
      'school_action_plan_v1',
      'school_profile_v1',
      'school_principle_plans_v1',
      'school_export_config_v1',
    ]) {
      localStorage.removeItem(k);
    }
  }, [userId]);

  // ---- DB bootstrap: resolve the school's current version and load its data --
  useEffect(() => {
    if (!userId) return;
    // A municipal admin has no school and therefore no plan — don't try to make one.
    // Wait for the role before deciding: "not answered yet" is not "school".
    if (!roleResolved || viewerRole !== 'school') return;
    // Wait for principles to arrive from the DB — we need the uuid mapping.
    if (!Object.keys(orderToId).length) return;

    let active = true;
    (async () => {
      const ctx = await ensureCurrentPlan(userId);
      if (!active || !ctx) return;

      const idToOrder: Record<string, number> = {};
      for (const [order, uuid] of Object.entries(orderToId)) idToOrder[uuid] = Number(order);

      const [dbAnswers, dbPlan, dbProfile, dbPrinciplePlans, dbExport, dbFiles] =
        await Promise.all([
          loadAssessments(ctx.planId, idToOrder),
          loadActionPlan(ctx.planId, idToOrder),
          loadSchoolProfile(ctx.schoolId),
          loadPrinciplePlans(ctx.planId, idToOrder),
          loadExportConfig(ctx.planId),
          loadSchoolFiles(ctx.schoolId),
        ]);
      if (!active) return;

      setPrinciplePlans(dbPrinciplePlans);
      setAnswers(dbAnswers);
      if (dbPlan) setActionPlan((prev) => ({ ...prev, ...dbPlan }));
      setExportConfig(dbExport);

      if (dbProfile) {
        const { logoPath: path, ...text } = dbProfile;
        setLogoPath(path);
        // Private bucket → the <img> needs a short-lived signed URL.
        const logoDataUrl = path ? await signedUrl(path) : '';
        if (!active) return;
        setSchoolProfile((prev) => ({ ...prev, ...text, logoDataUrl, files: dbFiles }));
      }

      setPlanId(ctx.planId);
      setSchoolId(ctx.schoolId);
      setDataLoaded(true);
    })();

    return () => {
      active = false;
    };
    // Keyed on the user id, not the session object — a token refresh creates a new
    // session object and must not re-trigger a reload. The role is a dependency because
    // the guard above waits for it: without it this would bail once and never come back.
  }, [userId, orderToId, roleResolved, viewerRole]);

  // Persist the mapping (debounced). Gated on dataLoaded so the initial empty
  // state can never overwrite existing DB rows.
  useEffect(() => {
    if (!dataLoaded || !planId) return;
    const t = setTimeout(() => {
      for (const [order, r] of Object.entries(answers)) {
        const uuid = orderToId[Number(order)];
        if (uuid) saveAssessment(planId, uuid, r);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [answers, dataLoaded, planId, orderToId]);

  // Persist the action-plan fields + focus anchors (debounced).
  useEffect(() => {
    if (!dataLoaded || !planId) return;
    const t = setTimeout(() => {
      saveActionPlanFields(planId, actionPlan);
      saveFocus(planId, actionPlan.strengths ?? [], actionPlan.breakthroughs ?? [], orderToId);
    }, 700);
    return () => clearTimeout(t);
  }, [actionPlan, dataLoaded, planId, orderToId]);

  // Persist the per-principle plans + activities (debounced).
  useEffect(() => {
    if (!dataLoaded || !planId) return;
    const t = setTimeout(() => {
      savePrinciplePlans(planId, principlePlans, orderToId);
    }, 700);
    return () => clearTimeout(t);
  }, [principlePlans, dataLoaded, planId, orderToId]);

  // Persist the export-document builder config (debounced).
  useEffect(() => {
    if (!dataLoaded || !planId || !exportConfig) return;
    const t = setTimeout(() => {
      saveExportConfig(planId, exportConfig);
    }, 700);
    return () => clearTimeout(t);
  }, [exportConfig, dataLoaded, planId]);

  /**
   * A school principle was deleted — drop every in-memory copy keyed by its order_index.
   *
   * The freed index is a slot (1000 or 1001) that the next create reuses immediately.
   * Without this purge, the debounced saves above would write the deleted principle's
   * assessment, activity plan and focus role against the *new* principle's uuid within
   * 700ms, silently attaching one principle's work to another.
   */
  /**
   * The principle menu's "add a unique principle" row — settings is where it lives.
   *
   * Deliberately does NOT scroll to the top the way the gear does: the target card sits
   * below the business card, and SettingsView scrolls to it itself.
   */
  const openPrincipleSettings = () => {
    setSettingsFocus('principles');
    setShowSettings(true);
  };

  const handlePrincipleDeleted = (orderIndex: number) => {
    setAnswers(({ [orderIndex]: _answer, ...rest }) => rest);
    setPrinciplePlans(({ [orderIndex]: _plan, ...rest }) => rest);
    setActionPlan((prev) => ({
      ...prev,
      strengths: prev.strengths.filter((id) => id !== orderIndex),
      breakthroughs: prev.breakthroughs.filter((id) => id !== orderIndex),
    }));
    reloadPrinciples();
  };

  // ---- school logo + attachments (Supabase Storage) -------------------------
  const handleUploadLogo = async (file: File) => {
    if (!schoolId) return;
    const path = await uploadLogo(schoolId, file);
    if (!path) return;
    setLogoPath(path);
    const url = await signedUrl(path);
    setSchoolProfile((prev) => ({ ...prev, logoDataUrl: url }));
  };

  const handleRemoveLogo = async () => {
    if (!schoolId) return;
    await removeLogo(schoolId, logoPath);
    setLogoPath(null);
    setSchoolProfile((prev) => ({ ...prev, logoDataUrl: '' }));
  };

  const handleUploadFiles = async (files: File[]) => {
    if (!schoolId) return;
    const added = await uploadSchoolFiles(schoolId, files);
    if (added.length) setSchoolProfile((prev) => ({ ...prev, files: [...prev.files, ...added] }));
  };

  const handleRemoveFile = async (index: number) => {
    const meta = schoolProfile.files[index];
    if (!meta) return;
    await deleteSchoolFile(meta);
    setSchoolProfile((prev) => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }));
  };

  // Persist the school business card (debounced). School-level, not versioned.
  useEffect(() => {
    if (!dataLoaded || !schoolId) return;
    const t = setTimeout(() => {
      saveSchoolProfile(schoolId, schoolProfile);
    }, 700);
    return () => clearTimeout(t);
  }, [schoolProfile, dataLoaded, schoolId]);

  // AI strategic report — persisted to plan_ai_reports (per version).
  // Bootstrap the auth session and subscribe to changes (login/logout/refresh).
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Once authenticated, resolve who this is from the DB profile. The role decides which
  // application the user gets: the school journey, or the municipal admin area.
  useEffect(() => {
    if (!session) {
      setViewerRole(null);
      setRoleResolved(false);
      setViewerMunicipalityId(null);
      return;
    }
    let active = true;
    (async () => {
      let data: {
        municipality_id?: string | null;
        role?: 'school' | 'city_admin' | 'super_admin' | null;
        schools?: unknown;
      } | null = null;
      try {
        ({ data } = await supabase
          .from('profiles')
          .select('school_id, municipality_id, role, schools(name, municipality_id)')
          .eq('id', session.user.id)
          .single());
      } catch {
        // A dropped request must not strand the user on the spinner: release the gate
        // below with no role, which falls back to the journey as it did before.
      }
      if (!active) return;

      const embedded = data?.schools as unknown;
      const school = Array.isArray(embedded) ? embedded[0] : embedded;
      const typed = school as { name?: string; municipality_id?: string } | null | undefined;

      setViewerRole(data?.role ?? null);
      // Mirrors app.auth_municipality_id(): fall back through the school.
      setViewerMunicipalityId(data?.municipality_id ?? typed?.municipality_id ?? null);
      // Answered — even if the answer was "no profile row". Set last, so no screen can
      // render off a half-applied identity.
      setRoleResolved(true);
      if (typed?.name) {
        setActionPlan((prev) =>
          prev.schoolName === typed.name ? prev : { ...prev, schoolName: typed.name! },
        );
      }
    })();
    return () => {
      active = false;
    };
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentStep('orient');
  };

  // Compute live scores for the spider radar chart
  const scores = scoresFor(answers, principles.map((p) => p.id));

  // Seed the focus anchors from the maturity map the first time there is anything to
  // derive them from. Only fills what is still empty, so a principal's own choice in
  // the export zone is never overwritten. Lives here rather than inside a screen so it
  // does not depend on which zone happens to be open.
  useEffect(() => {
    if (!dataLoaded) return;
    const mapped = Object.keys(answers).length;
    if (!mapped) return;

    const rec = recommendedFocus(answers);
    const fields: Partial<ActionPlan> = {};
    if (actionPlan.strengths.length === 0 && rec.strength) fields.strengths = [rec.strength];
    if (actionPlan.breakthroughs.length === 0 && rec.breakthroughs.length === 2) {
      fields.breakthroughs = rec.breakthroughs;
    }
    if (Object.keys(fields).length) setActionPlan((prev) => ({ ...prev, ...fields }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoaded, answers, actionPlan.strengths.length, actionPlan.breakthroughs.length]);

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
    // Clearing state is not enough — remove the rows or they return on reload.
    if (planId) {
      clearAssessments(planId);
    }
  };

  const handleClearData = () => {
    setAnswers({});
    setActionPlan((prev) => ({
      strengths: [],
      breakthroughs: [],
      organizationalSacrifice: "",
      schoolName: prev.schoolName, // identity comes from the DB profile
      schoolYear: "",
      strengthReason: "",
      breakthroughReason1: "",
      breakthroughReason2: "",
    }));
    setPrinciplePlans({});
    if (planId) {
      clearAssessments(planId, true);
    }
  };

  // Auth gate: wait for the session to resolve, then require login before the app.
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-slate-400" aria-label="טוען" />
      </div>
    );
  }

  if (!session) {
    return (
      <div
        className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4"
        style={{ direction: 'rtl' }}
      >
        <Onboarding />
      </div>
    );
  }

  // Role gate: which of the two applications this session gets is decided by the DB
  // profile, so nothing school-scoped may render until that answer is in. Falling
  // through while it is unknown put a municipal admin inside the school journey —
  // complete with a principle menu merged across schools.
  if (!roleResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-slate-300" aria-label="טוען" />
      </div>
    );
  }

  // A municipal admin gets a different application, not a different tab: no journey,
  // no school settings, no planning zone — those are all school-scoped.
  if (viewerRole === 'city_admin' || viewerRole === 'super_admin') {
    return (
      <div
        className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans p-4 md:p-8 print:p-0"
        style={{ direction: 'rtl' }}
      >
        <AdminArea
          viewer={{ userId: session.user.id, municipalityId: viewerMunicipalityId, role: viewerRole }}
          onExit={handleLogout}
        />
      </div>
    );
  }

  // Principles gate: they come from the DB only (no static fallback), so the journey
  // cannot render before they arrive — every screen is keyed on them.
  if (principlesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-slate-400" aria-label="טוען עקרונות" />
      </div>
    );
  }

  if (principlesFailed) {
    return (
      <div
        className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-4 p-6 text-center"
        style={{ direction: 'rtl' }}
      >
        <i className="fa-solid fa-triangle-exclamation text-3xl text-amber-500" aria-hidden="true" />
        <div>
          <p className="font-bold text-slate-800">לא הצלחנו לטעון את העקרונות</p>
          <p className="text-sm text-slate-500 mt-1">
            העקרונות נטענים מהשרת. בדקו את החיבור לאינטרנט ונסו שוב.
          </p>
        </div>
        <button
          type="button"
          onClick={reloadPrinciples}
          className="bg-primary-600 text-white rounded-lg px-4 py-2 text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
        >
          נסו שוב
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans flex flex-col justify-between" style={{ direction: 'rtl' }}>

      {/* Fixed top app bar — clean white, monday/SaaS feel */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white text-slate-900 border-b border-slate-200 shadow-sm z-40 px-4 md:px-8 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <img
            src="/planner-logo.png"
            alt="הפלנר - מתכננים, משפרים, מתקדמים"
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
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <i className="fa-solid fa-school text-primary-600 text-xs"></i>
            <span className="hidden sm:inline">{actionPlan.schoolName || '—'}</span>
            {actionPlan.schoolYear && <span className="text-slate-400 font-mono text-xs">· {actionPlan.schoolYear}</span>}
          </div>

          {/* Settings — opens the full settings screen */}
          <button
            type="button"
            title="הגדרות"
            aria-label="הגדרות"
            onClick={() => { setSettingsFocus(null); setShowSettings((s) => !s); window.scrollTo({ top: 0 }); }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              showSettings ? 'text-slate-700 bg-slate-100' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <i className="fa-solid fa-gear text-base"></i>
          </button>

          {/* Sign out */}
          <button
            type="button"
            title="יציאה"
            aria-label="יציאה"
            onClick={handleLogout}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-right-from-bracket text-base"></i>
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
          assessProgress={{ done: diagnosticCompletedCount, total: principles.length }}
          coverage={principles.map((p) => ({
            id: p.id,
            title: shortTitles[p.id] ?? p.title,
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
            onUploadLogo={handleUploadLogo}
            onRemoveLogo={handleRemoveLogo}
            onUploadFiles={handleUploadFiles}
            onRemoveFile={handleRemoveFile}
            schoolId={schoolId}
            userId={session.user.id}
            onPrinciplesChanged={reloadPrinciples}
            onPrincipleDeleted={handlePrincipleDeleted}
            focusSection={settingsFocus}
          />
        ) : currentStep === 'export' ? (
          <>
            <ExportView
              scores={scores}
              answers={answers}
              actionPlan={actionPlan}
              onUpdateActionPlan={handleUpdateActionPlan}
              plans={principlePlans}
              config={exportConfig}
              onUpdateConfig={setExportConfig}
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
          {currentStep === 'orient' && (
            <OrientView
              scores={scores}
              answers={answers}
              selected={orientSelected}
              onSelect={setOrientSelected}
              onAddPrinciple={openPrincipleSettings}
            />
          )}

          {currentStep === 'plan' && (
            <PlanView
              scores={scores}
              answers={answers}
              plans={principlePlans}
              setPlans={setPrinciplePlans}
              onOpenPrincipleInfo={(id) => {
                setOrientSelected(id);
                goToStep('orient');
              }}
              onAddPrinciple={openPrincipleSettings}
            />
          )}

          {currentStep === 'assess' && (
            <DiagnosticView
              scores={scores}
              answers={answers}
              onUpdateAnswer={handleUpdateAnswer}
              onClearData={handleClearData}
              onOpenPrincipleInfo={(id) => {
                setOrientSelected(id);
                goToStep('orient');
              }}
              onAddPrinciple={openPrincipleSettings}
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
            <h3 className="text-lg font-bold border-r-4 border-primary-600 pr-2">א. סיכום בשלות העקרונות הפדגוגיים</h3>
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
                {principles.map((p) => {
                  const score = scores[p.id] || 1;
                  const ans = answers[p.id];
                  return (
                    <tr key={p.id}>
                      <td className="border border-slate-200 p-2.5 font-mono text-center">{displayNumbers[p.id] ?? p.id}</td>
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
                    ? `עיקרון ${displayNumbers[actionPlan.strengths[0]] ?? actionPlan.strengths[0]}: ${principles.find(p => p.id === actionPlan.strengths[0])?.title}`
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
                    ? `עיקרון ${displayNumbers[actionPlan.breakthroughs[0]] ?? actionPlan.breakthroughs[0]}: ${principles.find(p => p.id === actionPlan.breakthroughs[0])?.title}`
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
                    ? `עיקרון ${displayNumbers[actionPlan.breakthroughs[1]] ?? actionPlan.breakthroughs[1]}: ${principles.find(p => p.id === actionPlan.breakthroughs[1])?.title}`
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


          {/* PAGE 4: SIGNATURES */}
          <div style={{ pageBreakBefore: 'always' }} className="pt-8"></div>

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
      <footer className="bg-slate-50 text-slate-500 py-4 border-t border-slate-200 print:hidden mt-12 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-3">
          <div className="w-5 h-5 bg-primary-50 text-primary-600 rounded flex items-center justify-center font-bold">
            <i className="fa-solid fa-gem text-xs"></i>
          </div>
          <p className="font-medium text-slate-600">הפלנר · Holon School Educational Planner © 2026</p>
          <span className="text-slate-300">·</span>
          <span className="font-mono text-slate-400">v{version}</span>
        </div>
      </footer>
    </div>
  );
}
