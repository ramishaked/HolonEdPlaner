import React from 'react';
import { PRINCIPLES_DATA } from '../data';
import { DiagnosticAnswers } from '../types';
import { PrincipleDetailView } from './PrincipleDetailView';
import { PrincipleMenu, MenuSelection } from './PrincipleMenu';

interface OrientViewProps {
  scores: { [key: number]: number };
  answers: DiagnosticAnswers;
  /** Controlled selection — lifted to App so other zones can deep-link here. */
  selected: MenuSelection;
  onSelect: (id: MenuSelection) => void;
}

/**
 * "היכרות עם העקרונות" — master-detail page.
 * Master: the shared, uniform PrincipleMenu (collapsible side panel).
 * Detail: a single stage that shows the "על הקיט" overview by default and swaps
 * to a principle's content on click. Selection is controlled by App.
 */
export const OrientView: React.FC<OrientViewProps> = ({ scores, answers, selected, onSelect }) => {
  const selectedPrinciple =
    typeof selected === 'number' ? PRINCIPLES_DATA.find((p) => p.id === selected) || null : null;

  return (
    <div className="flex gap-6 items-start" dir="rtl">
      {/* Master — shared principles menu (collapsible side panel) */}
      <PrincipleMenu selected={selected} onSelect={onSelect} scores={scores} answers={answers} />

      {/* Detail — the stage */}
      <main className="flex-1 min-w-0">
        {selectedPrinciple ? (
          <PrincipleDetailView principle={selectedPrinciple} scores={scores} assessed={!!answers[selectedPrinciple.id]} />
        ) : (
          <section className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200">
            <div className="space-y-6 text-right">
              <div className="space-y-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight text-slate-900">
                  הפלנר <span className="text-slate-400 font-medium">(Holon School Educational Planner)</span>
                </h1>
                <p className="text-base md:text-lg text-primary-700 font-semibold leading-relaxed">
                  העוזר החכם שלך לבניית תוכנית העצמה בית ספרית ברוח עקרונות תמונת העתיד והמציאות המשתנה
                </p>
              </div>

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
                      <span className="inline-flex items-center gap-1.5 mr-2 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-400 bg-slate-100/70 border border-slate-200 select-none align-middle">
                        <i className="fa-solid fa-person-chalkboard text-xs"></i>
                        <span>מהלך הסדנא</span>
                        <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">בקרוב</span>
                      </span>
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
