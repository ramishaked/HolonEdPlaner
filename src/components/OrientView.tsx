import React from 'react';
import { usePrinciples } from '../lib/PrinciplesContext';
import { DiagnosticAnswers } from '../types';
import { PrincipleDetailView } from './PrincipleDetailView';
import { PrincipleMenu, MenuSelection } from './PrincipleMenu';
import { Collapsible } from './Collapsible';

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
  const { principles } = usePrinciples();
  const selectedPrinciple =
    typeof selected === 'number' ? principles.find((p) => p.id === selected) || null : null;

  return (
    <div className="flex gap-6 items-start" dir="rtl">
      {/* Master — shared principles menu (collapsible side panel) */}
      <PrincipleMenu selected={selected} onSelect={onSelect} scores={scores} answers={answers} />

      {/* Detail — the stage */}
      <main className="flex-1 min-w-0">
        {selectedPrinciple ? (
          <PrincipleDetailView
            principle={selectedPrinciple}
            scores={scores}
            assessed={!!answers[selectedPrinciple.id]}
            selectedLevel={answers[selectedPrinciple.id]?.selectedMaturityLevel}
          />
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
                      <strong className="text-slate-900">המדריך התיאורטי המורחב לעקרונות:</strong> פירוק מעמיק של עקרונות המינהל. עבור כל עיקרון מוגדרים: ה"לשם מה" (הרציונל והפערים שהוא בא לפתור), ה"איך" (אסטרטגיית היישום, הסדירויות במערכת השעות, הוויתורים הנדרשים והשותפויות באקו-סיסטם העירוני) וה"מה" (התוצרים המצופים מהמורה ומהתלמיד בסוף השנה, לצד הצעד האופרטיבי הראשון ל-1 בספטמבר).
                    </li>
                    <li className="pr-1">
                      <strong className="text-slate-900">ספריית העמקה ומקורות דעת:</strong> ריכוז של קישורים חיים ומנחי ניווט למסמכי המדיניות הרשמיים של משרד החינוך, מחקרי מופ"ת, אוגדני אבני ראשה ומודלים בינלאומיים (OECD), המעניקים תוקף פדגוגי ומחקרי מוצק לתוכניות שלכם.
                    </li>
                    <li className="pr-1">
                      <strong className="text-slate-900">פרוטוקול מהלך הסדנה להנהלה (Plug &amp; Play):</strong> מערך מובנה בן 90 דקות המאפשר לכם להעתיק את חוויית המפגש המשותף שלנו אל תוך חדר הישיבות שלכם, ולרתום את צוות ההנהלה המורחב לחשיבה משותפת. המהלך המלא מפורט בהמשך העמוד.
                    </li>
                    <li className="pr-1">
                      <strong className="text-slate-900">כלי האבחון הדיגיטלי ("רדאר העקרונות"):</strong> שאלון אינטראקטיבי מבוסס מחווני בשלות מפורטים, המייצר עבורכם <strong className="text-primary-700 font-semibold">מפת עכביש דינמית בזמן אמת</strong>, המציגה ויזואלית את נקודות החוזק הבית-ספריות מול אזורי הקריסה הארגוניים.
                    </li>
                  </ol>
                </div>

                {/* The workshop belongs here, in the learning zone: it is how a school
                    ARRIVES at a work plan, not something to read inside the finished
                    document. Collapsed by default so the intro stays scannable. */}
                <div className="pt-2">
                  <Collapsible
                    title="מהלך הסדנה המוסדית — 90 דקות"
                    icon="fa-solid fa-person-chalkboard"
                    className="shadow-sm"
                  >
                    <div className="space-y-5 text-sm leading-relaxed text-slate-600">
                      <p>
                        הסדנה נועדה להפוך את האבחון מטופס שממלאים לבד לשיחה מוסדית. הערך שלה אינו
                        בציון הסופי אלא ב<strong className="text-slate-800">פערי התפיסה שמתגלים בדרך אליו</strong> —
                        הרגע שבו מתברר שסגנית ורכזת שכבה רואות את אותו עיקרון אחרת לגמרי.
                      </p>

                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                          <i className="fa-solid fa-clipboard-check text-primary-600 text-xs"></i>
                          לפני המפגש
                        </h4>
                        <ul className="space-y-1.5 pr-4 list-disc marker:text-primary-400">
                          <li><strong className="text-slate-700">מי בחדר:</strong> צוות ההנהלה המורחב — סגנים, רכזי שכבות, רכזים פדגוגיים והיועצת. 6–12 משתתפים; פחות מכך מצמצם את הפערים שאפשר לגלות, יותר מכך מקשה על דיון.</li>
                          <li><strong className="text-slate-700">מה מביאים:</strong> נתונים אמיתיים מהשטח — משובים, סקרי אקלים, נתוני הישגים. הדירוג אמור להישען על ראיה, לא על תחושה.</li>
                          <li><strong className="text-slate-700">מה קוראים מראש:</strong> את דפי העקרונות במתחם ההיכרות, כדי שזמן המפגש יוקדש לדיון ולא להסבר.</li>
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                          <i className="fa-solid fa-list-ol text-primary-600 text-xs"></i>
                          מהלך המפגש
                        </h4>
                        <ol className="space-y-2.5 pr-4 list-decimal marker:text-primary-500 marker:font-bold">
                          <li className="pr-1">
                            <strong className="text-slate-800">עבודה עצמית ורפלקציה — 15 דק׳.</strong> כל משתתף מדרג
                            לעצמו את רמת הבשלות בכל עיקרון ורושם הנמקה קצרה. בשלב הזה אין דיון ואין הצגה — כדי
                            שהדעה של כל אחד תתגבש לפני שהיא מושפעת מהחדר.
                          </li>
                          <li className="pr-1">
                            <strong className="text-slate-800">הצפת נתונים ודיון בפערים — 45 דק׳. זה לב הסדנה.</strong> מציגים
                            את הדירוגים זה לצד זה. מתעכבים דווקא על העקרונות שבהם הפער בין המשתתפים הוא הגדול ביותר,
                            ומבקשים מכל צד להביא ראיה. מגיעים לדירוג מוסכם — לא בהצבעה, אלא בבירור.
                          </li>
                          <li className="pr-1">
                            <strong className="text-slate-800">שרטוט הרדאר המוסכם — 10 דק׳.</strong> מזינים את הדירוג
                            המוסכם ומקבלים את מפת הבשלות המוסדית. זו התמונה שתלווה את התוכנית כולה.
                          </li>
                          <li className="pr-1">
                            <strong className="text-slate-800">בחירת מוקדי העבודה — 20 דק׳.</strong> על בסיס המפה בוחרים
                            עוגן עוצמה אחד למינוף ושני יעדי פריצת דרך, ומנסחים את הוויתור הארגוני שיפנה להם קשב.
                            בלי ויתור מפורש, יעדי הפריצה נשארים כוונה.
                          </li>
                        </ol>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                          <i className="fa-solid fa-arrow-right-to-bracket text-primary-600 text-xs"></i>
                          אחרי המפגש — מכאן ממשיכים בכלי
                        </h4>
                        <p>
                          מזינים את הדירוג המוסכם ב<strong className="text-slate-800">מתחם האבחון</strong>, בונים את
                          הפעילויות ב<strong className="text-slate-800">מתחם התכנון</strong>, ומפיקים את מסמך תוכנית
                          העבודה ב<strong className="text-slate-800">מתחם ההפקה</strong> — שם גם מאשרים את עוגן העוצמה
                          ויעדי פריצת הדרך שנבחרו בסדנה.
                        </p>
                      </div>

                      <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <strong className="text-slate-700">טיפ:</strong> אם יש רק 45 דקות, ותרו על שלב 4 ולא על שלב 2.
                        אפשר לבחור מוקדי עבודה בישיבה נפרדת, אבל דירוג מוסכם שלא עבר דיון אמיתי לא יחזיק מעמד לאורך השנה.
                      </p>
                    </div>
                  </Collapsible>
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
