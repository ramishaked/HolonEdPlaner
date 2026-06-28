import React, { useState } from 'react';
import { PRINCIPLES_DATA } from '../data';
import { DiagnosticAnswers } from '../types';
import { PrincipleDetailView } from './PrincipleDetailView';

interface OrientViewProps {
  scores: { [key: number]: number };
  answers: DiagnosticAnswers;
}

const SHORT_TITLES: Record<number, string> = {
  1: 'המיומנויות בליבת העשייה',
  2: 'תפקיד המורה כמוביל למידה אנושית',
  3: 'הטמעת AI כתשתית',
  4: 'הטמעת מודל BYOD',
  5: 'חינוך טכנולוגי הוליסטי וספירלי',
  6: 'גיוון במרחבי ובסביבות הלמידה',
  7: 'תרבות מייקרינג',
};

/**
 * "היכרות עם העקרונות" — master-detail page.
 * Right: a persistent principle list (master). Center: a single stage that shows
 * the "על הקיט" overview by default and swaps to a principle's content on click.
 * No cubes, no separate page, no prev/next arrows.
 */
export const OrientView: React.FC<OrientViewProps> = ({ scores, answers }) => {
  const [selected, setSelected] = useState<number | 'intro'>('intro');
  const selectedPrinciple =
    typeof selected === 'number' ? PRINCIPLES_DATA.find((p) => p.id === selected) || null : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" dir="rtl">
      {/* Master — principle list (right side in RTL) */}
      <aside className="lg:col-span-4 lg:sticky lg:top-36 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-1.5">
        <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider px-2 pt-1 pb-1.5">
          שבעת העקרונות הפדגוגיים
        </h3>

        {/* Intro / overview entry */}
        <button
          onClick={() => setSelected('intro')}
          className={`w-full flex items-center gap-2.5 p-3 rounded-xl text-right text-xs font-bold transition-all cursor-pointer ${
            selected === 'intro'
              ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15'
              : 'hover:bg-slate-50 text-slate-700'
          }`}
        >
          <i className={`fa-solid fa-circle-info text-base shrink-0 ${selected === 'intro' ? 'text-white' : 'text-primary-500'}`}></i>
          <span className="flex-1">מבוא · על הקיט</span>
        </button>

        <div className="h-px bg-slate-100 my-1"></div>

        {PRINCIPLES_DATA.map((p) => {
          const isActive = selected === p.id;
          const assessed = !!answers[p.id];
          const score = scores[p.id] ?? 1;
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`group w-full flex flex-col p-3 rounded-xl text-right transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <i
                  className={`${p.icon} text-base shrink-0`}
                  style={{ color: isActive ? '#ffffff' : p.accentColor }}
                ></i>
                <span className="flex-1 text-xs font-bold leading-tight">
                  {SHORT_TITLES[p.id] ?? p.title}
                </span>
                <span
                  className={`text-xs font-mono px-1.5 py-0.5 rounded-full shrink-0 ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : assessed
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  {assessed ? `רמה ${score.toFixed(1)}` : 'טרם דורג'}
                </span>
              </div>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  isActive
                    ? 'max-h-12 mt-1.5'
                    : 'max-h-0 group-hover:max-h-12 group-hover:mt-1.5'
                }`}
              >
                <p className={`text-xs leading-snug pr-7 ${isActive ? 'text-primary-200' : 'text-slate-500'}`}>
                  {p.shortSummary}
                </p>
              </div>
            </button>
          );
        })}
      </aside>

      {/* Detail — the stage */}
      <main className="lg:col-span-8 min-w-0">
        {selectedPrinciple ? (
          <PrincipleDetailView principle={selectedPrinciple} scores={scores} />
        ) : (
          <section className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200">
            <div className="space-y-6 text-right">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight text-slate-900">
                קיט מנהלים — ערכת כלים אינטראקטיבית לכתיבת תכנית עבודה על שבעת העקרונות
              </h1>

              <div className="bg-slate-50 border border-slate-200 p-6 md:p-8 rounded-2xl space-y-6 text-slate-600 text-sm leading-relaxed">
                <div className="space-y-4 text-sm">
                  <p>
                    כתיבת תוכנית עבודה שנתית היא אחד מרגעי המנהיגות המשמעותיים ביותר שלנו לאורך השנה. זוהי נקודת הזמן שבה אנו נדרשים לפרוץ את שגרת הניהול השוטפת, להרים את המבט, ולהפוך חזון פדגוגי למציאות חינוכית מעוצבת היטב בין כותלי בית הספר.
                  </p>
                  <p>
                    ערכת כלים זו (הקיט למנהל) נועדה לשמש עבורכם כבסיס לכתיבת תכנית העבודה ומצע לדיון הנהלה לקראת השנה הקרובה.
                  </p>
                </div>

                <div className="space-y-3 pt-2 text-sm">
                  <h3 className="text-base font-semibold text-primary-700 flex items-center gap-2">
                    <i className="fa-solid fa-users text-sm"></i>
                    איך נוצר הקיט? חוכמת השטח בשותפות מלאה
                  </h3>
                  <p>
                    קיט זה נולד מתוך השטח ובשביל השטח. הערכה שלפניכם היא תולדה של תהליך שיתופי ודיאלוגי שהחל במפגש המנהלים העירוני שלנו.
                  </p>
                  <p>
                    הדיונים המשותפים, הפערים האמיתיים שהצפתם, והתובנות המדויקות שרשמתם על גבי קנבסי העבודה האסטרטגיים – הם אלו שהיוו את חומר הגלם הבלתי מעובד והבסיס האיתן לניסוח מסמך זה. כל סדירות ארגונית, כל הצעה לוויתור מנהיגותי וכל מדד הצלחה (KPI) שתפגשו בקיט, מייצגים את הקול האותנטי שלכם ואת הניסיון המצטבר של מנהיגות החינוך בעיר. זוהי הלכה למעשה העבודה המשותפת שלנו.
                  </p>
                </div>

                <div className="space-y-3 pt-2 text-sm">
                  <h3 className="text-base font-semibold text-primary-700 flex items-center gap-2">
                    <i className="fa-solid fa-toolbox text-sm"></i>
                    מה תוכל למצוא בקיט כמנהל?
                  </h3>
                  <p>
                    כדי להקל על מלאכת התכנון, להוריד את העומס הבירוקרטי ולהפוך את כתיבת התוכנית לתהליך חווייתי וצוותי, הקיט בנוי בצורה מודולרית והוא כולל:
                  </p>
                  <ol className="space-y-3 pr-4 list-decimal marker:text-primary-500 marker:font-bold">
                    <li className="pr-1">
                      <strong className="text-slate-900">המדריך התיאורטי המורחב לשבעת העקרונות:</strong> פירוק מעמיק של שבעת עקרונות המינהל. עבור כל עיקרון מוגדרים: ה"לשם מה" (הרציונל והפערים שהוא בא לפתור), ה"איך" (אסטרטגיית היישום, הסדירויות במערכת השעות, הוויתורים הנדרשים והשותפויות באקו-סיסטם העירוני) וה"מה" (התוצרים המצופים מהמורה ומהתלמיד בסוף השנה, לצד הצעד האופרטיבי הראשון ל-1 בספטמבר).
                    </li>
                    <li className="pr-1">
                      <strong className="text-slate-900">ספריית העמקה ומקורות דעת:</strong> ריכוז של קישורים חיים ומנחי ניווט למסמכי המדיניות הרשמיים של משרד החינוך, מחקרי מופ"ת, אוגדני אבני ראשה ומודלים בינלאומיים (OECD), המעניקים תוקף פדגוגי ומחקרי מוצק לתוכניות שלכם.
                    </li>
                    <li className="pr-1">
                      <strong className="text-slate-900">פרוטוקול מהלך הסדנה להנהלה (Plug &amp; Play):</strong> מערך מובנה בן 90 דקות המאפשר לכם להעתיק את חוויית המפגש המשותף שלנו אל תוך חדר הישיבות שלכם, ולרתום את צוות ההנהלה המורחב לחשיבה משותפת.
                    </li>
                    <li className="pr-1">
                      <strong className="text-slate-900">כלי האבחון הדיגיטלי ("רדאר שבעת העקרונות"):</strong> שאלון אינטראקטיבי מבוסס מחווני בשלות מפורטים, המייצר עבורכם <strong className="text-primary-700 font-semibold">מפת עכביש דינמית בזמן אמת</strong>, המציגה ויזואלית את נקודות החוזק הבית-ספריות מול אזורי הקריסה הארגוניים.
                    </li>
                  </ol>
                </div>

                <div className="pt-4 border-t border-slate-200 text-left font-bold text-slate-700 text-sm leading-normal pl-4">
                  בברכת שותפות ועשייה,<br />
                  <span className="text-primary-700 font-bold text-base">מינהל החינוך</span>
                </div>
              </div>

              <p className="text-xs text-primary-600 font-medium flex items-center gap-2">
                <i className="fa-solid fa-arrow-right"></i>
                בחרו עיקרון מהרשימה כדי להעמיק בו
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
