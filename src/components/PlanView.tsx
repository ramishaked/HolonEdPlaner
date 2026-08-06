import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePrinciples } from '../lib/PrinciplesContext';
import { DiagnosticAnswers, PlanActivity, PrinciplePlan, TaskSource } from '../types';
import { PrincipleMenu } from './PrincipleMenu';
import { Collapsible } from './Collapsible';
import { sourceMeta, METRICS_MOCK } from '../planBank';
import { useActivityBank, type BankItem } from '../lib/activityBank';
import { useAudiences, audienceLabel } from '../lib/audiences';

// Displayed chip = task source. Older saved plans have no `source`: derive it
// (custom "אחר" tasks → school, everything else → municipal).
const activitySource = (a: PlanActivity): TaskSource =>
  a.source ?? (a.type === 'אחר' ? 'בית ספרי' : 'עירוני');

interface PlanViewProps {
  scores: { [key: number]: number };
  answers: DiagnosticAnswers;
  /** Per-principle plans, owned by App and persisted to the DB. */
  plans: Record<number, PrinciplePlan>;
  setPlans: React.Dispatch<React.SetStateAction<Record<number, PrinciplePlan>>>;
  /** Jump to a principle's explanation page in the orient zone. */
  onOpenPrincipleInfo?: (id: number) => void;
}


// DB uuid — an activity row maps 1:1 to its React item, so saves are upserts.
const newId = () => crypto.randomUUID();

const blankPlan = (): PrinciplePlan => ({ activities: [], victoryVision: '' });

/**
 * Accessibility for a modal dialog: while `active`, Escape closes it, Tab is trapped
 * inside, focus moves into the dialog on open, and returns to the trigger on close.
 * Attach the returned ref to the dialog's content box (give it tabIndex={-1}).
 */
function useModalA11y(active: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    const prevFocus = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        container?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => !el.hasAttribute('disabled'));
    (focusables()[0] ?? container)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const f = focusables();
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
  }, [active, onClose]);
  return ref;
}

