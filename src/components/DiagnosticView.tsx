import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { PRINCIPLES_DATA, MATURITY_RUBRICS } from '../data';
import { DiagnosticAnswers, ActionPlan, DiagnosticResponse } from '../types';
import { RadarChart } from './RadarChart';

interface DiagnosticViewProps {
  scores: { [key: number]: number };
  answers: DiagnosticAnswers;
  onUpdateAnswer: (principleId: number, fields: Partial<DiagnosticResponse>) => void;
  actionPlan: ActionPlan;
  onUpdateActionPlan: (fields: Partial<ActionPlan>) => void;
  onClearData: () => void;
  aiResult: any;
  onUpdateAiResult: (result: any) => void;
}

export const DiagnosticView: React.FC<DiagnosticViewProps> = ({
  scores,
  answers,
  onUpdateAnswer,
  actionPlan,
  onUpdateActionPlan,
  onClearData,
  aiResult,
  onUpdateAiResult,
}) => {
  const [activeTab, setActiveTab] = useState<number>(1); // Active principle ID for questionnaire
  const [draggedOrHoveredId, setDraggedOrHoveredId] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showWorkshopDetail, setShowWorkshopDetail] = useState(false);

  // AI Strategic wizard state
  const [aiState, setAiState] = useState<'idle' | 'initiating' | 'questions' | 'generating' | 'completed'>(
    aiResult ? 'completed' : 'idle'
  );
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [aiUserAnswers, setAiUserAnswers] = useState<string[]>(['', '', '']);
  const [aiIntro, setAiIntro] = useState<string>('');
  const [aiStrengthId, setAiStrengthId] = useState<number | null>(null);
  const [aiBreakthroughIds, setAiBreakthroughIds] = useState<number[]>([]);
  const [aiError, setAiError] = useState<string>('');
  const [aiAppliedSuccessfully, setAiAppliedSuccessfully] = useState(false);

  const handleAiInitiate = async () => {
    setAiError('');
    setAiState('initiating');
    setAiAppliedSuccessfully(false);
    try {
      const res = await fetch('/api/ai/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scores,
          answers,
          schoolName: actionPlan.schoolName,
          schoolYear: actionPlan.schoolYear
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to initiate AI diagnostic check.');
      }
      const data = await res.json();
      setAiQuestions(data.questions || []);
      setAiIntro(data.introText || '');
      setAiStrengthId(data.strengthId || null);
      setAiBreakthroughIds(data.breakthroughIds || []);
      setAiUserAnswers(new Array((data.questions || []).length).fill(''));
      setAiState('questions');
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'שגיאה בחיבור לבינה המלאכותית. ודא כי סרבר ה-AI פועל בהצלחה.');
      setAiState('idle');
    }
  };

  const handleAiGenerate = async () => {
    setAiError('');
    setAiState('generating');
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scores,
          answers,
          strengthId: aiStrengthId,
          breakthroughIds: aiBreakthroughIds,
          questions: aiQuestions,
          userAnswers: aiUserAnswers,
          schoolName: actionPlan.schoolName,
          schoolYear: actionPlan.schoolYear
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to generate breakthrough strategy.');
      }
      const data = await res.json();
      onUpdateAiResult(data);
      setAiState('completed');
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'שגיאה ביצירת הדו"ח מבוסס AI. אנא נסה שנית.');
      setAiState('questions');
    }
  };

  const handleApplyAiRecommendations = () => {
    if (!aiResult) return;
    const { autoFill } = aiResult;
    onUpdateActionPlan({
      strengths: aiStrengthId ? [aiStrengthId] : actionPlan.strengths,
      breakthroughs: aiBreakthroughIds.length > 0 ? aiBreakthroughIds : actionPlan.breakthroughs,
      strengthReason: autoFill.strengthReason,
      breakthroughReason1: autoFill.breakthroughReason1,
      breakthroughReason2: autoFill.breakthroughReason2,
      organizationalSacrifice: autoFill.organizationalSacrifice
    });
    setAiAppliedSuccessfully(true);
    // Auto-scroll down to the form
    setTimeout(() => {
      const el = document.getElementById('action-plan-form');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 200);
  };

  // Auto calculate recommended strengths and breakthroughs based on scores
  useEffect(() => {
    const scoreList = Object.entries(scores).map(([id, score]) => ({
      id: parseInt(id),
      score: score as number,
    }));
    
    if (scoreList.length > 0) {
      // Sort scores
      const sorted = [...scoreList].sort((a, b) => b.score - a.score);
      const topId = sorted[0]?.id;
      // Get bottom two
      const bottom = [...scoreList].sort((a, b) => a.score - b.score);
      const bot1 = bottom[0]?.id;
      const bot2 = bottom[1]?.id;

      // Only auto-initialize if currently empty to avoid overwriting manual adjustments
      if (actionPlan.strengths.length === 0 && topId) {
        onUpdateActionPlan({ strengths: [topId] });
      }
      if (actionPlan.breakthroughs.length === 0 && bot1 && bot2) {
        onUpdateActionPlan({ breakthroughs: [bot1, bot2] });
      }
    }
  }, [scores]);

  const currentPrinciple = PRINCIPLES_DATA.find((p) => p.id === activeTab) || PRINCIPLES_DATA[0];
  const activeRubrics = MATURITY_RUBRICS.find((r) => r.id === activeTab)?.levels || [];
  const activeAnswer = answers[activeTab] || {
    whyScore: 1,
    howScore: 1,
    whatScore: 1,
    selectedMaturityLevel: 1,
    evidence: "",
  };

  const getMaturityColor = (level: number) => {
    switch (level) {
      case 1: return 'border-red-200 bg-red-50 text-red-800';
      case 2: return 'border-amber-200 bg-amber-50 text-amber-800';
      case 3: return 'border-blue-200 bg-blue-50 text-blue-800';
      case 4: return 'border-indigo-200 bg-indigo-50 text-indigo-800';
      default: return 'border-slate-200 bg-slate-50 text-slate-800';
    }
  };

  // Printing trigger
  const handlePrint = () => {
    window.print();
  };

  const completedCount = Object.keys(answers).length;

  const [workshopTab, setWorkshopTab] = useState<'rubrics' | 'protocol'>('rubrics');
  const [selectedWorkshopPrinciple, setSelectedWorkshopPrinciple] = useState<number>(1);

  const workshopPrinciples = [
    {
      id: 1,
      title: "עיקרון 1: הטמעת AI כתשתית אינטגרטיבית ועמוקה",
      desc: "הטמעת AI כחלק אינטגרלי מהפדגוגיה והניהול הבית-ספרי.",
      levels: [
        { level: 1, name: "רמה 1 – ראשוני (\"ניצוצות\")", desc: "מורים בודדים \"משוגעים לדבר\" משתמשים בכלי AI באופן עצמאי. אין מדיניות או שגרת עבודה ניהולית, וקיימת רמת רתיעה או חרדה מסוימת בקרב חלקים מהצוות." },
        { level: 2, name: "רמה 2 – מתפתח (\"איים של חדשנות\")", desc: "הנהלת בית הספר עושה שימוש ראשוני בכלי AI לצרכים ניהוליים. בוצעה השתלמות חשיפה מוסדית לצוות המורים, אך השימוש הפדגוגי עדיין אקראי ולא מחייב." },
        { level: 3, name: "רמה 3 – מוטמע (\"שגרה מוסדית\")", desc: "ה-AI משולב באופן קבוע בשגרות הניהול וכתיבת התוכן של ההנהלה. מוגדר עוגן קבוע במערכת (במליאות או בקל\"מ) להתנסות ב-AI. מורים משתמשים בכלי באופן קבוע לבניית מערכי שיעור מבודלים ומשימות הערכה." },
        { level: 4, name: "רמה 4 – חלוצי (\"חזון מלא\")", desc: "ה-AI מהווה תשתית עמוקה ואינטגרלית לכלל התהליכים בארגון. הוכח מחקרית וארגונית כי השימוש ב-AI פינה למורים זמן אפקטיבי המוקדש כעת לשיחות אישיות ולמפגש אנושי פרטני עם התלמידים. התלמידים משתמשים ב-AI כסביבת עבודה מבוקרת לחקר עצמאי." }
      ]
    },
    {
      id: 2,
      title: "עיקרון 2: חינוך טכנולוגי הוליסטי וספירלי",
      desc: "בניית רצף מיומנויות דיגיטליות וטכנולוגיות לאורך שכבות הגיל.",
      levels: [
        { level: 1, name: "רמה 1 – ראשוני (\"ניצוצות\")", desc: "אוריינות דיגיטלית וטכנולוגית נלמדת באופן מבודד ומנותק אך ורק בשיעורי מחשבים/תקשוב ייעודיים. בשיעורים אחרים הלמידה נשארת מסורתית (מחברת וספר)." },
        { level: 2, name: "רמה 2 – מתפתח (\"איים של חדשנות\")", desc: "שילוב כלים דיגיטליים מתבצע במספר מקצועות לימוד (בעיקר מדעים), אך ללא סנכרון רב-תחומי או תוכנית עבודה רציפה. אין הגדרה ברורה של רצף מיומנויות בין שכבות הגיל." },
        { level: 3, name: "רמה 3 – מוטמע (\"שגרה מוסדית\")", desc: "קיימת \"מפת מיומנויות דיגיטליות ספירלית\" בית-ספרית המגדירה יעדים לכל שכבת גיל. רכז התקשוב מקיים ישיבות עבודה חודשיות מובנות עם רכזי המקצועות (שפה, הומניסטיקה, מדעים) לשזירת הטכנולוגיה בתוכניות הלימודים השוטפות." },
        { level: 4, name: "רמה 4 – חלוצי (\"חזון מלא\")", desc: "הטכנולוגיה היא שפה טבעית וכלי עבודה קבוע בכל תחומי הדעת. הערכת התלמיד מבוססת על \"תיק עבודות דיגיטלי\" (E-Portfolio) רב-תחומי המלווה אותו בין השכבות, ומציג פיתוח חשיבה אלגוריתמית, חקר ויצירה." }
      ]
    },
    {
      id: 3,
      title: "עיקרון 3: תרבות מייקרינג וניצול משאבים עירוניים",
      desc: "למידה התנסותית פיזית ושימוש במרכזי חדשנות עירוניים.",
      levels: [
        { level: 1, name: "רמה 1 – ראשוני (\"ניצוצות\")", desc: "תלמידי בית הספר יוצאים לסיור או פעילות העשרה חד-פעמית במרכזי החדשנות העירוניים (\"אתחלא\" / \"בית רותר\"). הפעילות מהנה אך מנותקת לחלוטין מתוכנית הלימודים ומליבת העשייה הבית-ספרית." },
        { level: 2, name: "רמה 2 – מתפתח (\"איים של חדשנות\")", desc: "מספר מצומצם של כיתות או מורים מובילים פרויקט למידה מבוסס פרויקטים (PBL) בשיתוף המרכזים העירוניים. האתגר הלוגיסטי (הסעות, התאמת מערכת) עדיין מנוהל באופן נקודתי ומקשה על הרחבת הפעילות." },
        { level: 3, name: "רמה 3 – מוטמע (\"שגרה מוסדית\")", desc: "שיבוץ מובנה וקבוע של \"בלוקים\" ארוכים במערכת השעות עבור שכבות גיל מוגדרות, שבהם הלמידה מועתקת פיזית ובאופן שבועי/דו-שבועי ל\"אתחלא\" או \"בית רותר\". נעשה ויתור מודע על שעות פרונטליות בכיתה לטובת עבודה על פרויקטים מובנים במרכזים." },
        { level: 4, name: "רמה 4 – חלוצי (\"חזון מלא\")", desc: "בית הספר פועל באקו-סיסטם קהילתי-עירוני מלא. תלמידים מתכננים ומייצרים במרכזים העירוניים תוצרים פיזיים וטכנולוגיים עובדים הנותנים מענה לאתגרים ובעיות אמיתיות בעיר, והתוצרים מוצגים בתערוכות רשמיות וזוכים להערכה חלופית רחבה." }
      ]
    },
    {
      id: 4,
      title: "עיקרון 4: הטמעת מודל BYOD (Bring Your Own Device)",
      desc: "שילוב בטוח ואפקטיבי של המכשירים האישיים של התלמידים בלמידה.",
      levels: [
        { level: 1, name: "רמה 1 – ראשוני (\"ניצוצות\")", desc: "המכשירים האישיים של התלמידים נתפסים כאויב או כמטרד מרכזי בכיתה המייצר בעיות משמעת ומוסחות. המדיניות היא הגנתית (\"החרמה\" או \"בתיקים בלבד\") ללא כל שימוש פדגוגי." },
        { level: 2, name: "רמה 2 – מתפתח (\"איים של חדשנות\")", desc: "מורים בודדים מאפשרים לתלמידים להוציא מכשירים לטובת משימה נקודתית (כמו מענה על חידון Kahoot בסוף שיעור). אין אמנה בית-ספרית מוסדרת, ותשתית ה-WIFI אינה יציבה." },
        { level: 3, name: "רמה 3 – מוטמע (\"שגרה מוסדית\")", desc: "קיימת \"אמנת BYOD\" בית-ספרית פעילה שנכתבה בשותפות עם ההורים והתלמידים. בכיתות מיושמים \"חוקי רמזור\" מוסכמים לניהול המכשירים. השימוש במכשיר הוא חלק מובנה מהשיעור לצורך עבודה שיתופית, חקר וסקרים בזמן אמת. התשתית הבית-ספרית תומכת וערוכה לכך." },
        { level: 4, name: "רמה 4 – חלוצי (\"חזון מלא\")", desc: "המכשיר האישי הוא פלטפורמת למידה טבעית ואישית (Anywhere, Anytime Learning). התלמידים מנהלים את עצמם באחריות ובאופן אתי (אזרחות דיגיטלית). אירועי המשמעת סביב המכשירים אפסיים. קיים מנגנון השאלה עירוני מובנה המונע לחלוטין פערים חברתיים או חומריים בכיתה." }
      ]
    },
    {
      id: 5,
      title: "עיקרון 5: המיומנויות בליבת העשייה",
      desc: "מעבר מהספק של חומר לתרגול מעשי והערכה של מיומנויות לחיים.",
      levels: [
        { level: 1, name: "רמה 1 – ראשוני (\"ניצוצות\")", desc: "העשייה הבית-ספרית ממוקדת כמעט בלעדית בהספק חומר תיאורטי ובשינון לקראת מבחנים מסורתיים. אין עיסוק מתוכנן במיומנויות." },
        { level: 2, name: "רמה 2 – מתפתח (\"איים של חדשנות\")", desc: "מורים מצהירים על שילוב מיומנויות (כמו עבודת צוות או חשיבה ביקורתית) בתוכניות הלימודים, אך בפועל אין לכך ביטוי במערכי השיעור ואין כלי הערכה או מחוונים ספציפיים המודדים זאת." },
        { level: 3, name: "רמה 3 – מוטמע (\"שגרה מוסדית\")", desc: "כל מערך שיעור בית-ספרי כולל הגדרה מפורשת של \"מיומנות יעד\" ותרגול אקטיבי שלה בתוך התוכן הלימודי. נעשה צמצום מודע של חומר תיאורטי לטובת עומק פדגוגי. המיומנויות מוערכות באופן רשמי ומשולבות בתוך תעודת מחצית של בית הספר." },
        { level: 4, name: "רמה 4 – חלוצי (\"חזון מלא\")", desc: "בית הספר פועל במודל של למידה והערכה מבוססות ביצועים (Performance-based) לחלוטין. התלמידים מסוגלים לבצע רפלקציה עצמית מורכבת על רמת המיומנויות שלהם ומציגים \"מפת התפתחות אישית\" המעידה על מוכנות גבוהה לאתגרי החיים האמיתיים." }
      ]
    },
    {
      id: 6,
      title: "עיקרון 6: גיוון במרחבי ובסביבות הלמידה",
      desc: "הסבת מרחבים מגוונים ומנח שעות מבוזר ללמידה היברידית.",
      levels: [
        { level: 1, name: "רמה 1 – ראשוני (\"ניצוצות\")", desc: "הלמידה מתרחשת אך ורק בתוך כיתת האם המסורתית, המאורגנת בשורות קבועות מול הלוח והמורה." },
        { level: 2, name: "רמה 2 – מתפתח (\"איים של חדשנות\")", desc: "בית הספר מחזיק ב\"מרחב עתידני\" או \"כיתת חדשנות\" מעוצבת, אך ההגעה אליה היא אירוע נדיר או חגיגי. בשאר הזמן לומדים כרגיל. קיימת סביבה דיגיטלית (LMS) אך היא משמשת רק כלוח מודעות סטטי." },
        { level: 3, name: "רמה 3 – מוטמע (\"שגרה מוסדית\")", desc: "בית הספר מנהל \"מערכת שעות של מרחבים\". מסדרונות, מבואות, חצרות וספריות הוסבו למרחבים גמישים (Flex Spaces) המאפשרים למידה עצמאית או שיתופית במקביל. הסביבה הדיגיטלית הבית-ספרית פעילה, אחידה ומייצרת רצף למידה היברידי מעבר לשעות השהות הפיזיות." },
        { level: 4, name: "רמה 4 – חלוצי (\"חזון מלא\")", desc: "המרחב הפיזי והדיגיטלי מותאם לחלוטין ובאופן דינמי לשונות של הלומדים ולצרכים הפדגוגיים המשתנים בקליק אחד. המורה מנהל כיתה מבוזרת ונע בטבעיות באקו-סיסטם היברידי עשיר ותומך למידה עצמאית עמוקה." }
      ]
    },
    {
      id: 7,
      title: "עיקרון 7: שינוי תפקיד המורה למוביל למידה אנושית",
      desc: "תפקיד מלווה, פיתוח חוסן, שיחות אישיות ודיאלוג חם.",
      levels: [
        { level: 1, name: "רמה 1 – ראשוני (\"ניצוצות\")", desc: "המורה נתפס ומפקד כ\"צינור להעברת מידע\" בלבד (הוראה פרונטלית דומיננטית). השיח המרכזי בין מורים לתלמידים סובב סביב ציונים, הישגים יבשים ובעיות משמעת." },
        { level: 2, name: "רמה 2 – מתפתח (\"איים של חדשנות\")", desc: "מורים מנסים לשלב שגרות של למידה רגשית-חברתית (SEL) ושיח רגשי, אך הדבר נעשה באופן אקראי (למשל, רק בשיעורי חינוך או ימי שישי) ואין לכך גיבוי או פינוי זמן מובנה במערכת השעות הכללית." },
        { level: 3, name: "רמה 3 – מוטמע (\"שגרה מוסדית\")", desc: "מוגדרים חלונות זמן קבועים, מוגנים ובלתי-ניתנים לביטול במערכת השעות לטובת שיחות אישיות (מנטורינג) וקבוצות שיח מונחות. זמן ההרצאה הפרונטלית של המורה מוגבל ניהולית לעד 15 פירורים בפתיחת השיעור, והשאר מוקדש לדיאלוג והנחיה. פועלת קהילת למידה מקצועית (קל\"מ) מוסדית לעיבוד התפקיד האנושי." },
        { level: 4, name: "רמה 4 – חלוצי (\"חזון מלא\")", desc: "המורה מתפקד כמנטור ומנחה מובהק המפתח חוסן, חשיבה ביקורתית ומצפן ערכי אצל הלומד. הקשר הבין-אישי הקרוב והחם הוא המנוע והתשתית לכל הלמידה הבית-ספרית. 100% מהתלמידים מדווחים בשאלונים על קיומו של \"מבוגר משמעותי\" שרואה ומלווה אותם באמת." }
      ]
    }
  ];

  if (showWorkshopDetail) {
    const selectedPrin = workshopPrinciples.find(p => p.id === selectedWorkshopPrinciple) || workshopPrinciples[0];
    return (
      <div className="space-y-8 animate-fade-in text-right" dir="rtl">
        {/* Header Breadcrumb / Control Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-indigo-650 bg-indigo-50 px-2.5 py-1 rounded-full">סדנאות ומחוונים</span>
            <h2 className="text-xl font-black text-slate-900">פרוטוקול הסדנה והמחוון האופרטיבי המלא</h2>
            <p className="text-xs text-slate-500 font-light">
              עיינו ברמות הבשלות של שבעת העקרונות או קראו את פרוטוקול ההפעלה המודולרי להנהלה.
            </p>
          </div>
          
          <button
            onClick={() => setShowWorkshopDetail(false)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/40 rounded-xl transition-all cursor-pointer shadow-sm ml-auto md:ml-0"
          >
            <i className="fa-solid fa-arrow-right"></i>
            <span>חזרה לאבחון ומפת העכביש</span>
          </button>
        </div>

        {/* Big Switch Tabs */}
        <div className="flex border-b border-slate-200 gap-6">
          <button
            onClick={() => setWorkshopTab('rubrics')}
            className={`pb-3.5 text-sm font-black transition-all border-b-2 px-2 cursor-pointer ${
              workshopTab === 'rubrics' 
                ? 'text-indigo-600 border-indigo-600 font-bold' 
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            <i className="fa-solid fa-list-check ml-1.5"></i>
            <span>1. מחוון רמות הבשלות המלא (7 העקרונות)</span>
          </button>
          
          <button
            onClick={() => setWorkshopTab('protocol')}
            className={`pb-3.5 text-sm font-black transition-all border-b-2 px-2 cursor-pointer ${
              workshopTab === 'protocol' 
                ? 'text-indigo-600 border-indigo-600 font-bold' 
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            <i className="fa-solid fa-business-time ml-1.5"></i>
            <span>2. מהלך הסדנה ופרוטוקול הפעלה (90 דקות)</span>
          </button>
        </div>

        {/* Content switch */}
        {workshopTab === 'rubrics' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Sidebar Principles Menu */}
            <div className="lg:col-span-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
              <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider mb-2 pr-2">שבעת העקרונות הבית-ספריים:</h3>
              <div className="space-y-1">
                {workshopPrinciples.map((p) => {
                  const isCur = p.id === selectedWorkshopPrinciple;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedWorkshopPrinciple(p.id)}
                      className={`w-full p-3 rounded-xl text-right text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                        isCur 
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15' 
                          : 'bg-slate-50/50 hover:bg-slate-100 text-slate-705 border border-transparent'
                      }`}
                    >
                      <span className="line-clamp-1">{p.title}</span>
                      <i className={`fa-solid ${isCur ? 'fa-circle-dot text-indigo-200' : 'fa-circle text-slate-300'} text-[10px] shrink-0 mr-2`}></i>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Principle Content Details */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                <span className="text-[10px] font-bold text-indigo-650 bg-indigo-50 px-2.5 py-1 rounded-full uppercase">עיקרון ניתוח בשלות</span>
                <h3 className="text-lg font-black text-slate-900 mt-2">{selectedPrin.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-light">{selectedPrin.desc}</p>
                <div className="pt-3 border-t border-slate-100/70 mt-4">
                  <p className="text-xs text-slate-600 leading-relaxed italic">
                    המחוון להלן מפרק כל עיקרון לארבע רמות בשלות אופרטיביות. רמות אלו בוחנות את שלושת הצירים שלכם: הלשם מה (תרבות ותפיסה), האיך (סדירויות ומשאבים) והמה (תוצרים ומדידה).
                  </p>
                </div>
              </div>

              {/* 4 Levels Grid/Stack */}
              <div className="space-y-3.5">
                {selectedPrin.levels.map((lvl) => {
                  const getLvlStyles = (l: number) => {
                    switch (l) {
                      case 1: return { border: 'border-rose-100 border-r-4 border-r-rose-500 bg-rose-50/10', text: 'text-rose-900', p: '🌱 ראשוני ("ניצוצות")', label: 'bg-rose-100 text-rose-700' };
                      case 2: return { border: 'border-amber-100 border-r-4 border-r-amber-500 bg-amber-50/10', text: 'text-amber-900', p: '🏝️ מתפתח ("איים של חדשנות")', label: 'bg-amber-100 text-amber-700' };
                      case 3: return { border: 'border-blue-100 border-r-4 border-r-blue-500 bg-blue-50/10', text: 'text-blue-900', p: '🔄 מוטמע ("שגרה מוסדית")', label: 'bg-blue-100 text-blue-700' };
                      case 4: return { border: 'border-indigo-100 border-r-4 border-r-indigo-550 bg-indigo-50/10', text: 'text-indigo-900', p: '🚀 חלוצי ("חזון מלא")', label: 'bg-indigo-100 text-indigo-700' };
                      default: return { border: 'border-slate-100 border-r-4 border-r-slate-500 bg-slate-50/10', text: 'text-slate-900', p: 'רמה אופרטיבית', label: 'bg-slate-100 text-slate-700' };
                    }
                  };
                  const styles = getLvlStyles(lvl.level);
                  return (
                    <div key={lvl.level} className={`p-5 rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow duration-200 ${styles.border} space-y-3 text-right`}>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                          <span className={`w-5.5 h-5.5 rounded-full text-[10px] font-mono font-black text-white flex items-center justify-center bg-slate-800`}>
                            {lvl.level}
                          </span>
                          <span>{lvl.name}</span>
                        </span>
                        
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${styles.label}`}>
                          {styles.p}
                        </span>
                      </div>
                      <p className="text-xs text-slate-650 leading-relaxed pr-7 font-light">{lvl.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        ) : (
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm space-y-8 max-w-4xl mx-auto">
            
            {/* Intro */}
            <div className="space-y-2 text-right border-b border-slate-100 pb-5">
              <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2.5 py-1 rounded-full">מנהלת בית הספר והצוותים</span>
              <h3 className="text-xl font-black text-slate-900 mt-2">פרוטוקול הפעלה מלא להנהלת בית הספר (סדנה בת 90 דקות)</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-light">
                סדנה מובנית זו מאפשרת לצוות ההנהלה והמורים להציף הבדלי תפיסה ופערים, לגבש דירוג בשלות מוסכם, ולבנות תכנית אופרטיבית לאחד בספטמבר.
              </p>
            </div>

            {/* Stepper Steps */}
            <div className="relative border-r border-indigo-100 pr-8 mr-4 space-y-10 text-right">
              
              {/* Step 1 */}
              <div className="relative space-y-3">
                {/* Step dot */}
                <div className="absolute -right-[41px] top-1 w-6 h-6 rounded-full bg-white border-4 border-indigo-650 flex items-center justify-center shrink-0 shadow-sm"></div>
                
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono font-black text-white bg-indigo-600 px-2.5 py-0.5 rounded-md shadow-sm">
                    15 דק׳
                  </span>
                  <h4 className="font-extrabold text-sm text-slate-900">שלב א&apos;: עבודה עצמית ורפלקציה</h4>
                </div>
                
                <p className="text-xs text-slate-600 leading-relaxed font-light max-w-3xl pr-2">
                  כל חבר הנהלה (מנהל, סגנים, רכזים פדגוגיים, רכז תקשוב, יועצת) מקבל את השאלון ומסמן באופן עצמאי, ללא התייעצות, את רמת הבשלות (1-4) שהוא מייחס לבית הספר עבור כל אחד משבעת העקרונות.
                </p>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-[11px] text-slate-650 max-w-2xl mt-1.5 flex gap-2 items-start shadow-sm pr-4">
                  <i className="fa-solid fa-lightbulb text-amber-500 mt-0.5 shrink-0"></i>
                  <span><strong>דגש מרכזי:</strong> ליד כל סימון, חבר הצוות כותב בקצרה פתק מעשי המהווה <strong>הנמקה והוכחה מהשטח</strong> (למה סימנתי רמה זו?).</span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative space-y-3 text-right">
                {/* Step dot */}
                <div className="absolute -right-[41px] top-1 w-6 h-6 rounded-full bg-white border-4 border-indigo-650 flex items-center justify-center shrink-0 shadow-sm"></div>
                
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono font-black text-white bg-indigo-600 px-2.5 py-0.5 rounded-md shadow-sm">
                    45 דק׳
                  </span>
                  <h4 className="font-extrabold text-sm text-slate-900">שלב ב&apos;: הצפת הנתונים ודיון בפערים - <span className="text-indigo-600 font-black">לב הסדנה</span></h4>
                </div>
                
                <p className="text-xs text-slate-600 leading-relaxed font-light max-w-3xl pr-2">
                  המנהל משרטט על לוח חדר הישיבות את ה&quot;רדאר&quot; הריק (עיגול המחולק ל-7 גזרות). כל חבר צוות תולה פתקית (Post-it) עם הציון שלו בגזרה המתאימה. 
                  מנהלים דיון ממוקד סביב פערים.
                </p>
                <div className="bg-indigo-50/30 p-3.5 rounded-xl border border-indigo-100 text-[11px] text-indigo-950 max-w-2xl mt-1.5 flex gap-2.5 items-start shadow-sm pr-4">
                  <i className="fa-solid fa-circle-info text-indigo-550 mt-0.5 shrink-0"></i>
                  <span><strong>דוגמה לדיון בפערים:</strong> אם רכז התקשוב סימן את עיקרון 4 (BYOD) ברמה 3, אך היועצת או סגנית המנהל סימנו ברמה 1 – מבינים היכן הנתק בין התשתית הטכנולוגית לבין השטח האנושי. הדיון נועד להגיע להסכמה וציון משותף ומאוזן.</span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative space-y-3 text-right">
                {/* Step dot */}
                <div className="absolute -right-[41px] top-1 w-6 h-6 rounded-full bg-white border-4 border-indigo-650 flex items-center justify-center shrink-0 shadow-sm"></div>
                
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono font-black text-white bg-indigo-600 px-2.5 py-0.5 rounded-md shadow-sm">
                    10 דק׳
                  </span>
                  <h4 className="font-extrabold text-sm text-slate-900">שלב ג&apos;: שרטוט הרדאר הבית-ספרי הסופי</h4>
                </div>
                
                <p className="text-xs text-slate-600 leading-relaxed font-light max-w-3xl pr-2">
                  מחברים את הציון המוסכם של כל 7 העקרונות ומותחים קו ביניהם. מתקבלת צורה ויזואלית ברורה (&quot;הרדאר הבית-ספרי&quot;).
                </p>
                <div className="bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-100 text-[11px] text-emerald-900 max-w-2xl mt-1.5 flex gap-2.5 items-start shadow-sm pr-4">
                  <i className="fa-solid fa-circle-check text-emerald-555 mt-0.5 shrink-0"></i>
                  <span><strong>מה הצורה תחשוף?</strong> הצורה תחשוף מיד קריסה פנימה (פערים עמוקים המהווים יעדי פריצת דרך) או פריצה החוצה (עוגני עוצמה בית-ספריים).</span>
                </div>
              </div>

            </div>

            {/* Print Note */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-bold text-slate-650 mt-8 shadow-inner">
              <span>ניתן להדפיס או לייצא פרוטוקול זה כחלק מההדפסה הכללית.</span>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg text-[10px] shadow-sm transition-colors cursor-pointer"
              >
                ייצוא והדפסה מלאה
              </button>
            </div>
            
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      
      {/* Custom Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 select-none animate-fade-in" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 p-6 space-y-6 text-right animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 text-xl shrink-0">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900">איפוס נתוני אבחון</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  ברגע שתמשיך ותלחץ כן, נתוני האבחון יאפסו- להמשיך?
                </p>
              </div>
            </div>
            
            <div className="flex gap-2.5 justify-end pt-2">
              <button
                onClick={() => {
                  onClearData();
                  setShowResetConfirm(false);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-rose-600/10 cursor-pointer"
              >
                כן
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                לא
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Intro section */}
      <div className="glass-card rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-right">
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">סדנה וקנבס אבחון ומפת עכביש</span>
          <h2 className="text-2xl font-black text-[#0f172a] tracking-tight font-sans">תהליך מיפוי הבשלות ומפת העכביש המלאה</h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
            קיימו סדנת הנהלה בת 90 דקות שבה כל חבר צוות מאפיין לבד את רמות הבשלות, ולאחר מכן דינו בפערים כדי לקבוע את המיון המוסכם. בסיום, השתמשו בתוצרים כדי לגזור מטרות ופעולות מדויקות לאחד בספטמבר.
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-4 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-lg transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-trash-can mr-1"></i> איפוס נתוני אבחון
          </button>
          
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg border border-blue-600 transition-colors shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <i className="fa-solid fa-print"></i> ייצוא והדפסה
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Interactive / Radar Widget Column (4/12 width) */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-4">
          
          <RadarChart
            scores={scores}
            activeId={draggedOrHoveredId || activeTab}
            onHoverPrinciple={(id) => setDraggedOrHoveredId(id)}
            onSelectPrinciple={(id) => setActiveTab(id)}
          />

          {/* Quick Score Summary Panel */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
            <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider text-right">סיכום רמות בשלות נוכחיות:</h4>
            
            <div className="space-y-2.5">
              {PRINCIPLES_DATA.map((p) => {
                const score = scores[p.id] || 1;
                const active = p.id === activeTab;
                return (
                  <div
                    key={p.id}
                    onClick={() => setActiveTab(p.id)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                      active ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50/50 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 font-mono w-4">#{p.id}</span>
                      <span className={`text-xs font-bold ${active ? 'text-indigo-900' : 'text-slate-700'}`}>{p.title}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Color indicator tag */}
                      <span className={`w-2.5 h-2.5 rounded-full ${p.colorName === 'purple' ? 'bg-purple-500' : p.colorName === 'blue' ? 'bg-blue-500' : p.colorName === 'orange' ? 'bg-orange-500' : p.colorName === 'cyan' ? 'bg-cyan-500' : p.colorName === 'emerald' ? 'bg-emerald-500' : p.colorName === 'indigo' ? 'bg-indigo-500' : 'bg-rose-500'}`}></span>
                      <span className="text-xs font-mono font-black text-slate-800 bg-white border border-slate-100 px-2 py-0.5 rounded shadow-sm">
                        {score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Questionnaire Column (7/12 width) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Active indicator index */}
          <div className="glass-card rounded-2xl overflow-hidden text-right">
            
            {/* Header Tabs switcher */}
            <div className="flex overflow-x-auto border-b border-slate-200/60 scrollbar-none scroll-smooth bg-slate-50/50">
              {PRINCIPLES_DATA.map((p) => {
                const isActive = p.id === activeTab;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActiveTab(p.id)}
                    className={`px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all shrink-0 cursor-pointer ${
                      isActive 
                        ? 'text-blue-600 border-blue-600 bg-blue-50/30' 
                        : 'text-slate-500 border-transparent hover:text-slate-800'
                    }`}
                  >
                    עיקרון {p.id}
                  </button>
                );
              })}
            </div>

            <div className="p-6 space-y-6">
              
              {/* Active title and quick rationale snippet */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-blue-500">אבחון ומיפוי שוטף</span>
                <h3 className="text-lg md:text-xl font-black text-[#0f172a]">{currentPrinciple.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-light">{currentPrinciple.shortSummary}</p>
              </div>

              {/* Step 1: Maturity Levels Selection Matrix */}
              <div className="space-y-4">
                <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold inline-flex items-center justify-center">א</span>
                  <span>בחר את רמת הבשלות המאפיינת את בית ספרך כיום:</span>
                </h4>

                <div className="grid grid-cols-1 gap-2.5">
                  {activeRubrics.map((rubric) => {
                    const isSelected = activeAnswer.selectedMaturityLevel === rubric.level;
                    return (
                      <div
                        key={rubric.level}
                        onClick={() => onUpdateAnswer(activeTab, { selectedMaturityLevel: rubric.level })}
                        className={`p-3.5 rounded-xl border border-r-4 text-right cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-blue-600 bg-blue-50/20 border-r-blue-600 shadow-sm' 
                            : 'border-slate-200/60 bg-white/70 hover:bg-slate-50 border-r-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            <span className={`w-4 h-4 rounded-full text-[9px] font-black text-white flex items-center justify-center ${
                              rubric.level === 4 ? 'bg-blue-600' : 'bg-slate-400'
                            }`}>
                              {rubric.level}
                            </span>
                            <span>{rubric.name}</span>
                          </span>

                          {isSelected && (
                            <span className="text-[10px] bg-blue-600 text-white font-black px-2 py-0.5 rounded-full">
                              מצב נוכחי מוסכם
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed pr-5">{rubric.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Rating 3 axes based on Golden Circle */}
              <div className="space-y-4 pt-4 border-t border-slate-50">
                <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1">
                  <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold inline-flex items-center justify-center">ב</span>
                  <span>דרג את שלושת צירי &quot;מעגל הזהב&quot; (מ-1 עד 4):</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Axis 1: Culture (Why) */}
                  <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-100 space-y-3">
                    <div>
                      <span className="block text-[10px] font-bold text-indigo-700">ציר התרבות (הלמה)</span>
                      <span className="text-[10px] text-slate-400">האם יש הבנה והזדהות עם המטרה?</span>
                    </div>

                    <div className="flex items-center gap-1.5 justify-center">
                      {[1, 2, 3, 4].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => onUpdateAnswer(activeTab, { whyScore: num })}
                          className={`w-7 h-7 rounded text-xs font-mono font-bold transition-all ${
                            activeAnswer.whyScore === num 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Axis 2: Routines (How) */}
                  <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-100 space-y-3">
                    <div>
                      <span className="block text-[10px] font-bold text-indigo-700">ציר הסדירויות (האיך)</span>
                      <span className="text-[10px] text-slate-400">יש עוגנים מובנים במערכת השעות?</span>
                    </div>

                    <div className="flex items-center gap-1.5 justify-center">
                      {[1, 2, 3, 4].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => onUpdateAnswer(activeTab, { howScore: num })}
                          className={`w-7 h-7 rounded text-xs font-mono font-bold transition-all ${
                            activeAnswer.howScore === num 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Axis 3: Outputs (What) */}
                  <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-100 space-y-3">
                    <div>
                      <span className="block text-[10px] font-bold text-indigo-700">ציר התוצרים (המה)</span>
                      <span className="text-[10px] text-slate-400">תוצרים מדידים של מורה ותלמיד?</span>
                    </div>

                    <div className="flex items-center gap-1.5 justify-center">
                      {[1, 2, 3, 4].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => onUpdateAnswer(activeTab, { whatScore: num })}
                          className={`w-7 h-7 rounded text-xs font-mono font-bold transition-all ${
                            activeAnswer.whatScore === num 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* Step 3: Evidence documentation */}
              <div className="space-y-2 pt-4 border-t border-slate-50">
                <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1">
                  <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold inline-flex items-center justify-center">ג</span>
                  <span>הנמקה, הוכחות וגיבוי מהשטח (&quot;פתקית רפלקטיבית&quot;):</span>
                </h4>
                
                <textarea
                  value={activeAnswer.evidence}
                  onChange={(e) => onUpdateAnswer(activeTab, { evidence: e.target.value })}
                  placeholder="רשמו כאן נתונים, הוכחות לקביעת הציון או דברים קונקרטיים שעלו בדיון עם רכזי המקצוע או היועצת..."
                  rows={4}
                  className="w-full p-3 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Swipe transition buttons */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  disabled={activeTab === 1}
                  onClick={() => setActiveTab((prev) => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-100 hover:border-slate-200 rounded disabled:opacity-45"
                >
                  <i className="fa-solid fa-arrow-right mr-1"></i> לעיקרון הקודם
                </button>

                <button
                  type="button"
                  disabled={activeTab === 7}
                  onClick={() => setActiveTab((prev) => Math.min(7, prev + 1))}
                  className="px-3 py-1.5 text-xs text-indigo-600 border border-indigo-100 hover:bg-indigo-50 rounded disabled:opacity-45"
                >
                  לעיקרון הבא <i className="fa-solid fa-arrow-left ml-1"></i>
                </button>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* Operative Strategy Canvas block (חלק ג') */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-right">
        
        {/* Banner */}
        <div className="bg-slate-900 text-white p-6 md:p-8 border-b border-indigo-950 space-y-3">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
            חוד החנית האופרטיבית להנהלות
          </span>
          <h2 className="text-xl md:text-3xl font-black">קנבס גזירה אופרטיבית ותוכנית העבודה השנתית</h2>
          <p className="text-xs md:text-sm text-slate-300 leading-normal max-w-4xl">
            בהתאם לתוצאות במפת העכביש, סמנו את עוגני העוצמה הבית-ספריים שימנפו את העבודה, את שני יעדי פריצת הדרך הקריטיים שיקבלו תשומת לב מוגברת, ואת הוויתור המשמעותי שיאפשר זאת.
          </p>
        </div>

        <div className="p-6 md:p-8 space-y-8" id="action-plan-form">

          {/* AI Advisor Panel */}
          <div className="bg-slate-50 border-2 border-indigo-100 p-6 rounded-2xl bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/30 space-y-6 text-right">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-100/60 pb-5">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <i className="fa-solid fa-sparkles text-indigo-650 animate-pulse"></i>
                  <span>מערכת ייעוץ אסטרטגית מבוססת בינה מלאכותית (AI)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  ניתוח עצמאי חכם המזהה את עוגן העוצמה שלכם ושני יעדי פריצת הדרך, מייצר שאלות מיקוד ולאחר מכן מציע חזון אופרטיבי, סדירויות ושלבים מעשיים.
                </p>
              </div>
              <div>
                {aiState === 'idle' && (
                  <button
                    onClick={handleAiInitiate}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition shadow-md hover:shadow-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                    שאל את ה-AI והתחל אבחון
                  </button>
                )}
                {aiState !== 'idle' && (
                  <button
                    onClick={() => {
                      setAiState('idle');
                      onUpdateAiResult(null);
                      setAiAppliedSuccessfully(false);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-red-500 hover:bg-slate-50 rounded-lg transition"
                  >
                    אפס וערוך מחדש
                  </button>
                )}
              </div>
            </div>

            {aiError && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 text-rose-800 text-xs text-right">
                <i className="fa-solid fa-circle-exclamation mt-0.5 text-rose-500 text-sm"></i>
                <div className="space-y-1">
                  <p className="font-bold">חל עיכוב קטן בחיבור לשרת ה-AI</p>
                  <p>{aiError}</p>
                </div>
              </div>
            )}

            {/* Step 1: Initiating (Loading questions) */}
            {aiState === 'initiating' && (
              <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-700 animate-pulse">מנתח את ממצאי האבחון הבית-ספרי שלכם...</p>
                  <p className="text-[10px] text-slate-400">הבינה המלאכותית מנסחת כעת 3 שאלות הבהרה ממוקדות שיעזרו לדייק את תוכנית העבודה.</p>
                </div>
              </div>
            )}

            {/* Step 2: Answering clarifying questions */}
            {aiState === 'questions' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="p-4 bg-indigo-50/50 border border-indigo-100/50 rounded-xl text-slate-800 text-xs leading-relaxed">
                  <p className="font-bold text-indigo-950 mb-1">ניתוח ראשוני של מערכת ה-AI:</p>
                  <p className="text-slate-600">{aiIntro}</p>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-xs text-slate-755 border-r-2 border-amber-500 pr-2">אנא השיבו על שאלות המיקוד הבאות על מנת שהתוכנית תהיה מותאמת בדיוק לכם:</h4>
                  
                  {aiQuestions.map((question, idx) => (
                    <div key={idx} className="space-y-2 p-4 bg-white border border-slate-100 rounded-xl">
                      <label className="block text-xs font-bold text-slate-800 leading-normal">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-black ml-1.5">{idx + 1}</span>
                        {question}
                      </label>
                      <textarea
                        value={aiUserAnswers[idx]}
                        onChange={(e) => {
                          const updated = [...aiUserAnswers];
                          updated[idx] = e.target.value;
                          setAiUserAnswers(updated);
                        }}
                        placeholder="הקלד כאן תשובה או התייחסות חופשית מהשטח..."
                        rows={2}
                        className="w-full p-3 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-right"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleAiGenerate}
                    className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-650 to-purple-650 hover:from-indigo-700 hover:to-purple-700 rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-circle-check"></i>
                    ייצר תוכנית עבודה אסטרטגית מלאה
                  </button>
                  <button
                    onClick={handleAiGenerate}
                    className="px-5 py-2.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition cursor-pointer"
                  >
                    דלג על השאלות וייצר כעת
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Generating Plan Loader */}
            {aiState === 'generating' && (
              <div className="py-10 flex flex-col items-center justify-center space-y-4 text-center">
                <div className="relative">
                  <div className="w-12 h-12 border-4 border-purple-250 border-t-purple-650 rounded-full animate-spin"></div>
                  <i className="fa-solid fa-sparkles text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping"></i>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-800 animate-pulse">מחולל את תוכנית העבודה האסטרטגית שלכם...</p>
                  <div className="flex flex-col gap-1 text-[10px] text-slate-400">
                    <p>• מגדיר חזון אופרטיבי לשנה הראשונה</p>
                    <p>• מעצב סדירויות ארגוניות ושינוי מערכת השעות</p>
                    <p>• בונה אבני דרך מתוזמנות לפריצות הדרך</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Display Finished Plan */}
            {aiState === 'completed' && aiResult && (
              <div className="space-y-6 animate-fadeIn">
                <div className="p-4 bg-emerald-50/50 border border-emerald-110 rounded-xl flex items-center justify-between text-right">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <i className="fa-solid fa-circle-check text-base"></i>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-950">תוכנית העבודה האסטרטגית שלכם מוכנה!</h4>
                      <p className="text-[10px] text-emerald-700">התוכנית כוללת פירוט עבור עוגן העוצמה, שתי פריצות הדרך והוויתור הארגוני.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleApplyAiRecommendations}
                    className="px-4 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg transition shadow flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-file-import"></i>
                    החל את ההמלצות על קנבס העבודה
                  </button>
                </div>

                {/* Quick Tips */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-indigo-100/40 pb-5">
                  {aiResult.quickTips?.map((tip, idx) => (
                    <div key={idx} className="p-3 bg-indigo-50/20 border border-indigo-100/10 rounded-xl space-y-1">
                      <span className="text-[9px] font-black text-indigo-700 uppercase tracking-wider">טיפ יישום {idx + 1}</span>
                      <p className="text-xs text-slate-750 leading-normal font-medium">{tip}</p>
                    </div>
                  ))}
                </div>

                {/* The Plan content */}
                <div className="p-6 md:p-8 bg-slate-900 text-slate-100 rounded-2xl shadow-inner border border-slate-850 max-h-[500px] overflow-y-auto font-sans leading-relaxed text-right space-y-6">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs pb-3 border-b border-slate-800">
                    <i className="fa-solid fa-file-lines"></i>
                    <span>תוצר אופרטיבי - בינה מלאכותית (Generative AI)</span>
                  </div>
                  <div className="markdown-body max-w-none text-right text-xs md:text-sm space-y-4">
                    <ReactMarkdown>{aiResult.summaryHtml}</ReactMarkdown>
                  </div>
                </div>

                {aiAppliedSuccessfully && (
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-center gap-2 animate-bounce">
                    <i className="fa-solid fa-sparkles text-indigo-655"></i>
                    <span>ההמלצות הועתקו והוזנו בהצלחה מעוררת השראה ישירות לתוך קנבס העבודה למטה!</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Metadata info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">שם בית הספר לקובץ ההדפסה:</label>
              <input
                type="text"
                value={actionPlan.schoolName}
                onChange={(e) => onUpdateActionPlan({ schoolName: e.target.value })}
                placeholder="הקלד כאן את שם בית הספר..."
                className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">שנת לימודים:</label>
              <input
                type="text"
                value={actionPlan.schoolYear}
                onChange={(e) => onUpdateActionPlan({ schoolYear: e.target.value })}
                placeholder="למשל: תשפ&quot;ז (2026-2027)"
                className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Box 1: Strengths Piller */}
            <div className="p-5 rounded-2xl border border-indigo-100 bg-indigo-50/20 space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-indigo-700 uppercase">מינוף הקיים</span>
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <i className="fa-solid fa-crown text-indigo-650"></i>
                  <span>עוגן העוצמה הבית-ספרי</span>
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  העיקרון שיקבל את הציון הגבוה ביותר במפה או אחד שיש לגביו תשתית פועלת רחבה שנמשיך לשכלל.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">בחר את עיקרון העוצמה:</label>
                <select
                  value={actionPlan.strengths[0] || ""}
                  onChange={(e) => onUpdateActionPlan({ strengths: e.target.value ? [parseInt(e.target.value)] : [] })}
                  className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="">-- בחר מלשימת העקרונות --</option>
                  {PRINCIPLES_DATA.map((p) => (
                    <option key={p.id} value={p.id}>
                      עיקרון {p.id}: {p.title} (ציון {scores[p.id]?.toFixed(1) || '1.0'})
                    </option>
                  ))}
                </select>

                <textarea
                  value={actionPlan.strengthReason || ""}
                  onChange={(e) => onUpdateActionPlan({ strengthReason: e.target.value })}
                  placeholder="רשמו כאן נימוק קונקרטי והוכחה מהרדאר לגבי עוגן זה ואיך נפעל להרחיב אותו עוד..."
                  rows={4}
                  className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-light"
                />
              </div>
            </div>

            {/* Box 2: Breakthrough Targets (Needs two breakthroughs) */}
            <div className="p-5 rounded-2xl border border-emerald-100 bg-emerald-50/20 space-y-4 lg:col-span-2">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">הובלת שינוי עמוק</span>
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <i className="fa-solid fa-rocket text-emerald-650"></i>
                  <span>שני יעדי פריצת הדרך לשנה הקרובה</span>
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  שני העקרונות שנבחרו מתוך האבחון הנמוך אך קריטיים ובעלי פוטנציאל ההשתפרות הגדול ביותר. המנהל מגדיר את שני היעדים לקראת ספטמבר.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Breakthrough 1 */}
                <div className="bg-white p-4 rounded-xl border border-emerald-100 space-y-3">
                  <label className="block text-xs font-black text-slate-800">יעד פריצת דרך ראשון:</label>
                  <select
                    value={actionPlan.breakthroughs[0] || ""}
                    onChange={(e) => {
                      const updated = [...actionPlan.breakthroughs];
                      updated[0] = parseInt(e.target.value);
                      onUpdateActionPlan({ breakthroughs: updated });
                    }}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                  >
                    <option value="">-- בחר עיקרון ראשון --</option>
                    {PRINCIPLES_DATA.map((p) => (
                      <option key={p.id} value={p.id}>
                        עיקרון {p.id}: {p.title} (ציון {scores[p.id]?.toFixed(1) || '1.0'})
                      </option>
                    ))}
                  </select>

                  <textarea
                    value={actionPlan.breakthroughReason1 || ""}
                    onChange={(e) => onUpdateActionPlan({ breakthroughReason1: e.target.value })}
                    placeholder="פרט את החזון האופרטיבי, הסדירות הפועלת ואבן הדרך הראשונה לאחד בספטמבר לעיקרון זה..."
                    rows={4}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>

                {/* Breakthrough 2 */}
                <div className="bg-white p-4 rounded-xl border border-emerald-100 space-y-3">
                  <label className="block text-xs font-black text-slate-800">יעד פריצת דרך שני:</label>
                  <select
                    value={actionPlan.breakthroughs[1] || ""}
                    onChange={(e) => {
                      const updated = [...actionPlan.breakthroughs];
                      updated[1] = parseInt(e.target.value);
                      onUpdateActionPlan({ breakthroughs: updated });
                    }}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                  >
                    <option value="">-- בחר עיקרון שני --</option>
                    {PRINCIPLES_DATA.map((p) => (
                      <option key={p.id} value={p.id}>
                        עיקרון {p.id}: {p.title} (ציון {scores[p.id]?.toFixed(1) || '1.0'})
                      </option>
                    ))}
                  </select>

                  <textarea
                    value={actionPlan.breakthroughReason2 || ""}
                    onChange={(e) => onUpdateActionPlan({ breakthroughReason2: e.target.value })}
                    placeholder="פרט את החזון האופרטיבי, הסדירות הפועלת ואבן הדרך הראשונה לאחד בספטמבר לעיקרון זה..."
                    rows={4}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>

              </div>
            </div>

          </div>

          {/* Interactive Workshop Card CTA */}
          <div 
            onClick={() => setShowWorkshopDetail(true)}
            className="p-6 rounded-2xl border border-dashed border-indigo-200 bg-gradient-to-r from-indigo-50/40 via-white to-slate-50/50 space-y-4 hover:border-indigo-400 hover:shadow-lg transition-all cursor-pointer group text-right"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                  סדנת מורים והנהלה מובנית
                </span>
                <h4 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <i className="fa-solid fa-people-group text-indigo-600 animate-pulse"></i>
                  <span>מהלך הסדנה המלא עם צוות ההנהלה וצוות המורים</span>
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed max-w-2xl font-light">
                  על מנת להגיע לדירוג מוסכם ולגזור את תכנית העבודה בצורה האופטימלית, מומלץ לקיים סדנה מוסדית בת 90 דקות. לחצו כאן כדי להיכנס למחוון רמות הבשלות המלא, שלבי ההפעלה וניהול הדיון!
                </p>
              </div>
              
              <div className="w-9 h-9 rounded-full bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center text-indigo-600 transition-all shrink-0 shadow-sm">
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 group-hover:underline">
              <span>לחצו לצפייה במחוון ובמהלך הסדנה</span>
              <i className="fa-solid fa-arrow-left-long"></i>
            </div>
          </div>

          {/* Large prominent feedback block with PDF print CTA */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-col md:flex-row gap-4">
            <div className="text-right space-y-1">
              <h5 className="font-bold text-sm text-slate-900">מוכנים להדגשת היעדים?</h5>
              <p className="text-xs text-slate-500">לחצו על ייצוא הדוח כדי לקבל דוח משולב, המכיל את מפת העכביש לדיון הנהלה ומועצות פדגוגיות.</p>
            </div>
            
            <button
              onClick={handlePrint}
              className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 text-xs flex items-center gap-2 cursor-pointer w-full md:w-auto justify-center"
            >
              <i className="fa-solid fa-file-pdf"></i>
              <span>הורדה והדפסה</span>
            </button>
          </div>

        </div>

      </section>

      {/* Embedded hidden printable area specific for standard paper output rendering */}
      <div className="hidden print:block print:bg-white text-slate-900 p-8 space-y-6 bg-white" id="executive-printed-canvas" style={{ direction: 'rtl' }}>
        <div className="text-center space-y-2 border-b-2 border-slate-900 pb-4">
          <h1 className="text-2xl font-black">מדריך שבעת העקרונות של מנהל החינוך</h1>
          <h2 className="text-xl font-bold">תוכנית עבודה אסטרטגית שנתית ומפת בשלות</h2>
          <div className="flex justify-center gap-8 text-xs font-mono font-medium text-slate-600 pt-2">
            <span><strong>בית ספר:</strong> {actionPlan.schoolName || '___________'}</span>
            <span><strong>שנת לימודים:</strong> {actionPlan.schoolYear || '_______'}</span>
            <span><strong>תאריך פלט:</strong> {new Date().toLocaleDateString('he-IL')}</span>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <h3 className="text-lg font-bold border-r-4 border-indigo-600 pr-2">א. סיכום הבשלות ומפת העכביש הבית-ספרית</h3>
          <p className="text-xs text-slate-600 leading-normal">
            תרשים זה מציג את רמות הבשלות של בית הספר ב-7 העקרונות (ממוצע משוקלל על בסיס ציר הלמה, האיך והמה במעגל הזהב).
          </p>

          <table className="border-collapse border border-slate-200 w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-200 p-2 font-bold">#</th>
                <th className="border border-slate-200 p-2 font-bold">העיקרון הפדגוגי</th>
                <th className="border border-slate-200 p-2 font-bold">ציון משוקלל</th>
                <th className="border border-slate-200 p-2 font-bold font-light">הוכחות וצידוקים מהשטח</th>
              </tr>
            </thead>
            <tbody>
              {PRINCIPLES_DATA.map((p) => {
                const score = scores[p.id] || 1;
                const ans = answers[p.id];
                return (
                  <tr key={p.id}>
                    <td className="border border-slate-200 p-2 font-mono">{p.id}</td>
                    <td className="border border-slate-200 p-2 font-bold">{p.title}</td>
                    <td className="border border-slate-200 p-2 font-mono font-bold text-center">{score.toFixed(1)}</td>
                    <td className="border border-slate-200 p-2 text-slate-700 italic">{ans?.evidence || 'לא נרשמו הערות'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 pt-4">
          <h3 className="text-lg font-bold border-r-4 border-indigo-600 pr-2">ב. גזירה אופרטיבית ויעדי קצה</h3>
          
          <div className="space-y-3">
            <div className="border border-slate-300 p-4 rounded bg-slate-50/50">
              <h4 className="font-bold text-xs text-slate-800">● עוגן העוצמה הבית-ספרי (למינוף והעצמה):</h4>
              <p className="text-xs font-bold text-slate-700 mt-1">
                {actionPlan.strengths[0] 
                  ? `עיקרון ${actionPlan.strengths[0]}: ${PRINCIPLES_DATA.find(p => p.id === actionPlan.strengths[0])?.title}` 
                  : 'טרם נבחר עוגן'}
              </p>
              {actionPlan.strengthReason ? (
                <div className="text-xs text-slate-600 mt-2 bg-white p-3 rounded border border-slate-200 leading-relaxed font-light whitespace-pre-line text-justify">
                  <strong className="text-slate-800 font-semibold">פירוט ונימוק אופרטיבי:</strong><br />
                  {actionPlan.strengthReason}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic mt-1">לא הוזן פירוט עבור עוגן העוצמה.</p>
              )}
            </div>

            <div className="border border-slate-300 p-4 rounded bg-slate-50/50">
              <h4 className="font-bold text-xs text-slate-800">● יעד פריצת דרך ראשון במרכז העשייה:</h4>
              <p className="text-xs font-bold text-slate-700 mt-1">
                {actionPlan.breakthroughs[0] 
                  ? `עיקרון ${actionPlan.breakthroughs[0]}: ${PRINCIPLES_DATA.find(p => p.id === actionPlan.breakthroughs[0])?.title}` 
                  : 'טרם נבחר יעד'}
              </p>
              {actionPlan.breakthroughReason1 ? (
                <div className="text-xs text-slate-600 mt-2 bg-white p-3 rounded border border-slate-200 leading-relaxed font-light whitespace-pre-line text-justify">
                  <strong className="text-slate-800 font-semibold">פירוט ותוכנית פעולה:</strong><br />
                  {actionPlan.breakthroughReason1}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic mt-1">לא הוזן פירוט עבור יעד פריצת הדרך הראשון.</p>
              )}
            </div>

            <div className="border border-slate-300 p-4 rounded bg-slate-50/50">
              <h4 className="font-bold text-xs text-slate-800">● יעד פריצת דרך שני במרכז העשייה:</h4>
              <p className="text-xs font-bold text-slate-700 mt-1">
                {actionPlan.breakthroughs[1] 
                  ? `עיקרון ${actionPlan.breakthroughs[1]}: ${PRINCIPLES_DATA.find(p => p.id === actionPlan.breakthroughs[1])?.title}` 
                  : 'טרם נבחר יעד'}
              </p>
              {actionPlan.breakthroughReason2 ? (
                <div className="text-xs text-slate-600 mt-2 bg-white p-3 rounded border border-slate-200 leading-relaxed font-light whitespace-pre-line text-justify">
                  <strong className="text-slate-800 font-semibold">פירוט ותוכנית פעולה:</strong><br />
                  {actionPlan.breakthroughReason2}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic mt-1">לא הוזן פירוט עבור יעד פריצת הדרך השני.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 break-inside-avoid">
          <h3 className="text-lg font-bold border-r-4 border-indigo-600 pr-2">ג. מהלך הסדנה המוסדית ופרוטוקול ההפעלה (90 דק׳)</h3>
          <div className="text-xs text-slate-700 leading-relaxed text-justify bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <p><strong>שלב א&apos;: עבודה עצמית ורפלקציה (15 דקות):</strong> כל חבר הנהלה מעריך ומסמן באופן עצמאי את רמת הבשלות ורושם הנמקה קצרה כהוכחה מהשטח.</p>
            <p><strong>שלב ב&apos;: הצפת נתונים ודיון בפערים (45 דקות) - לב הסדנה:</strong> מציגים את הדירוגים על גבי הרדאר הריק על הלוח, מנהלים דיון ממוקד סביב פערי תפיסה ומגיעים לדירוג מוסכם.</p>
            <p><strong>שלב ג&apos;: שרטוט הרדאר המוסכם הסופי (10 דקות):</strong> מחברים את הציון המוסכם של כל 7 העקרונות ומותחים קו ביניהם לקבלת מפת הבשלות המוסדית הסופית.</p>
          </div>
        </div>

        <div className="pt-16 flex justify-around text-xs font-bold pt-12 border-t border-slate-200 mt-12 break-inside-avoid">
          <div className="text-center space-y-8">
            <div className="w-32 border-b border-slate-450 h-px"></div>
            <span>חתימת מנהל/ת בית הספר</span>
          </div>
          <div className="text-center space-y-8">
            <div className="w-32 border-b border-slate-450 h-px"></div>
            <span>חתימת מפקח/ת משרד החינוך</span>
          </div>
          <div className="text-center space-y-8">
            <div className="w-32 border-b border-slate-450 h-px"></div>
            <span>מוביל/ת פדגוגיה עירונית</span>
          </div>
        </div>

      </div>

    </div>
  );
};
