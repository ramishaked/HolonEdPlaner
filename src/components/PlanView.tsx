import React, { useEffect, useState } from 'react';
import { PRINCIPLES_DATA } from '../data';
import { DiagnosticAnswers, PlanActivity, PrinciplePlan } from '../types';
import { PrincipleMenu } from './PrincipleMenu';
import { Collapsible } from './Collapsible';
import { BankItem, themeFor, METRICS_MOCK, ACTIVITY_BANK_BY_PRINCIPLE } from '../planBank';

interface PlanViewProps {
  scores: { [key: number]: number };
  answers: DiagnosticAnswers;
  /** Jump to a principle's explanation page in the orient zone. */
  onOpenPrincipleInfo?: (id: number) => void;
}

const PLANS_KEY = 'school_principle_plans_v1';

const newId = () => 'act-' + Math.random().toString(36).slice(2, 9);

const blankPlan = (): PrinciplePlan => ({ activities: [], victoryVision: '' });

export const PlanView: React.FC<PlanViewProps> = ({ scores, answers, onOpenPrincipleInfo }) => {
  const [activeTab, setActiveTab] = useState<number>(1);
  const [plans, setPlans] = useState<Record<number, PrinciplePlan>>(() => {
    try {
      const saved = localStorage.getItem(PLANS_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
  }, [plans]);

  const principle = PRINCIPLES_DATA.find((p) => p.id === activeTab) || PRINCIPLES_DATA[0];
  const plan = plans[activeTab] || blankPlan();

  // Modal + AI-agent + reset state
  const [modalItem, setModalItem] = useState<BankItem | null>(null);
  const [agentQuery, setAgentQuery] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentResults, setAgentResults] = useState<BankItem[]>([]);
  const [metricsLoadingId, setMetricsLoadingId] = useState<string | null>(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Agent results reset when switching principle
  useEffect(() => {
    setAgentResults([]);
    setAgentQuery('');
  }, [activeTab]);

  // ---- plan mutations --------------------------------------------------------
  const mutatePlan = (id: number, fn: (p: PrinciplePlan) => PrinciplePlan) =>
    setPlans((prev) => ({ ...prev, [id]: fn(prev[id] || blankPlan()) }));

  const addActivity = (item: { title: string; desc: string; type: string }) => {
    const activity: PlanActivity = {
      id: newId(),
      title: item.type === 'אחר' ? 'פעילות אישית חדשה' : item.title,
      desc: item.desc,
      metrics: '',
      target: 'all',
      owner: '',
      priority: 'medium',
      type: item.type,
      isExpanded: true, // new activities open for editing
    };
    mutatePlan(activeTab, (p) => ({ ...p, activities: [...p.activities, activity] }));
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
        badge: 'סוכן AI',
        short: `רעיון ${n} שנוצר עבור: ${q}`,
        goal: `קידום עקרון "${principle.title}" באמצעות פעילות ממוקדת שנוצרה לבקשתך.`,
        audience: 'מותאם לקהל היעד שהוגדר בבקשה.',
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
                <h2 className="text-base md:text-xl font-bold text-slate-900 leading-tight">{principle.title}</h2>
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

          <Collapsible title='מדוע זהו עקרון ליבה? (״הלמה״)' icon="fa-solid fa-circle-question" className="mt-3">
            <p className="text-sm text-slate-600 leading-relaxed text-justify">{principle.rationale}</p>
          </Collapsible>
        </div>

        {/* Two columns: bank+agent (right) · my plan + victory vision (left) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* RIGHT: Activity bank + AI agent */}
          <aside className="lg:col-span-5 space-y-6">
            {/* Bank */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <i className="fa-solid fa-layer-group text-primary-600"></i>
                  בנק פעילויות
                </h3>
                <span className="bg-primary-50 text-primary-700 text-xs font-semibold px-2 py-1 rounded-full border border-primary-100">חולון 2026</span>
              </div>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                לחצו על כרטיס כדי <strong className="text-slate-700">לקרוא בהרחבה</strong>, או על <strong className="font-mono">+</strong> כדי להוסיף לתוכנית.
              </p>

              <div className="flex flex-col gap-3">
                {(ACTIVITY_BANK_BY_PRINCIPLE[activeTab] ?? []).map((item) => {
                  const th = themeFor(item.type);
                  return (
                    <div
                      key={item.key}
                      onClick={() => setModalItem(item)}
                      className="group border border-slate-200 hover:border-slate-300 border-r-4 rounded-xl p-3.5 transition-all cursor-pointer shadow-sm hover:shadow bg-white"
                      style={{ borderRightColor: th.accent }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="font-bold text-slate-800 text-sm">{item.title}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${th.badge}`}>{item.badge}</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3 leading-relaxed">{item.short}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 group-hover:text-slate-600 flex items-center gap-1">
                          <i className="fa-solid fa-eye text-[10px]"></i> פרטים מלאים
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); addActivity({ title: item.title, desc: item.short, type: item.type }); }}
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

            {/* AI agent (mock) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                <span className="bg-primary-50 text-primary-600 p-1.5 rounded-lg"><i className="fa-solid fa-wand-magic-sparkles"></i></span>
                <h4 className="font-bold text-sm text-slate-800">סוכן AI: איתור יוזמות נוספות</h4>
              </div>
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
                  <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto custom-scroll pr-1">
                    {agentResults.map((item) => (
                      <div key={item.key} onClick={() => setModalItem(item)} className="p-3 rounded-lg border border-slate-200 border-r-4 bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer" style={{ borderRightColor: themeFor('סוכן AI').accent }}>
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="font-bold text-xs text-slate-800">{item.title}</span>
                          <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold px-1.5 py-0.5 rounded-full">{item.badge}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-normal mt-1">{item.short}</p>
                        <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-200">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1"><i className="fa-solid fa-eye text-[9px]"></i> פרטים</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); addActivity({ title: item.title, desc: item.short, type: 'סוכן AI' }); }}
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
          </aside>

          {/* LEFT: My plan + victory vision */}
          <section className="lg:col-span-7 space-y-6">
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

              {plan.activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3"><i className="fa-solid fa-folder-open text-xl"></i></div>
                  <h4 className="font-bold text-slate-700 mb-1 text-sm">תוכנית העבודה ריקה</h4>
                  <p className="text-xs text-slate-500 max-w-sm">בחרו פעילויות מבנק הפעילויות מצד ימין או מהסוכן כדי להתחיל להרכיב את התוכנית.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {plan.activities.map((a) => {
                    const th = themeFor(a.type);
                    return (
                      <div key={a.id} className="border border-slate-200 border-r-4 rounded-xl overflow-hidden bg-white shadow-sm" style={{ borderRightColor: th.accent }}>
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
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${th.badge}`}>{a.type}</span>
                            <button onClick={() => removeActivity(a.id)} className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" title="מחיקה">
                              <i className="fa-solid fa-trash-can text-xs"></i>
                            </button>
                            <button onClick={() => toggleExpand(a.id)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors" title="הרחב/צמצם פרטים">
                              <i className={`fa-solid fa-chevron-down text-xs transition-transform duration-200 ${a.isExpanded === false ? '' : 'rotate-180'}`}></i>
                            </button>
                          </div>
                        </div>

                        <div className={`p-4 grid grid-cols-1 md:grid-cols-2 gap-4 ${a.isExpanded === false ? 'hidden' : ''}`}>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-500">הסבר קצר על הפעולה</label>
                            <textarea
                              value={a.desc}
                              onChange={(e) => updateActivity(a.id, { desc: e.target.value })}
                              placeholder="מה מהות הפעילות וכיצד היא מקדמת את העיקרון?"
                              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-primary-500 h-20 resize-none leading-relaxed"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-xs font-bold text-slate-500">מדדי הצלחה ויעדים</label>
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

                          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-bold text-slate-500">קהל יעד</label>
                              <select
                                value={a.target}
                                onChange={(e) => updateActivity(a.id, { target: e.target.value as PlanActivity['target'] })}
                                className="border border-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                              >
                                <option value="all">כלל צוות בית הספר ותלמידיו</option>
                                <option value="layers">שכבות גיל ספציפיות</option>
                                <option value="teachers">צוות מנהיגות/מורים בלבד</option>
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-bold text-slate-500">אחראי יישום</label>
                              <input
                                type="text"
                                value={a.owner}
                                onChange={(e) => updateActivity(a.id, { owner: e.target.value })}
                                placeholder="מי מוביל את התהליך?"
                                className="border border-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-bold text-slate-500">עדיפות לביצוע</label>
                              <div className="flex gap-1.5 mt-0.5">
                                {priorityBtn(a.id, 'high', a.priority, 'גבוהה', 'bg-rose-500 text-white border-rose-500 shadow-sm', 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50')}
                                {priorityBtn(a.id, 'medium', a.priority, 'בינונית', 'bg-amber-500 text-white border-amber-500 shadow-sm', 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50')}
                                {priorityBtn(a.id, 'low', a.priority, 'רגילה', 'bg-teal-500 text-white border-teal-500 shadow-sm', 'bg-white text-teal-600 border-teal-200 hover:bg-teal-50')}
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

            {/* Victory vision */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <span className="bg-amber-100 text-amber-600 w-10 h-10 rounded-xl flex items-center justify-center"><i className="fa-solid fa-trophy text-lg"></i></span>
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">תמונת ניצחון במילים שלי</h3>
                    <p className="text-xs text-slate-500">איך ייראה השינוי בעיקרון זה בסוף השנה?</p>
                  </div>
                </div>
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
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-3">
                <i className="fa-solid fa-lightbulb text-amber-500"></i>
                <span>טיפ: הוספת פעילויות לתוכנית תעזור לנסח תמונת ניצחון מדויקת יותר.</span>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Activity detail modal */}
      {modalItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4 print:hidden" onClick={() => setModalItem(null)} dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-xl w-full overflow-hidden animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="h-2" style={{ backgroundColor: themeFor(modalItem.type).accent }}></div>
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <span className={`border px-2.5 py-1 rounded-full text-[10px] font-bold ${themeFor(modalItem.type).badge}`}>{modalItem.badge}</span>
                  <h3 className="text-lg md:text-xl font-bold text-slate-800 mt-2">{modalItem.title}</h3>
                </div>
                <button onClick={() => setModalItem(null)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1.5 rounded-lg transition-colors"><i className="fa-solid fa-xmark text-lg"></i></button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <h4 className="font-bold text-primary-800 flex items-center gap-1.5 text-xs uppercase mb-1"><i className="fa-solid fa-bullseye"></i> מטרת העל</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{modalItem.goal}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <h4 className="font-bold text-teal-700 flex items-center gap-1.5 text-xs uppercase mb-1"><i className="fa-solid fa-users"></i> קהל יעד מומלץ</h4>
                    <p className="text-xs text-slate-600">{modalItem.audience}</p>
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
                <button
                  onClick={() => { addActivity({ title: modalItem.title, desc: modalItem.short, type: modalItem.type }); setModalItem(null); }}
                  className="text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md hover:opacity-90"
                  style={{ backgroundColor: themeFor(modalItem.type).accent }}
                >
                  <i className="fa-solid fa-plus"></i> הוספה לתוכנית שלי
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset confirm */}
      {confirmReset && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4 print:hidden" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 text-center animate-fade-in">
            <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-4"><i className="fa-solid fa-triangle-exclamation text-2xl"></i></div>
            <h4 className="font-bold text-lg text-slate-800 mb-2">לאפס את תוכנית העיקרון?</h4>
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
