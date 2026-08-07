import React from 'react';
import { Principle } from '../types';
import { Collapsible } from './Collapsible';
import { usePrinciples } from '../lib/PrinciplesContext';
import { principleTheme } from '../lib/principleTheme';

interface PrincipleDetailViewProps {
  principle: Principle;
  scores: { [key: number]: number };
  /** Whether this principle has been mapped yet. Drives the maturity badge. */
  assessed?: boolean;
  /** The level chosen in the diagnostic, marked inside the rubric. Lives in App state. */
  selectedLevel?: number;
}

/** Guards for the narrative sections below. */
const has = (s?: string) => !!s?.trim();
const hasAny = (a?: string[]) => !!a?.some((x) => x.trim());

// Pure content panel for one principle. Selection/navigation is handled by the
// principle list in OrientView — this component just renders the chosen principle.
//
// Every narrative section is guarded: a school's own principle is created through a lean
// wizard that only asks for identity, a summary, a rationale and the rubric, so rendering
// the full municipal layout unconditionally would show eight headings with empty bodies.
export const PrincipleDetailView: React.FC<PrincipleDetailViewProps> = ({
  principle,
  scores,
  assessed = false,
  selectedLevel,
}) => {
  const currentScore = scores[principle.id] || 1;

  // The rubric and the display number both come from the same context this component
  // already needs, so reading it here beats threading two props through OrientView.
  const { rubrics, displayNumbers } = usePrinciples();
  const rubric = rubrics.find((r) => r.id === principle.id);

  // Closed palette — shared with the admin editor's colour picker so the two cannot drift.
  const colors = principleTheme(principle.colorName);

  const showGaps = hasAny(principle.gapsSolved);
  const showAddedValue = has(principle.addedValue);
  const showSacrifices = has(principle.sacrificesRequired);
  const showPartnerships = has(principle.ecosystemPartnerships);
  const showTeacher = has(principle.teacherDeliverable);
  const showStudent = has(principle.studentDeliverable);
  const showFirstStep = has(principle.firstStep);

  const hasNarrative =
    has(principle.rationale) || showGaps || showAddedValue ||
    hasAny(principle.implementationStrategy) || showSacrifices || showPartnerships ||
    hasAny(principle.kpis) || showTeacher || showStudent || showFirstStep ||
    principle.sources.length > 0;

  return (
    <div className="space-y-8 animate-fade-in text-[#0f172a]">
      {/* Main Principle Header Card — light surface with a principle-colored accent edge */}
      <div
        className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-slate-200 border-r-8"
        style={{ borderRightColor: principle.accentColor }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start md:items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colors.badge} text-lg font-bold p-2 overflow-hidden`}>
              <i className={principle.icon}></i>
            </div>
            <div className="space-y-1 text-right">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: principle.accentColor }}>
                  עיקרון {displayNumbers[principle.id] ?? principle.id}
                </span>
                {principle.scope === 'school' && (
                  <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 text-[10px] font-bold">
                    ייחודי לבית הספר
                  </span>
                )}
              </div>
              <h2 className="text-lg md:text-2xl font-bold tracking-tight text-slate-900 leading-tight">{principle.title}</h2>
            </div>
          </div>

          <div className="bg-slate-50 px-4 py-2 rounded-xl text-center border border-slate-200 shrink-0">
            <span className="block text-xs text-slate-500 font-bold uppercase">שיוך רמת בשלות נוכחית</span>
            {assessed ? (
              <span className="text-lg font-mono font-bold text-primary-700">רמה {currentScore.toFixed(1)}</span>
            ) : (
              <span className="text-sm font-bold text-slate-400">טרם בוצע מיפוי</span>
            )}
          </div>
        </div>
      </div>

      {/* Structured detailed content (full width — informational only) */}
      <div className="space-y-8">
        <div className="space-y-8">

          {/* 0. The rubric this principle is scored against. First, because it is the only
                section the school is measured on — and the only one a lean school
                principle is guaranteed to have. */}
          {!!rubric?.levels.length && (
            <Collapsible title="ארבע רמות הבשלות" icon="fa-solid fa-ruler">
              <div className="space-y-3">
                {rubric.levels.map((l) => {
                  const current = selectedLevel === l.level;
                  return (
                    <div
                      key={l.level}
                      className={`p-3 rounded-xl border flex gap-3 items-start ${
                        current ? 'bg-primary-50/60 border-primary-200' : 'bg-slate-50/50 border-slate-200'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
                          current ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {l.level}
                      </span>
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs md:text-sm font-bold text-slate-900">{l.name || `רמה ${l.level}`}</span>
                          {current && (
                            <span className="text-[10px] font-bold text-primary-700 bg-primary-100 rounded-full px-2 py-0.5">
                              כאן מיפיתם את עצמכם
                            </span>
                          )}
                        </div>
                        {has(l.description) && (
                          <p className="text-xs text-slate-600 leading-relaxed">{l.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Collapsible>
          )}

          {/* A lean principle can legitimately have nothing below. Say so, instead of
              ending the page on a rubric with no explanation. */}
          {!hasNarrative && (
            <p className="text-xs text-slate-400 italic bg-slate-50 border border-slate-200 rounded-xl p-4">
              העיקרון עדיין ללא תוכן מורחב.
              {principle.scope === 'school' && ' אפשר להשלים אותו ממסך ההגדרות.'}
            </p>
          )}

          {/* 1. Rationale and Vision */}
          {has(principle.rationale) && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-50 pb-3">
                <span className={`w-2 h-6 rounded ${colors.accent}`}></span>
                 הרציונל הפדגוגי-ארגוני והחזון (&quot;לשם מה?&quot;)
              </h3>
              <p className="text-sm md:text-base text-slate-700 leading-relaxed text-slate-800 text-justify">
                {principle.rationale}
              </p>
            </div>
          )}

          {/* 2. Gaps Solved & Added Value (Bento Grid) */}
          {(showGaps || showAddedValue) && (
            <div className={`grid gap-6 ${showGaps && showAddedValue ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>

              {showGaps && (
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
                <h4 className="font-bold text-slate-900 text-base flex items-center gap-1.5 text-rose-700">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>אילו פערים העיקרון פותר?</span>
                </h4>
                <ul className="space-y-3">
                  {principle.gapsSolved.map((gap, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-2 leading-relaxed">
                      <span className="p-1 bg-rose-50 rounded-full text-rose-500 mt-0.5 shrink-0 text-[10px] font-bold">
                        <i className="fa-solid fa-xmark"></i>
                      </span>
                      <span>{gap}</span>
                    </li>
                  ))}
                </ul>
              </div>
              )}

              {showAddedValue && (
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
                <h4 className="font-bold text-slate-900 text-base flex items-center gap-1.5 text-emerald-700">
                  <i className="fa-solid fa-circle-check"></i>
                  <span>הערך המוסף בארגון</span>
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {principle.addedValue}
                </p>
              </div>
              )}

            </div>
          )}

          {/* 3. Implementation Strategy & Routines (collapsed by default) */}
          {hasAny(principle.implementationStrategy) && (
          <Collapsible title='אסטרטגיית היישום והסדירויות הארגוניות ("האיך")' icon="fa-solid fa-list-check">
            <div className="space-y-4">
              {principle.implementationStrategy.map((step, idx) => (
                <div key={idx} className="flex gap-4 items-start bg-slate-50/50 p-3 rounded-xl border border-slate-200">
                  <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <p className="text-xs md:text-sm text-slate-700 leading-relaxed">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </Collapsible>
          )}

          {/* 4. Sacrifices Required & Ecosystem Partnerships */}
          {(showSacrifices || showPartnerships) && (
            <div className={`grid gap-6 ${showSacrifices && showPartnerships ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>

              {showSacrifices && (
              <div className="bg-amber-50/40 rounded-xl p-6 border border-amber-100 shadow-sm space-y-3">
                <h4 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                  <i className="fa-solid fa-shield-halved"></i>
                  <span>הוויתורים הנדרשים (מה מפסיקים לעשות?)</span>
                </h4>
                <p className="text-xs text-amber-800 leading-relaxed font-medium">
                  {principle.sacrificesRequired}
                </p>
              </div>
              )}

              {showPartnerships && (
              <div className="bg-teal-50/40 rounded-xl p-6 border border-teal-100 shadow-sm space-y-3">
                <h4 className="font-bold text-teal-950 text-sm flex items-center gap-1.5">
                  <i className="fa-solid fa-people-group"></i>
                  <span>שותפויות באקו-סיסטם הקהילתי</span>
                </h4>
                <p className="text-xs text-teal-800 leading-relaxed font-medium">
                  {principle.ecosystemPartnerships}
                </p>
              </div>
              )}

            </div>
          )}

          {/* 5. Metrics & KPIs */}
          {hasAny(principle.kpis) && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2">
              <i className="fa-solid fa-gauge text-primary-500 text-sm"></i>
              מדדי הצלחה מרכזיים (KPIs) לשילוב בתוכנית העבודה
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {principle.kpis.map((kpi, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2">
                  <span className="text-xs uppercase font-bold text-slate-400">מדד הצלחה {i + 1}</span>
                  <span className="text-xs font-semibold text-slate-800 leading-normal">{kpi}</span>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* 6. Concrete Outputs & First Step for Sept 1st */}
          {(showTeacher || showStudent || showFirstStep) && (
          <div className="bg-gradient-to-br from-primary-50 to-primary-100/40 rounded-2xl p-6 border border-primary-100 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-primary-950 flex items-center gap-2 border-b border-primary-100 pb-2">
              <i className="fa-solid fa-bullseye text-primary-600"></i>
              תוצרים בשטח וצעד ראשון לאחד בספטמבר (&quot;המה&quot;)
            </h3>

            {(showTeacher || showStudent) && (
            <div className={`grid gap-4 ${showTeacher && showStudent ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
              {showTeacher && (
              <div className="bg-white/80 p-4 rounded-xl border border-primary-200/40 space-y-1">
                <span className="inline-block px-2 py-0.5 rounded bg-primary-100 text-primary-700 text-xs font-bold">תוצר המורה (בסוף השנה)</span>
                <p className="text-xs text-slate-700 leading-normal font-medium">{principle.teacherDeliverable}</p>
              </div>
              )}

              {showStudent && (
              <div className="bg-white/80 p-4 rounded-xl border border-primary-200/40 space-y-1">
                <span className="inline-block px-2 py-0.5 rounded bg-primary-100 text-primary-700 text-xs font-bold">תוצר התלמיד (בסוף השנה)</span>
                <p className="text-xs text-slate-700 leading-normal font-medium">{principle.studentDeliverable}</p>
              </div>
              )}
            </div>
            )}

            {showFirstStep && (
            <div className="bg-white p-4 rounded-xl border border-primary-200/80 mt-2 space-y-1 shadow-sm">
              <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-bold">
                🚀 הצעד הראשון המעשי ל-1 בספטמבר
              </span>
              <p className="text-xs md:text-sm text-slate-800 font-bold leading-normal">{principle.firstStep}</p>
            </div>
            )}
          </div>
          )}

          {/* 7. Deepening Sources & Bibliographic Material (collapsed by default) */}
          {principle.sources.length > 0 && (
          <Collapsible title="נספח עומק, למידת עמיתים ומקורות דעת מקצועיים" icon="fa-solid fa-book-bookmark">
            <div className="space-y-4">
              {principle.sources.map((src, i) => (
                <div key={i} className="p-4 rounded-xl border border-slate-50 bg-slate-50/40 hover:bg-slate-50 transition-colors space-y-1.5 text-right">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1">
                      <i className="fa-solid fa-link text-xs text-slate-400"></i>
                      <span>{src.title}</span>
                    </span>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-500 hover:text-primary-700 font-bold underline flex items-center gap-0.5"
                    >
                      <span>כניסה לאתר</span>
                      <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    </a>
                  </div>
                  <p className="text-xs text-slate-600 leading-normal">{src.description}</p>
                  <div className="text-xs text-slate-400 font-mono">
                    <strong>נתיב חיפוש ומילות מפתח:</strong> {src.keywords}
                  </div>
                </div>
              ))}
            </div>
          </Collapsible>
          )}

        </div>

      </div>
    </div>
  );
};