export const PlanView: React.FC<PlanViewProps> = ({
  scores,
  answers,
  plans,
  setPlans,
  onOpenPrincipleInfo,
}) => {
  const { principles } = usePrinciples();
  const { bank, loading: bankLoading } = useActivityBank();
  const { audiences } = useAudiences();
  const [activeTab, setActiveTab] = useState<number>(1);

  const principle = principles.find((p) => p.id === activeTab) || principles[0];
  const plan = plans[activeTab] || blankPlan();

  // Bank items already added to this plan are removed from the bank entirely — they
  // free up space and don't clutter the picker. They reappear if removed from the plan.
  const bankItems = bank[activeTab] ?? [];
  const availableBank = bankItems.filter((item) => !plan.activities.some((a) => a.bankKey === item.key));
  const addedFromBankCount = bankItems.length - availableBank.length;

  // Per-principle activity counts → a "planned" dot in the shared principles menu.
  const activityCounts = Object.fromEntries(
    Object.entries(plans).map(([order, p]) => [order, p.activities.length]),
  ) as Record<number, number>;

  // Modal + AI-agent + reset state
  const [modalItem, setModalItem] = useState<BankItem | null>(null);
  const [agentQuery, setAgentQuery] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentResults, setAgentResults] = useState<BankItem[]>([]);
  const [metricsLoadingId, setMetricsLoadingId] = useState<string | null>(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [visionOpen, setVisionOpen] = useState(false);

  // The activity bank opens as a floating modal from "+ הוספת פעילות"; the default
  // screen stays clean — just the principles menu and the plan.
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [bankAudFilter, setBankAudFilter] = useState<string[]>([]);
  // Transient confirmation shown inside the bank modal after an add — the modal stays
  // open (adding is immediate and consistent for bank items and custom initiatives alike).
  const [bankToast, setBankToast] = useState<string | null>(null);
  const bankToastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showBankToast = (msg: string) => {
    setBankToast(msg);
    clearTimeout(bankToastTimer.current);
    bankToastTimer.current = setTimeout(() => setBankToast(null), 1800);
  };

  // Search + audience filter over the available bank. Single filtering point — a
  // relevance sort (from answers[activeTab]) will slot in here later.
  const bankQuery = bankSearch.trim().toLowerCase();
  const filteredBank = availableBank.filter((item) => {
    const matchesSearch =
      !bankQuery ||
      item.title.toLowerCase().includes(bankQuery) ||
      item.short.toLowerCase().includes(bankQuery);
    const matchesAud =
      bankAudFilter.length === 0 || (item.audiences ?? []).some((s) => bankAudFilter.includes(s));
    return matchesSearch && matchesAud;
  });
  const bankFilterActive = bankQuery !== '' || bankAudFilter.length > 0;

  // Reset search/filter when the picker opens or the principle changes.
  useEffect(() => {
    setBankSearch('');
    setBankAudFilter([]);
  }, [activeTab, bankModalOpen]);

  // Agent results reset when switching principle
  useEffect(() => {
    setAgentResults([]);
    setAgentQuery('');
  }, [activeTab]);

  // Modal a11y (Esc / focus trap / focus return). setState fns are stable.
  const closeDetailModal = useCallback(() => setModalItem(null), []);
  const detailModalRef = useModalA11y(!!modalItem, closeDetailModal);
  const closeResetModal = useCallback(() => setConfirmReset(false), []);
  const resetModalRef = useModalA11y(confirmReset, closeResetModal);
  const closeBankModal = useCallback(() => setBankModalOpen(false), []);
  // While the detail modal is open on top, the bank modal stands down (Esc/trap) so
  // the two don't fight — Esc then closes only the detail, returning to the bank.
  const bankModalRef = useModalA11y(bankModalOpen && !modalItem, closeBankModal);

  // ---- plan mutations --------------------------------------------------------
  const mutatePlan = (id: number, fn: (p: PrinciplePlan) => PrinciplePlan) =>
    setPlans((prev) => ({ ...prev, [id]: fn(prev[id] || blankPlan()) }));

  // Flash + scroll to an activity row so an add (or an attempted re-add) is clearly noticed.
  const flashActivity = (aid: string) => {
    setFlashId(aid);
    setTimeout(() => {
      document.getElementById(`plan-activity-${aid}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
    setTimeout(() => setFlashId((cur) => (cur === aid ? null : cur)), 1400);
  };

  const addActivity = (item: {
    title: string; desc: string; type: string; source: TaskSource;
    metrics?: string; audiences?: string[]; audienceNote?: string; bankKey?: string;
  }) => {
    // A bank item lives in the plan at most once — re-adding just surfaces the existing row.
    if (item.bankKey) {
      const existing = plan.activities.find((a) => a.bankKey === item.bankKey);
      if (existing) {
        flashActivity(existing.id);
        return;
      }
    }
    const id = newId();
    const activity: PlanActivity = {
      id,
      title: item.type === 'אחר' ? 'יוזמה ייחודית של בית הספר' : item.title,
      desc: item.desc,
      // Bank items ship with the municipality's own success metrics and audiences —
      // carry them in as an editable starting point instead of a blank/default.
      metrics: item.metrics ?? '',
      audiences: item.audiences ?? [],
      audienceNote: item.audienceNote ?? '',
      owner: '',
      priority: 'medium',
      type: item.type,
      source: item.source,
      bankKey: item.bankKey, // undefined for a custom "יוזמה ייחודית / אחר"
      isExpanded: false, // enter collapsed to keep the plan scannable; the "טרם הושלם" chip invites completion
    };
    mutatePlan(activeTab, (p) => ({ ...p, activities: [...p.activities, activity] }));
    flashActivity(id);
  };

  const removeActivity = (aid: string) =>
    mutatePlan(activeTab, (p) => ({ ...p, activities: p.activities.filter((a) => a.id !== aid) }));

  const toggleExpand = (aid: string) =>
    mutatePlan(activeTab, (p) => ({
      ...p,
      activities: p.activities.map((a) => (a.id === aid ? { ...a, isExpanded: a.isExpanded === false } : a)),
    }));

  const updateActivity = (aid: string, fields: Partial<PlanActivity>) =>
    mutatePlan(activeTab, (p) => ({
      ...p,
      activities: p.activities.map((a) => (a.id === aid ? { ...a, ...fields } : a)),
    }));

  // A task still needs the principal's attention until it has both an owner and a short description.
  const isIncomplete = (a: PlanActivity) => !a.owner?.trim() || !a.desc?.trim();

  const setVictoryVision = (text: string) => mutatePlan(activeTab, (p) => ({ ...p, victoryVision: text }));

  // ---- mock AI ---------------------------------------------------------------
  const runAgent = () => {
    if (!agentQuery.trim()) return;
    setAgentLoading(true);
    setTimeout(() => {
      const q = agentQuery.trim();
      const results: BankItem[] = [1, 2, 3].map((n) => ({
        key: 'agent-' + Math.random().toString(36).slice(2, 7),
        title: `יוזמת AI מותאמת ${n}`,
        type: 'סוכן AI',
        source: 'בית ספרי',
        short: `רעיון ${n} שנוצר עבור: ${q}`,
        metrics: '',
        audiences: [],
        audienceNote: 'מותאם לקהל היעד שהוגדר בבקשה.',
        principles: [activeTab],
        scope: 'municipal',
        contact: 'מינהל החינוך, אגף טכנולוגיות וחדשנות.',
        description: `מתווה הפעלה מותאם ל"${q}" עבור עקרון ${principle.id}. (תוכן הדגמה — בהמשך ייווצר על ידי AI אמיתי דרך השרת.)`,
      }));
      setAgentResults(results);
      setAgentLoading(false);
    }, 900);
  };

  const generateMetrics = (aid: string, type: string) => {
    setMetricsLoadingId(aid);
    setTimeout(() => {
      const pool = METRICS_MOCK[type] || METRICS_MOCK['אחר'];
      updateActivity(aid, { metrics: pool[Math.floor(Math.random() * pool.length)] });
      setMetricsLoadingId(null);
    }, 900);
  };

  const generateVision = () => {
    if (plan.activities.length === 0) return;
    setVisionLoading(true);
    setTimeout(() => {
      let text = `בסיומה של שנת הלימודים, בית הספר חווה שינוי פדגוגי משמעותי סביב "${principle.title}". `;
      const types = new Set(plan.activities.map((a) => a.type));
      if (types.has('סדנת AI'))
        text += 'הודות לסדנאות המעשיות, הצוות מיישם את העקרון בשגרת העבודה ומפנה זמן למפגש אישי עם התלמידים. ';
      if (types.has('בית רותר'))
        text += 'ההתנסות במרכז החדשנות של הרשות הולידה פרויקטים יוצאי דופן ומנהיגות פדגוגית מובילה. ';
      if (types.has('האקתון'))
        text += 'ההשתתפות בהאקתון העירוני הציתה יזמות בית-ספרית והציגה את בית הספר כחלוץ חדשנות בעיר. ';
      if (types.has('אחר') || types.has('סוכן AI'))
        text += 'היוזמות הייחודיות שפיתחנו העניקו מענה מדויק לצרכים הייחודיים של בית הספר. ';
      text += 'בשורה התחתונה, הפכנו את העיקרון מתאוריה למציאות חיה בכיתות ובהנהלה.';
      setVictoryVision(text);
      setVisionLoading(false);
    }, 1200);
  };

  const resetPlan = () => {
    mutatePlan(activeTab, () => blankPlan());
    setConfirmReset(false);
  };

  const priorityBtn = (aid: string, level: PlanActivity['priority'], current: string, label: string, on: string, off: string) => (
    <button
      type="button"
      onClick={() => updateActivity(aid, { priority: level })}
      className={`flex-1 py-1 text-xs rounded-lg font-bold transition-all border ${current === level ? on : off}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex gap-6 items-start" dir="rtl">
      {/* Shared principles menu (right) — uniform across zones */}
      <PrincipleMenu
        selected={activeTab}
        onSelect={(id) => { if (typeof id === 'number') setActiveTab(id); }}
        scores={scores}
        answers={answers}
        includeIntro={false}
        title="עקרונות"
        activityCounts={activityCounts}
      />

      <main className="flex-1 min-w-0 space-y-6">

        {/* Principle header + "הלמה" accordion + jump to explanation */}
        <div
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 border-r-8"
          style={{ borderRightColor: principle.accentColor }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${principle.accentColor}1a` }}>
                <i className={`${principle.icon} text-lg`} style={{ color: principle.accentColor }}></i>
              </span>
              <div className="min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: principle.accentColor }}>עיקרון {principle.id}</span>
                <h2 className="text-lg md:text-2xl font-bold text-slate-900 leading-tight">{principle.title}</h2>
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

        </div>

        {/* Single column — the plan is the focus. The bank picker opens as a floating
            modal from "+ הוספת פעילות"; the AI agent lives below the plan. */}
        <div className="space-y-6">

          {/* Activity-bank modal (opened from the plan header) */}
          {bankModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-start sm:items-center justify-center p-4 print:hidden" onClick={() => setBankModalOpen(false)} dir="rtl">
            <div
              ref={bankModalRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="bank-modal-title"
              className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[88vh] overflow-y-auto custom-scroll animate-fade-in focus:outline-none p-5 sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100 sticky -top-5 sm:-top-6 bg-white z-10">
                <h3 id="bank-modal-title" className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <i className="fa-solid fa-layer-group text-primary-600"></i>
                  בנק פעילויות
                  {!bankLoading && bankItems.length > 0 && (
                    <span className="text-[10px] font-bold text-slate-400" title={`${availableBank.length} זמינות מתוך ${bankItems.length}`}>
                      {bankFilterActive ? `${filteredBank.length} תוצאות` : `${availableBank.length}/${bankItems.length}`}
                    </span>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={() => setBankModalOpen(false)}
                  title="סגירת בנק הפעילויות"
                  aria-label="סגירת בנק הפעילויות"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>
              <div className="flex items-start justify-between gap-3 mb-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  לחצו על כרטיס כדי <strong className="text-slate-700">לקרוא בהרחבה</strong>, או על <strong className="font-mono">+</strong> כדי להוסיף לתוכנית. הפעילויות שכבר בתוכנית יורדות מהרשימה.
                </p>
                <button
                  type="button"
                  onClick={() => { addActivity({ title: 'יוזמה ייחודית / אחר', desc: '', type: 'אחר', source: 'בית ספרי' }); showBankToast('היוזמה נוספה לתוכנית — תוכלו לערוך אותה לאחר הסגירה'); }}
                  title="הוסיפו משימה ייחודית של בית הספר שאינה מבנק הפעילויות העירוני. ניתן להוסיף כמה שתרצו."
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg px-3 py-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="fa-solid fa-plus text-[10px]"></i>
                  יוזמה ייחודית / אחר
                </button>
              </div>

              {!bankLoading && bankItems.length > 0 && (
                <div className="mb-4 space-y-2.5">
                  <div className="relative">
                    <i className="fa-solid fa-magnifying-glass absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 text-xs" aria-hidden="true"></i>
                    <input
                      type="text"
                      value={bankSearch}
                      onChange={(e) => setBankSearch(e.target.value)}
                      placeholder="חיפוש פעילות…"
                      aria-label="חיפוש פעילות בבנק"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pr-9 pl-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  {audiences.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-400">קהל יעד:</span>
                      {audiences.map((aud) => {
                        const on = bankAudFilter.includes(aud.slug);
                        return (
                          <button
                            key={aud.slug}
                            type="button"
                            onClick={() => setBankAudFilter((f) => (on ? f.filter((s) => s !== aud.slug) : [...f, aud.slug]))}
                            aria-pressed={on}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                              on ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {aud.label}
                          </button>
                        );
                      })}
                      {bankFilterActive && (
                        <button
                          type="button"
                          onClick={() => { setBankSearch(''); setBankAudFilter([]); }}
                          className="text-[11px] font-bold text-slate-400 hover:text-slate-600 mr-1 flex items-center gap-1"
                        >
                          <i className="fa-solid fa-xmark text-[10px]"></i> נקה סינון
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {bankLoading && (
                  <p className="col-span-full text-xs text-slate-400 text-center py-6">
                    <i className="fa-solid fa-spinner fa-spin ml-1" aria-hidden="true" /> טוען פעילויות…
                  </p>
                )}
                {!bankLoading && bankItems.length === 0 && (
                  <p className="col-span-full text-xs text-slate-400 text-center py-6 leading-relaxed">
                    אין עדיין פעילויות בבנק עבור עיקרון זה.
                    <br />
                    אפשר להוסיף יוזמה ייחודית משלכם.
                  </p>
                )}
                {!bankLoading && bankItems.length > 0 && availableBank.length === 0 && (
                  <p className="col-span-full text-xs text-emerald-600 text-center py-6 leading-relaxed">
                    <i className="fa-solid fa-circle-check ml-1" aria-hidden="true" />
                    כל הפעילויות מהבנק כבר נוספו לתוכנית.
                    <br />
                    <span className="text-slate-400">אפשר להוסיף יוזמה ייחודית משלכם, או להסיר פעילות כדי להחזירה לכאן.</span>
                  </p>
                )}
                {!bankLoading && availableBank.length > 0 && filteredBank.length === 0 && (
                  <p className="col-span-full text-xs text-slate-400 text-center py-6 leading-relaxed">
                    לא נמצאו פעילויות התואמות לסינון.
                    <br />
                    <button type="button" onClick={() => { setBankSearch(''); setBankAudFilter([]); }} className="text-primary-600 font-bold hover:underline cursor-pointer">
                      נקו את הסינון
                    </button>
                  </p>
                )}
                {filteredBank.map((item) => {
                  const th = sourceMeta(item.source);
                  return (
                    <div
                      key={item.key}
                      role="button"
                      tabIndex={0}
                      aria-label={`פרטי הפעילות: ${item.title}`}
                      onClick={() => setModalItem(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModalItem(item); }
                      }}
                      className="group border border-slate-200 hover:border-slate-300 border-r-4 rounded-xl p-3.5 transition-all cursor-pointer shadow-sm hover:shadow bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                      style={{ borderRightColor: th.accent }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="font-bold text-slate-800 text-sm">{item.title}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${th.badge}`}>{item.source}</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3 leading-relaxed">{item.short}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 group-hover:text-slate-600 flex items-center gap-1">
                          <i className="fa-solid fa-eye text-[10px]"></i> פרטים מלאים
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); addActivity({ title: item.title, desc: item.short, type: item.type, source: item.source, metrics: item.metrics, audiences: item.audiences, audienceNote: item.audienceNote, bankKey: item.key }); showBankToast('הפעילות נוספה לתוכנית'); }}
                          className="text-white rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1 transition-opacity hover:opacity-90"
                          style={{ backgroundColor: th.accent }}
                          title="הוסף לתוכנית"
                        >
                          <i className="fa-solid fa-plus"></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {bankToast && (
              <div className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 animate-fade-in max-w-[90vw] text-center">
                <i className="fa-solid fa-check shrink-0"></i>
                <span>{bankToast}</span>
              </div>
            )}
          </div>
          )}

          {/* Plan → AI agent → victory vision (one column, full width) */}
          <section className="min-w-0 space-y-6">
            {/* My plan workspace */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <i className="fa-solid fa-clipboard-list text-primary-600"></i>
                    תוכנית הפעולות שלי
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">בחרו פעילויות, ערכו פרטים והיעזרו ב-AI לניסוח מדדים.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setBankModalOpen(true)}
                    className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    title="הוספת פעילות מבנק הפעילויות"
                  >
                    <i className="fa-solid fa-plus"></i>
                    הוספת פעילות
                  </button>
                  <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded-full">
                    {plan.activities.length} פעולות
                  </span>
                  {plan.activities.length > 0 && (
                    <button onClick={() => setConfirmReset(true)} className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" title="איפוס תוכנית העיקרון">
                      <i className="fa-solid fa-arrow-rotate-right"></i>
                    </button>
                  )}
                </div>
              </div>

              {plan.activities.length > 0 && (() => {
                const completed = plan.activities.filter((a) => !isIncomplete(a)).length;
                const total = plan.activities.length;
                const pct = Math.round((completed / total) * 100);
                return (
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={total}>
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 shrink-0">
                      הושלמו {completed} מתוך {total}
                    </span>
                  </div>
                );
              })()}

              {plan.activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3"><i className="fa-solid fa-folder-open text-xl"></i></div>
                  <h4 className="font-bold text-slate-700 mb-1 text-sm">תוכנית העבודה ריקה</h4>
                  <p className="text-xs text-slate-500 max-w-sm mb-4">פתחו את בנק הפעילויות והוסיפו פעילויות כדי להתחיל להרכיב את התוכנית.</p>
                  <button
                    onClick={() => setBankModalOpen(true)}
                    className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-plus"></i>
                    הוספת פעילות מהבנק
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {plan.activities.map((a) => {
                    const th = sourceMeta(activitySource(a));
                    return (
                      <div
                        key={a.id}
                        id={`plan-activity-${a.id}`}
                        className={`border border-slate-200 border-r-4 rounded-xl overflow-hidden bg-white shadow-sm transition-all duration-500 ${a.id === flashId ? 'ring-2 ring-primary-400 ring-offset-1' : ''}`}
                        style={{ borderRightColor: th.accent }}
                      >
                        <div
                          className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/60 transition-colors"
                          onClick={() => toggleExpand(a.id)}
                        >
                          <input
                            type="text"
                            value={a.title}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateActivity(a.id, { title: e.target.value })}
                            placeholder="שם הפעילות..."
                            className="font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-primary-500 focus:outline-none px-1 py-0.5 rounded text-sm w-full"
                          />
                          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {isIncomplete(a) && (
                              <span
                                className="hidden sm:flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200"
                                title="חסרים אחראי או הסבר קצר — הרחיבו כדי להשלים"
                              >
                                <i className="fa-solid fa-circle-exclamation text-[9px]"></i>
                                טרם הושלם
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${th.badge}`}>{activitySource(a)}</span>
                            <button onClick={() => removeActivity(a.id)} className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" title="מחיקה">
                              <i className="fa-solid fa-trash-can text-xs"></i>
                            </button>
                            <button onClick={() => toggleExpand(a.id)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors" title="הרחב/צמצם פרטים">
                              <i className={`fa-solid fa-chevron-down text-xs transition-transform duration-200 ${a.isExpanded === false ? '' : 'rotate-180'}`}></i>
                            </button>
                          </div>
                        </div>

                        <div className={`p-4 space-y-4 ${a.isExpanded === false ? 'hidden' : ''}`}>
                          {/* Required — the two fields that mark an activity complete */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                הסבר קצר על הפעולה <span className="text-rose-500" title="שדה חובה">*</span>
                              </label>
                              <textarea
                                value={a.desc}
                                onChange={(e) => updateActivity(a.id, { desc: e.target.value })}
                                placeholder="מה מהות הפעילות וכיצד היא מקדמת את העיקרון?"
                                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-primary-500 h-20 resize-none leading-relaxed"
                              />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                אחראי יישום <span className="text-rose-500" title="שדה חובה">*</span>
                              </label>
                              <input
                                type="text"
                                value={a.owner}
                                onChange={(e) => updateActivity(a.id, { owner: e.target.value })}
                                placeholder="מי מוביל את התהליך?"
                                className="border border-slate-200 text-xs rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                              />
                            </div>
                          </div>

                          {/* Optional — secondary details, visually muted */}
                          <div className="pt-3 border-t border-dashed border-slate-200">
                            <p className="text-[11px] font-bold text-slate-400 mb-3 flex items-center gap-1.5">
                              <i className="fa-solid fa-sliders text-[10px]"></i> פרטים נוספים (רשות)
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <label className="text-[11px] font-bold text-slate-400">מדדי הצלחה ויעדים</label>
                                  <button
                                    onClick={() => generateMetrics(a.id, a.type)}
                                    className="text-xs text-primary-700 hover:text-white bg-primary-50 hover:bg-primary-600 border border-primary-200 hover:border-transparent rounded-lg px-2 py-1 transition-all flex items-center gap-1 font-semibold cursor-pointer"
                                  >
                                    <i className="fa-solid fa-wand-magic-sparkles"></i> עוזר AI
                                  </button>
                                </div>
                                <div className="relative">
                                  <textarea
                                    value={a.metrics}
                                    onChange={(e) => updateActivity(a.id, { metrics: e.target.value })}
                                    placeholder="אילו תוצאות נצפה לראות? (כמותי ואיכותי)"
                                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-primary-500 h-20 resize-none leading-relaxed"
                                  />
                                  {metricsLoadingId === a.id && (
                                    <div className="absolute inset-0 bg-white/90 rounded-lg flex items-center justify-center gap-2">
                                      <i className="fa-solid fa-spinner animate-spin text-primary-600"></i>
                                      <span className="text-[11px] font-bold text-primary-600">מנסח מדדים...</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-bold text-slate-400">עדיפות לביצוע</label>
                                <div className="flex gap-1.5 mt-0.5">
                                  {priorityBtn(a.id, 'high', a.priority, 'גבוהה', 'bg-rose-500 text-white border-rose-500 shadow-sm', 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50')}
                                  {priorityBtn(a.id, 'medium', a.priority, 'בינונית', 'bg-amber-500 text-white border-amber-500 shadow-sm', 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50')}
                                  {priorityBtn(a.id, 'low', a.priority, 'רגילה', 'bg-teal-500 text-white border-teal-500 shadow-sm', 'bg-white text-teal-600 border-teal-200 hover:bg-teal-50')}
                                </div>
                              </div>

                              <div className="md:col-span-2 flex flex-col gap-1">
                                <label className="text-[11px] font-bold text-slate-400">קהל יעד <span className="font-normal text-slate-400">(אפשר לבחור כמה)</span></label>
                                <div className="flex flex-wrap gap-1.5">
                                  {audiences.map((aud) => {
                                    const on = (a.audiences ?? []).includes(aud.slug);
                                    return (
                                      <button
                                        key={aud.slug}
                                        type="button"
                                        onClick={() => updateActivity(a.id, {
                                          audiences: on
                                            ? (a.audiences ?? []).filter((s) => s !== aud.slug)
                                            : [...(a.audiences ?? []), aud.slug],
                                        })}
                                        aria-pressed={on}
                                        className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                                          on
                                            ? 'bg-primary-600 text-white border-primary-600'
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                        }`}
                                      >
                                        {aud.label}
                                      </button>
                                    );
                                  })}
                                </div>
                                {/* The note carries what the 5 canonical values can't: the "אחר" audience
                                    itself, or a qualifier such as the specific grade. */}
                                <input
                                  type="text"
                                  value={a.audienceNote ?? ''}
                                  onChange={(e) => updateActivity(a.id, { audienceNote: e.target.value })}
                                  placeholder={
                                    audiences.some((x) => x.isOther && (a.audiences ?? []).includes(x.slug))
                                      ? 'פרטו את קהל היעד…'
                                      : 'פירוט (אופציונלי) — למשל שכבת ח׳'
                                  }
                                  className="border border-slate-200 text-xs rounded-lg p-2 mt-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* AI agent (mock) — lives on the main screen, below the plan */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div
                className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 cursor-pointer"
                onClick={() => setAgentOpen((o) => !o)}
              >
                <div className="flex items-center gap-2">
                  <span className="bg-primary-50 text-primary-600 p-1.5 rounded-lg"><i className="fa-solid fa-wand-magic-sparkles"></i></span>
                  <h4 className="font-bold text-sm text-slate-800">סוכן AI: איתור יוזמות נוספות</h4>
                </div>
                <i className={`fa-solid fa-chevron-down text-xs text-slate-400 transition-transform duration-200 ${agentOpen ? 'rotate-180' : ''}`}></i>
              </div>
              <div className={agentOpen ? 'mt-3' : 'hidden'}>
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                צריכים עוד רעיונות? הפעילו את הסוכן שיחפש פעילויות מותאמות לקהל היעד שלכם.
                <span className="block text-[10px] text-slate-400 mt-1">(הדגמה — בהמשך יחובר ל-AI אמיתי דרך השרת.)</span>
              </p>
              <textarea
                value={agentQuery}
                onChange={(e) => setAgentQuery(e.target.value)}
                rows={2}
                placeholder="למשל: פעילות חווייתית לבית ספר יסודי, או תוכנית להורים ותלמידים..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 text-xs leading-relaxed"
              />
              <div className="flex flex-wrap gap-1.5 my-2">
                {['פעילות חווייתית ליסודי', 'הערכה חלופית בחטיבה', 'קהילת מורים לומדת'].map((c) => (
                  <button key={c} onClick={() => setAgentQuery(c)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] py-1 px-2 rounded-full border border-slate-200 transition-all">{c}</button>
                ))}
              </div>
              <button
                onClick={runAgent}
                disabled={agentLoading}
                className="w-full bg-primary-600 hover:bg-primary-700 transition-all text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 cursor-pointer"
              >
                <i className={`fa-solid ${agentLoading ? 'fa-spinner animate-spin' : 'fa-robot'}`}></i>
                <span>{agentLoading ? 'הסוכן מחפש פתרונות...' : 'הפעל סוכן AI פדגוגי'}</span>
              </button>

              {agentResults.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <h5 className="text-xs font-bold text-primary-700 mb-2 flex items-center gap-1.5"><i className="fa-solid fa-sparkles"></i> פעילויות שהתגלו:</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {agentResults.map((item) => (
                      <div key={item.key} onClick={() => setModalItem(item)} className="p-3 rounded-lg border border-slate-200 border-r-4 bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer" style={{ borderRightColor: sourceMeta(item.source).accent }}>
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="font-bold text-xs text-slate-800">{item.title}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${sourceMeta(item.source).badge}`}>{item.source}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-normal mt-1">{item.short}</p>
                        <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-200">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1"><i className="fa-solid fa-eye text-[9px]"></i> פרטים</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); addActivity({ title: item.title, desc: item.short, type: 'סוכן AI', source: item.source }); }}
                            className="bg-primary-600 hover:bg-primary-700 text-white rounded-md px-2.5 py-1 text-[10px] font-bold flex items-center gap-1"
                            title="הוסף לתוכנית"
                          >
                            <i className="fa-solid fa-plus"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>

            {/* Victory vision */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div
                className="flex items-center justify-between gap-3 cursor-pointer"
                onClick={() => setVisionOpen((o) => !o)}
              >
                <div className="flex items-center gap-3">
                  <span className="bg-amber-100 text-amber-600 w-10 h-10 rounded-xl flex items-center justify-center"><i className="fa-solid fa-trophy text-lg"></i></span>
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">תמונת ניצחון במילים שלי</h3>
                    <p className="text-xs text-slate-500">איך ייראה השינוי בעיקרון זה בסוף השנה?</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!visionOpen && plan.victoryVision?.trim() && (
                    <span className="hidden sm:flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                      <i className="fa-solid fa-check text-[9px]"></i>
                      נוסח
                    </span>
                  )}
                  <i className={`fa-solid fa-chevron-down text-sm text-slate-400 transition-transform duration-200 ${visionOpen ? 'rotate-180' : ''}`}></i>
                </div>
              </div>
              <div className={visionOpen ? 'mt-4 space-y-3' : 'hidden'}>
                <div className="flex justify-end">
                  <button
                    onClick={generateVision}
                    disabled={visionLoading}
                    className="bg-primary-600 hover:bg-primary-700 transition-all text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 cursor-pointer"
                  >
                    <i className={`fa-solid ${visionLoading ? 'fa-spinner animate-spin' : 'fa-wand-magic-sparkles'}`}></i>
                    <span>{visionLoading ? 'מנסח...' : 'ניסוח בעזרת AI'}</span>
                  </button>
                </div>
                <textarea
                  value={plan.victoryVision}
                  onChange={(e) => setVictoryVision(e.target.value)}
                  rows={4}
                  placeholder="לדוגמה: צוות בית הספר שולט בכלי AI, מייצר פדגוגיה חדשנית ומפנה זמן יקר למפגש אישי ורגשי עם התלמידים..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm leading-relaxed"
                />
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <i className="fa-solid fa-lightbulb text-amber-500"></i>
                  <span>טיפ: הוספת פעילויות לתוכנית תעזור לנסח תמונת ניצחון מדויקת יותר.</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Activity detail modal */}
      {modalItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4 print:hidden" onClick={() => setModalItem(null)} dir="rtl">
          <div
            ref={detailModalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-modal-title"
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-xl w-full overflow-hidden animate-fade-in focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-2" style={{ backgroundColor: sourceMeta(modalItem.source).accent }}></div>
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <span className={`border px-2.5 py-1 rounded-full text-[10px] font-bold ${sourceMeta(modalItem.source).badge}`}>{modalItem.source}</span>
                  <h3 id="activity-modal-title" className="text-lg md:text-xl font-bold text-slate-800 mt-2">{modalItem.title}</h3>
                </div>
                <button onClick={() => setModalItem(null)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1.5 rounded-lg transition-colors"><i className="fa-solid fa-xmark text-lg"></i></button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <h4 className="font-bold text-primary-800 flex items-center gap-1.5 text-xs uppercase mb-1"><i className="fa-solid fa-bullseye"></i> מטרת העל</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{modalItem.short}</p>
                </div>
                {modalItem.metrics && (
                  <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100">
                    <h4 className="font-bold text-emerald-800 flex items-center gap-1.5 text-xs uppercase mb-1"><i className="fa-solid fa-chart-line"></i> מדדי הצלחה ויעדים</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{modalItem.metrics}</p>
                    <p className="text-[10px] text-emerald-700/80 mt-1.5">המדדים ייכנסו אוטומטית לפעילות בתוכנית — ותוכלו לערוך אותם.</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <h4 className="font-bold text-teal-700 flex items-center gap-1.5 text-xs uppercase mb-1"><i className="fa-solid fa-users"></i> קהל יעד מומלץ</h4>
                    <p className="text-xs text-slate-600">{audienceLabel(modalItem.audiences, modalItem.audienceNote, audiences)}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <h4 className="font-bold text-purple-700 flex items-center gap-1.5 text-xs uppercase mb-1"><i className="fa-solid fa-address-book"></i> למי פונים ברשות?</h4>
                    <p className="text-xs text-slate-600">{modalItem.contact}</p>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs uppercase mb-1"><i className="fa-solid fa-circle-info"></i> מתווה והפעלה</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{modalItem.description}</p>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button onClick={() => setModalItem(null)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">סגור</button>
                {plan.activities.some((a) => a.bankKey === modalItem.key) ? (
                  <span className="px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <i className="fa-solid fa-check"></i> כבר בתוכנית שלי
                  </span>
                ) : (
                  <button
                    onClick={() => { addActivity({ title: modalItem.title, desc: modalItem.short, type: modalItem.type, source: modalItem.source, metrics: modalItem.metrics, audiences: modalItem.audiences, audienceNote: modalItem.audienceNote, bankKey: modalItem.key }); setModalItem(null); }}
                    className="text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md hover:opacity-90"
                    style={{ backgroundColor: sourceMeta(modalItem.source).accent }}
                  >
                    <i className="fa-solid fa-plus"></i> הוספה לתוכנית שלי
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset confirm */}
      {confirmReset && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4 print:hidden" onClick={() => setConfirmReset(false)} dir="rtl">
          <div
            ref={resetModalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-modal-title"
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 text-center animate-fade-in focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-4"><i className="fa-solid fa-triangle-exclamation text-2xl"></i></div>
            <h4 id="reset-modal-title" className="font-bold text-lg text-slate-800 mb-2">לאפס את תוכנית העיקרון?</h4>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">פעולה זו תמחק את כל הפעילויות ותמונת הניצחון של עיקרון "{principle.title}". לא ניתן לשחזר.</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setConfirmReset(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">ביטול</button>
              <button onClick={resetPlan} className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md">כן, אפס</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
