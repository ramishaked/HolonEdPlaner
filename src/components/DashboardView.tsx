import React from 'react';
import { PRINCIPLES_DATA } from '../data';
import { Principle } from '../types';

interface DashboardViewProps {
  scores: { [key: number]: number };
  diagnosticCompletedCount: number;
  onSelectPrinciple: (id: number) => void;
  onNavigateToDiagnostic: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  scores,
  diagnosticCompletedCount,
  onSelectPrinciple,
  onNavigateToDiagnostic,
}) => {
  // Translate tailwind class colors for borders and icons dynamically
  const getColorClasses = (colorName: string) => {
    switch (colorName) {
      case 'purple':
        return {
          bg: 'bg-purple-50',
          text: 'text-ai',
          border: 'border-purple-200',
          topBorder: 'border-ai',
          hoverBg: 'hover:bg-purple-50/20',
          hoverBorder: 'hover:border-ai',
          glow: 'hover:shadow-[0_8px_30px_rgba(168,85,247,0.15)]',
          badge: 'bg-purple-100 text-purple-700',
          iconBg: 'bg-purple-100 text-purple-600'
        };
      case 'blue':
        return {
          bg: 'bg-blue-50',
          text: 'text-holistic',
          border: 'border-blue-200',
          topBorder: 'border-holistic',
          hoverBg: 'hover:bg-blue-50/20',
          hoverBorder: 'hover:border-holistic',
          glow: 'hover:shadow-[0_8px_30px_rgba(59,130,246,0.15)]',
          badge: 'bg-blue-100 text-blue-700',
          iconBg: 'bg-blue-100 text-blue-600'
        };
      case 'orange':
        return {
          bg: 'bg-orange-50',
          text: 'text-maker',
          border: 'border-orange-200',
          topBorder: 'border-maker',
          hoverBg: 'hover:bg-orange-50/20',
          hoverBorder: 'hover:border-maker',
          glow: 'hover:shadow-[0_8px_30px_rgba(249,115,22,0.15)]',
          badge: 'bg-orange-100 text-orange-700',
          iconBg: 'bg-orange-100 text-orange-600'
        };
      case 'cyan':
        return {
          bg: 'bg-cyan-50',
          text: 'text-byod',
          border: 'border-cyan-200',
          topBorder: 'border-byod',
          hoverBg: 'hover:bg-cyan-50/20',
          hoverBorder: 'hover:border-byod',
          glow: 'hover:shadow-[0_8px_30px_rgba(6,182,212,0.15)]',
          badge: 'bg-cyan-100 text-cyan-700',
          iconBg: 'bg-cyan-100 text-cyan-600'
        };
      case 'emerald':
        return {
          bg: 'bg-emerald-50',
          text: 'text-skills',
          border: 'border-emerald-200',
          topBorder: 'border-skills',
          hoverBg: 'hover:bg-emerald-50/20',
          hoverBorder: 'hover:border-skills',
          glow: 'hover:shadow-[0_8px_30px_rgba(16,185,129,0.15)]',
          badge: 'bg-emerald-100 text-emerald-700',
          iconBg: 'bg-emerald-100 text-emerald-600'
        };
      case 'indigo':
        return {
          bg: 'bg-indigo-50',
          text: 'text-spaces',
          border: 'border-indigo-200',
          topBorder: 'border-spaces',
          hoverBg: 'hover:bg-indigo-50/20',
          hoverBorder: 'hover:border-spaces',
          glow: 'hover:shadow-[0_8px_30px_rgba(99,102,241,0.15)]',
          badge: 'bg-indigo-100 text-indigo-700',
          iconBg: 'bg-indigo-100 text-indigo-600'
        };
      case 'rose':
        return {
          bg: 'bg-rose-50',
          text: 'text-human',
          border: 'border-rose-200',
          topBorder: 'border-human',
          hoverBg: 'hover:bg-rose-50/20',
          hoverBorder: 'hover:border-human',
          glow: 'hover:shadow-[0_8px_30px_rgba(244,63,94,0.15)]',
          badge: 'bg-rose-100 text-rose-700',
          iconBg: 'bg-rose-100 text-rose-600'
        };
      default:
        return {
          bg: 'bg-slate-50',
          text: 'text-slate-600',
          border: 'border-slate-150',
          topBorder: 'border-slate-300',
          hoverBg: 'hover:bg-slate-50/20',
          hoverBorder: 'hover:border-slate-500',
          glow: 'hover:shadow-md',
          badge: 'bg-slate-100 text-slate-700',
          iconBg: 'bg-slate-100 text-slate-600'
        };
    }
  };

  const pct = Math.round((diagnosticCompletedCount / 7) * 100);

  return (
    <div className="space-y-10">
      {/* Premium Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-8 lg:p-12 shadow-xl border border-indigo-900/40">
        {/* Abstract background decorative patterns */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative max-w-4xl space-y-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <i className="fa-solid fa-sparkles text-[10px]"></i>
            קיט מנהלים לתכנית עבודה-שבעת העקרונות.
          </span>

          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight lg:leading-tight">
            קיט מנהלים שבעת העקרונות- ערכת כלים אינטראקטיבית לכתיבת תכנית עבודה.
          </h1>

          <div className="bg-slate-950/45 backdrop-blur-sm border border-slate-800/60 p-6 md:p-8 rounded-2xl space-y-6 text-slate-200 text-right text-sm leading-relaxed">
            <div className="space-y-4 text-xs md:text-sm">
              <p>
                כתיבת תוכנית עבודה שנתית היא אחד מרגעי המנהיגות המשמעותיים ביותר שלנו לאורך השנה. זוהי נקודת הזמן שבה אנו נדרשים לפרוץ את שגרת הניהול השוטפת, להרים את המבט, ולהפוך חזון פדגוגי למציאות חינוכית מעוצבת היטב בין כותלי בית הספר.
              </p>
              
              <p>
                ערכת כלים זו (הקיט למנהל) נועדה לשמש עבורכם כבסיס לכתיבת תכנית העבודה ומצע לדיון הנהלה לקראת השנה הקרובה. 
              </p>
            </div>

            <div className="space-y-3 pt-2 text-xs md:text-sm">
              <h3 className="text-sm md:text-base font-extrabold text-blue-400 flex items-center gap-2">
                <i className="fa-solid fa-users text-xs"></i>
                איך נוצר הקיט? חוכמת השטח בשותפות מלאה
              </h3>
              
              <p>
                קיט זה נולד מתוך השטח ובשביל השטח. הערכה שלפניכם היא תולדה של תהליך שיתופי ודיאלוגי שהחל במפגש המנהלים העירוני שלנו.
              </p>
              
              <p>
                הדיונים המשותפים, הפערים האמיתיים שהצפתם, והתובנות המדויקות שרשמתם על גבי קנבסי העבודה האסטרטגיים – הם אלו שהיוו את חומר הגלם הבלתי מעובד והבסיס האיתן לניסוח מסמך זה. כל סדירות ארגונית, כל הצעה לוויתור מנהיגותי וכל מדד הצלחה (KPI) שתפגשו בקיט, מייצגים את הקול האותנטי שלכם ואת הניסיון המצטבר של מנהיגות החינוך בעיר. זוהי הלכה למעשה העבודה המשותפת שלנו.
              </p>
            </div>

            <div className="space-y-3 pt-2 text-xs md:text-sm">
              <h3 className="text-sm md:text-base font-extrabold text-blue-400 flex items-center gap-2">
                <i className="fa-solid fa-toolbox text-xs"></i>
                מה תוכל למצוא בקיט כמנהל?
              </h3>
              
              <p>
                כדי להקל על מלאכת התכנון, להוריד את העומס הבירוקרטי ולהפוך את כתיבת התוכנית לתהליך חווייתי וצוותי, הקיט בנוי בצורה מודולרית והוא כולל:
              </p>

              <ol className="space-y-3 pr-4 list-decimal marker:text-blue-400 marker:font-bold">
                <li className="pr-1">
                  <strong className="text-white">המדריך התיאורטי המורחב לשבעת העקרונות:</strong> פירוק מעמיק של שבעת עקרונות המינהל. עבור כל עיקרון מוגדרים: ה"לשם מה" (הרציונל והפערים שהוא בא לפתור), ה"איך" (אסטרטגיית היישום, הסדירויות במערכת השעות, הוויתורים הנדרשים והשותפויות באקו-סיסטם העירוני) וה"מה" (התוצרים המצופים מהמורה ומהתלמיד בסוף השנה, לצד הצעד האופרטיבי הראשון ל-1 בספטמבר).
                </li>
                <li className="pr-1">
                  <strong className="text-white">ספריית העמקה ומקורות דעת:</strong> ריכוז של קישורים חיים ומנחי ניווט למסמכי המדיניות הרשמיים של משרד החינוך, מחקרי מופ"ת, אוגדני אבני ראשה ומודלים בינלאומיים (OECD), המעניקים תוקף פדגוגי ומחקרי מוצק לתוכניות שלכם.
                </li>
                <li className="pr-1">
                  <strong className="text-white">פרוטוקול מהלך הסדנה להנהלה (Plug & Play):</strong> מערך מובנה בן 90 דקות המאפשר לכם להעתיק את חוויית המפגש המשותף שלנו אל תוך חדר הישיבות שלכם, ולרתום את צוות ההנהלה המורחב לחשיבה משותפת.
                </li>
                <li className="pr-1">
                  <strong className="text-white">כלי האבחון הדיגיטלי ("רדאר שבעת העקרונות"):</strong> שאלון אינטראקטיבי מבוסס מחווני בשלות מפורטים, המייצר עבורכם <strong className="text-blue-300 font-semibold">מפת עכביש דינמית בזמן אמת</strong>, המציגה ויזואלית את נקודות החוזק הבית-ספריות מול אזורי הקריסה הארגוניים.
                </li>
              </ol>
            </div>

            <div className="pt-4 border-t border-slate-800 text-left font-bold text-white text-xs md:text-sm leading-normal pl-4">
              בברכת שותפות ועשייה,<br />
              <span className="text-blue-400 font-extrabold text-sm md:text-base">מינהל החינוך</span>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-4">
            <button
              onClick={onNavigateToDiagnostic}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/20 transition-all duration-200 active:scale-95 text-center flex items-center justify-center gap-2 cursor-pointer"
            >
              <i className="fa-solid fa-chart-pie"></i>
              <span>התחלת אבחון בית-ספרי מלא</span>
            </button>
            <a
              href="#grid-principles"
              className="px-6 py-4 bg-white/10 hover:bg-white/15 text-white font-medium rounded-xl border border-white/10 hover:border-white/20 transition-all duration-200 text-center flex items-center justify-center gap-2"
            >
              <span>קריאת העקרונות הפדגוגיים</span>
              <i className="fa-solid fa-arrow-down-long"></i>
            </a>
          </div>
        </div>
      </section>

      {/* Evaluation completion status dashboard widget */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-right w-full md:w-auto">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2 justify-center md:justify-start">
            <i className="fa-solid fa-square-poll-horizontal text-indigo-500"></i>
            <span>התקדמות מיפוי שבעת העקרונות</span>
          </h3>
          <p className="text-sm text-slate-500">
            {diagnosticCompletedCount === 7 
              ? "בשעה טובה! סיימת לאבחן את כל שבעת העקרונות. כעת גזור את תוכנית העבודה שלך המופיעה בתחתית דף האבחון!" 
              : `בוצע מיפוי קונקרטי של ${diagnosticCompletedCount} מתוך 7 עקרונות פדגוגיים.`}
          </p>
        </div>

        <div className="w-full md:max-w-md flex items-center gap-4">
          <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="absolute top-0 right-0 h-full bg-gradient-to-l from-indigo-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            ></div>
          </div>
          <span className="font-mono font-bold text-slate-700 min-w-[3rem] text-left">{pct}%</span>
        </div>
      </div>

      {/* Grid of the 7 Principles */}
      <div id="grid-principles" className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">כניסה לעקרונות הפדגוגיים והסדירויות</h2>
          <p className="text-sm md:text-base text-slate-500">
            בחרו בעיקרון להעמקה בחזון, פתרון הפערים שלו, הוויתורים המנהיגותיים, המדדים והתוצרים המעשיים לשטח.
          </p>
        </div>

        {/* High Density Split Grid: Row 1 of 4 principles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {PRINCIPLES_DATA.slice(0, 4).map((p) => {
            const cls = getColorClasses(p.colorName);
            const rawScore = scores[p.id];
            const hasStartedScore = rawScore !== undefined;

            return (
              <div
                key={p.id}
                onClick={() => onSelectPrinciple(p.id)}
                className={`group cursor-pointer glass-card card-hover p-5 rounded-2xl flex flex-col justify-between h-full relative overflow-hidden border-t-4 ${cls.topBorder} ${cls.hoverBorder}`}
              >
                <div className="space-y-3 flex flex-col items-center">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-bold text-slate-400">עיקרון {p.id}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${cls.badge}`}>
                      {hasStartedScore ? `רמה ${rawScore.toFixed(1)}` : 'טרם דורג'}
                    </span>
                  </div>

                  <i className={`${p.icon} text-4xl ${cls.text} my-2 transition-transform duration-200 group-hover:scale-110`}></i>

                  <h3 className="font-extrabold text-base text-slate-900 text-center leading-snug group-hover:text-slate-950 transition-colors">
                    {p.title}
                  </h3>

                  <p className="text-xs text-slate-500 leading-relaxed text-center">
                    {p.shortSummary}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100/60 pt-3 text-[11px] font-semibold text-slate-600">
                  <span className="group-hover:text-amber-600 transition-colors flex items-center gap-1">
                    <span>קריאה אופרטיבית</span>
                    <i className="fa-solid fa-arrow-left-long text-[9px] transform group-hover:-translate-x-1 transition-transform"></i>
                  </span>
                  
                  <span 
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPrinciple(p.id);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-bold ${cls.bg} ${cls.text} hover:opacity-80 transition-opacity`}
                  >
                    אבחון <i className="fa-solid fa-chart-pie mr-0.5 text-[8px]"></i>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* High Density Split Grid: Row 2 of 3 principles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {PRINCIPLES_DATA.slice(4).map((p) => {
            const cls = getColorClasses(p.colorName);
            const rawScore = scores[p.id];
            const hasStartedScore = rawScore !== undefined;

            return (
              <div
                key={p.id}
                onClick={() => onSelectPrinciple(p.id)}
                className={`group cursor-pointer glass-card card-hover p-5 rounded-2xl flex flex-col justify-between h-full relative overflow-hidden border-t-4 ${cls.topBorder} ${cls.hoverBorder}`}
              >
                <div className="space-y-3 flex flex-col items-center">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-bold text-slate-400">עיקרון {p.id}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${cls.badge}`}>
                      {hasStartedScore ? `רמה ${rawScore.toFixed(1)}` : 'טרם דורג'}
                    </span>
                  </div>

                  <i className={`${p.icon} text-4xl ${cls.text} my-2 transition-transform duration-200 group-hover:scale-110`}></i>

                  <h3 className="font-extrabold text-base text-slate-900 text-center leading-snug group-hover:text-slate-950 transition-colors">
                    {p.title}
                  </h3>

                  <p className="text-xs text-slate-500 leading-relaxed text-center">
                    {p.shortSummary}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100/60 pt-3 text-[11px] font-semibold text-slate-600">
                  <span className="group-hover:text-amber-600 transition-colors flex items-center gap-1">
                    <span>קריאה אופרטיבית</span>
                    <i className="fa-solid fa-arrow-left-long text-[9px] transform group-hover:-translate-x-1 transition-transform"></i>
                  </span>
                  
                  <span 
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPrinciple(p.id);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-bold ${cls.bg} ${cls.text} hover:opacity-80 transition-opacity`}
                  >
                    אבחון <i className="fa-solid fa-chart-pie mr-0.5 text-[8px]"></i>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Prominent CTA to Assessment Center */}
      <section className="bg-gradient-to-r from-indigo-50 to-slate-100 rounded-3xl p-8 border border-indigo-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 mt-12">
        <div className="space-y-3 max-w-xl text-center md:text-right">
          <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-full">
            כלי אבחון פערים והרדאר הבית-ספרי
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">השתמש בכלי אבחון הפערים לדרוג וחשיבה על תכנית העבודה.</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            השלם את השאלון המיפויי על בסיס ציר 'מעגל הזהב' (הלמה, האיך, המה). בסיום התהליך תיווצר מפת קורי עכביש תלת-ממדית ייחודית שתאפיין באופן אובייקטיבי את עוגני העוצמה הבית-ספריים ואת יעדי פריצת הדרך שלך.
          </p>
        </div>

        <button
          onClick={onNavigateToDiagnostic}
          className="w-full md:w-auto px-8 py-4.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-98 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer text-base"
        >
          <i className="fa-solid fa-chart-radar text-lg"></i>
          <span>מעבר למתחם האבחון הדיגיטלי ומפת העכביש</span>
        </button>
      </section>
    </div>
  );
};
