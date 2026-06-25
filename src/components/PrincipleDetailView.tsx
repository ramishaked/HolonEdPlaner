import React from 'react';
import { Principle, DiagnosticResponse } from '../types';
import { PRINCIPLES_DATA } from '../data';

interface PrincipleDetailViewProps {
  principle: Principle;
  scores: { [key: number]: number };
  diagnosticResponse?: DiagnosticResponse;
  onUpdateScore: (principleId: number, fields: Partial<DiagnosticResponse>) => void;
  onNavigateBack: () => void;
  onNavigateToDiagnostic: () => void;
}

export const PrincipleDetailView: React.FC<PrincipleDetailViewProps> = ({
  principle,
  scores,
  diagnosticResponse = { whyScore: 1, howScore: 1, whatScore: 1, selectedMaturityLevel: 1, evidence: "" },
  onUpdateScore,
  onNavigateBack,
  onNavigateToDiagnostic,
}) => {
  // Navigation helpers to switch between principles smoothly inside the detail view
  const currentIndex = PRINCIPLES_DATA.findIndex(p => p.id === principle.id);
  const nextPrinciple = PRINCIPLES_DATA[(currentIndex + 1) % PRINCIPLES_DATA.length];
  const prevPrinciple = PRINCIPLES_DATA[(currentIndex - 1 + PRINCIPLES_DATA.length) % PRINCIPLES_DATA.length];

  const currentScore = scores[principle.id] || 1;

  // Color helper lookup for beautiful visual borders and icons
  const getThemeColors = (colorName: string) => {
    switch (colorName) {
      case 'purple':
        return {
          bg: 'bg-purple-50/50',
          border: 'border-ai/30',
          text: 'text-ai',
          accent: 'bg-ai',
          accentText: 'text-ai',
          glow: 'shadow-purple-100',
          badge: 'bg-purple-100/60 text-ai font-bold'
        };
      case 'blue':
        return {
          bg: 'bg-blue-50/50',
          border: 'border-holistic/30',
          text: 'text-holistic',
          accent: 'bg-holistic',
          accentText: 'text-holistic',
          glow: 'shadow-blue-100',
          badge: 'bg-blue-100/60 text-holistic font-bold'
        };
      case 'orange':
        return {
          bg: 'bg-orange-50/50',
          border: 'border-maker/30',
          text: 'text-maker',
          accent: 'bg-maker',
          accentText: 'text-maker',
          glow: 'shadow-orange-100',
          badge: 'bg-orange-100/60 text-maker font-bold'
        };
      case 'cyan':
        return {
          bg: 'bg-cyan-50/50',
          border: 'border-byod/30',
          text: 'text-byod',
          accent: 'bg-byod',
          accentText: 'text-byod',
          glow: 'shadow-cyan-100',
          badge: 'bg-cyan-100/60 text-byod font-bold'
        };
      case 'emerald':
        return {
          bg: 'bg-emerald-50/50',
          border: 'border-skills/30',
          text: 'text-skills',
          accent: 'bg-skills',
          accentText: 'text-skills',
          glow: 'shadow-emerald-100',
          badge: 'bg-emerald-100/60 text-skills font-bold'
        };
      case 'indigo':
        return {
          bg: 'bg-indigo-50/50',
          border: 'border-spaces/30',
          text: 'text-spaces',
          accent: 'bg-spaces',
          accentText: 'text-spaces',
          glow: 'shadow-indigo-100',
          badge: 'bg-indigo-100/60 text-spaces font-bold'
        };
      case 'rose':
        return {
          bg: 'bg-rose-50/50',
          border: 'border-human/30',
          text: 'text-human',
          accent: 'bg-human',
          accentText: 'text-human',
          glow: 'shadow-rose-100',
          badge: 'bg-rose-100/60 text-human font-bold'
        };
      default:
        return {
          bg: 'bg-slate-50',
          border: 'border-slate-200',
          text: 'text-slate-700',
          accent: 'bg-slate-600',
          accentText: 'text-slate-750',
          glow: 'shadow-slate-100',
          badge: 'bg-slate-100 text-slate-700 font-bold'
        };
    }
  };

  const colors = getThemeColors(principle.colorName);

  return (
    <div className="space-y-8 animate-fade-in text-[#0f172a]">
      {/* Top action navbar inside Detail view - Glass Glass Card */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200/60 pb-3 bg-white/95 backdrop-blur p-3 rounded-xl shadow-sm glass-card">
        <button
          onClick={onNavigateBack}
          className="px-4 py-2 text-xs text-slate-750 hover:text-[#0f172a] font-bold flex items-center gap-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <i className="fa-solid fa-arrow-right"></i>
          <span>חזרה לדף הבית</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Direct switcher buttons */}
          <button
            onClick={() => onUpdateScore(prevPrinciple.id, {})} // triggers active switcher trigger
            className="p-2 border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            title="לעיקרון הקודם"
          >
            <i className="fa-solid fa-chevron-right"></i>
          </button>
          
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full font-mono">
            עיקרון {principle.id} מתוך 7
          </span>

          <button
            onClick={() => onUpdateScore(nextPrinciple.id, {})}
            className="p-2 border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            title="לעיקרון הבא"
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>
        </div>

        <button
          onClick={onNavigateToDiagnostic}
          className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center gap-1 shadow-md cursor-pointer"
        >
          <i className="fa-solid fa-chart-pie"></i>
          <span>מעבר לדף האבחון הכללי ←</span>
        </button>
      </div>

      {/* Main Principle Header Card - Dark Premium Slate with Vibrant Top-Right Indicator */}
      <div 
        className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white rounded-2xl p-6 md:p-8 shadow-md border-r-8"
        style={{ borderRightColor: principle.accentColor }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start md:items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${colors.badge} text-xl font-bold p-3 overflow-hidden shadow-inner`}>
              <i className={principle.icon}></i>
            </div>
            <div className="space-y-1 text-right">
              <span className="text-xs text-blue-300 font-bold uppercase tracking-wider">עמוד השדרה הפדגוגי והארגוני - עיקרון {principle.id}</span>
              <h2 className="text-xl md:text-3xl font-black tracking-tight">{principle.title}</h2>
            </div>
          </div>

          <div className="bg-white/10 px-4 py-2 rounded-xl text-center border border-white/10 shrink-0">
            <span className="block text-[10px] text-slate-300 font-bold uppercase">שיוך רמת בשלות נוכחית</span>
            <span className="text-lg font-mono font-black text-blue-300">רמה {currentScore.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Structured detailed content block in Hebrew grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Extensive Content (2/3 width) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* 1. Rationale and Vision */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-50 pb-3">
              <span className={`w-2 h-6 rounded ${colors.accent}`}></span>
               הרציונל הפדגוגי-ארגוני והחזון (&quot;לשם מה?&quot;)
            </h3>
            <p className="text-sm md:text-base text-slate-700 leading-relaxed text-slate-800 text-justify">
              {principle.rationale}
            </p>
          </div>

          {/* 2. Gaps Solved & Added Value (Bento Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 text-base flex items-center gap-1.5 text-rose-700">
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>אילו פערים העיקרון פותר?</span>
              </h4>
              <ul className="space-y-3">
                {principle.gapsSolved.map((gap, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-start gap-2 leading-relaxed">
                    <span className="p-1 bg-rose-50 rounded-full text-rose-500 mt-0.5 shrink-0 text-[8px] font-bold">
                      <i className="fa-solid fa-xmark"></i>
                    </span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 text-base flex items-center gap-1.5 text-emerald-700">
                <i className="fa-solid fa-circle-check"></i>
                <span>הערך המוסף בארגון</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {principle.addedValue}
              </p>
            </div>

          </div>

          {/* 3. Implementation Strategy & Routines */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-50 pb-3">
              <span className={`w-2 h-6 rounded bg-indigo-600`}></span>
              אסטרטגיית היישום והסדירויות הארגוניות (&quot;האיך&quot;)
            </h3>
            <div className="space-y-4">
              {principle.implementationStrategy.map((step, idx) => (
                <div key={idx} className="flex gap-4 items-start bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <p className="text-xs md:text-sm text-slate-700 leading-relaxed">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Sacrifices Required & Ecosystem Partnerships */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="bg-amber-50/40 rounded-xl p-6 border border-amber-100 shadow-sm space-y-3">
              <h4 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                <i className="fa-solid fa-shield-halved"></i>
                <span>הוויתורים הנדרשים (מה מפסיקים לעשות?)</span>
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed font-medium">
                {principle.sacrificesRequired}
              </p>
            </div>

            <div className="bg-teal-50/40 rounded-xl p-6 border border-teal-100 shadow-sm space-y-3">
              <h4 className="font-bold text-teal-950 text-sm flex items-center gap-1.5">
                <i className="fa-solid fa-people-group"></i>
                <span>שותפויות באקו-סיסטם הקהילתי</span>
              </h4>
              <p className="text-xs text-teal-850 leading-relaxed font-medium">
                {principle.ecosystemPartnerships}
              </p>
            </div>

          </div>

          {/* 5. Metrics & KPIs */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2">
              <i className="fa-solid fa-gauge text-indigo-500 text-sm"></i>
              מדדי הצלחה מרכזיים (KPIs) לשילוב בתוכנית העבודה
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {principle.kpis.map((kpi, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">מדד הצלחה {i + 1}</span>
                  <span className="text-xs font-semibold text-slate-800 leading-normal">{kpi}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 6. Concrete Outputs & First Step for Sept 1st */}
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 rounded-2xl p-6 border border-indigo-100 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-indigo-950 flex items-center gap-2 border-b border-indigo-100 pb-2">
              <i className="fa-solid fa-bullseye text-indigo-600"></i>
              תוצרים בשטח וצעד ראשון לאחד בספטמבר (&quot;המה&quot;)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/80 p-4 rounded-xl border border-indigo-200/40 space-y-1">
                <span className="inline-block px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold">תוצר המורה (בסוף השנה)</span>
                <p className="text-xs text-slate-700 leading-normal font-medium">{principle.teacherDeliverable}</p>
              </div>

              <div className="bg-white/80 p-4 rounded-xl border border-indigo-200/40 space-y-1">
                <span className="inline-block px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold">תוצר התלמיד (בסוף השנה)</span>
                <p className="text-xs text-slate-700 leading-normal font-medium">{principle.studentDeliverable}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-indigo-200/80 mt-2 space-y-1 shadow-sm">
              <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-black">
                🚀 הצעד הראשון המעשי ל-1 בספטמבר
              </span>
              <p className="text-xs md:text-sm text-slate-800 font-bold leading-normal">{principle.firstStep}</p>
            </div>
          </div>

          {/* 7. Deepening Sources & Bibliographic Material */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <i className="fa-solid fa-book-bookmark text-slate-500"></i>
              <span>נספח עומק, למידת עמיתים ומקורות דעת מקצועיים</span>
            </h3>
            
            <div className="space-y-4">
              {principle.sources.map((src, i) => (
                <div key={i} className="p-4 rounded-xl border border-slate-50 bg-slate-50/40 hover:bg-slate-50 transition-colors space-y-1.5 text-right">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1">
                      <i className="fa-solid fa-link text-[10px] text-slate-400"></i>
                      <span>{src.title}</span>
                    </span>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold underline flex items-center gap-0.5"
                    >
                      <span>כניסה לאתר</span>
                      <i className="fa-solid fa-arrow-up-right-from-square text-[8px]"></i>
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-normal">{src.description}</p>
                  <div className="text-[9px] text-slate-400 font-mono">
                    <strong>נתיב חיפוש ומילות מפתח:</strong> {src.keywords}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Mini Interactive Assessment (1/3 width) */}
        <div className="space-y-6">
          
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md space-y-6 sticky top-4 border border-indigo-950">
            <div className="space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                מיפוי אקטיבי מהיר
              </span>
              <h3 className="text-lg font-black">התקדמות המיפוי בעיקרון זה</h3>
              <p className="text-xs text-slate-400 leading-normal">
                כדי שניתן יהיה לגזור את ה-&quot;רדאר&quot;, השלם את האבחון של העיקרון על בסיס 3 צירי 'מעגל הזהב'.
              </p>
            </div>

            {/* Slider / select mapping for axis 1, 2, 3 */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              
              {/* Axis 1 */}
              <div className="space-y-1 text-right">
                <label className="block text-xs font-semibold text-slate-300">
                  1. ציר התרבות והתפיסה (הלמה)
                </label>
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="range"
                    min="1"
                    max="4"
                    step="1"
                    value={diagnosticResponse.whyScore}
                    onChange={(e) => onUpdateScore(principle.id, { whyScore: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <span className="text-xs font-mono font-bold bg-slate-800 px-2.5 py-1 rounded text-indigo-300 shrink-0">
                    רמה {diagnosticResponse.whyScore}
                  </span>
                </div>
              </div>

              {/* Axis 2 */}
              <div className="space-y-1 text-right">
                <label className="block text-xs font-semibold text-slate-300">
                  2. ציר הסדירויות והמנגנונים (האיך)
                </label>
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="range"
                    min="1"
                    max="4"
                    step="1"
                    value={diagnosticResponse.howScore}
                    onChange={(e) => onUpdateScore(principle.id, { howScore: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <span className="text-xs font-mono font-bold bg-slate-800 px-2.5 py-1 rounded text-indigo-300 shrink-0">
                    רמה {diagnosticResponse.howScore}
                  </span>
                </div>
              </div>

              {/* Axis 3 */}
              <div className="space-y-1 text-right">
                <label className="block text-xs font-semibold text-slate-300">
                  3. ציר התוצרים והמדידה (המה)
                </label>
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="range"
                    min="1"
                    max="4"
                    step="1"
                    value={diagnosticResponse.whatScore}
                    onChange={(e) => onUpdateScore(principle.id, { whatScore: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <span className="text-xs font-mono font-bold bg-slate-800 px-2.5 py-1 rounded text-indigo-300 shrink-0">
                    רמה {diagnosticResponse.whatScore}
                  </span>
                </div>
              </div>

            </div>

            {/* Evidence details input */}
            <div className="space-y-2 text-right">
              <label className="block text-xs font-semibold text-indigo-300 flex items-center gap-1">
                <i className="fa-solid fa-file-pen"></i>
                <span>הוכחה וצידוק מהשטח</span>
              </label>
              <textarea
                value={diagnosticResponse.evidence}
                onChange={(e) => onUpdateScore(principle.id, { evidence: e.target.value })}
                placeholder="סמן הוכחות קורקנטיות: למה סימנת רמה זו? מה עוד חסר לנו בגזרות אלו להטמעה מלאה?"
                rows={3}
                className="w-full p-2.5 text-xs text-slate-100 bg-slate-850 border border-slate-750 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Live calculation score preview */}
            <div className="p-3 bg-indigo-950/80 rounded-xl border border-indigo-900/40 text-center space-y-1.5">
              <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider block">ציון משוקלל לעיקרון {principle.id}</span>
              <span className="text-2xl font-mono font-black text-white">{currentScore.toFixed(1)}</span>
              <span className="block text-[10px] text-slate-400">חושב אוטומטית כממוצע 3 הצירים</span>
            </div>

            <button
              onClick={onNavigateToDiagnostic}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all duration-150 text-xs text-center flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-chart-line"></i>
              <span>שמירה וצפייה במפה הכללית</span>
            </button> 
          </div>

        </div>

      </div>
    </div>
  );
};
