import { GoogleGenAI, Type } from "@google/genai";

// Shared, framework-agnostic AI logic.
// Used by both the local Express dev server (server.ts) and the Vercel
// serverless functions under api/ai/*. Keeping it here (with no Express/Vite
// imports) means it can be bundled into a serverless function cheaply.
//
// Each exported handler returns { status, json } so the caller (Express or
// Vercel) only has to forward it to its own response object. This preserves
// the exact HTTP status codes and payloads from the original server.

// Lazy initialization of GoogleGenAI to prevent module-load crashes if API key is not yet set
let aiInstance: GoogleGenAI | null = null;
function getAI() {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not defined in the environment variables. Please check your App Settings in the panel.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Principles definition for Gemini context
const PRINCIPLES_DICT = {
  1: {
    id: 1,
    title: "המיומנויות בליבת העשייה",
    shortSummary: "העברת מרכז הכובד מחלוקת ידע לתרגול מיומנויות קוגניטיביות ורגשיות.",
    description: "מיקוד בהקניית פתרון בעיות, חשיבה ביקורתית, עבודת צוות וחוסן. שימוש בהערכה חלופית מבוססת ביצועים, תיק עבודות דיגיטלי, והערכת מיומנויות בתעודה הרשמית."
  },
  2: {
    id: 2,
    title: "שינוי תפקיד המורה למוביל למידה אנושית",
    shortSummary: "הבראת המרכיב הרגשי-חברתי בשיח הבית-ספרי ומעבר של מורים לתפקיד מנטורינג.",
    description: "מעבר המורה ממרצה פרונטלי למנטור המלווה אישית את התלמידים. הקצאת שעות שיח קבועות מוגנות במערכת השעות והתכנסות קל\"מ (קהילת למידה מקצועית כגון קבוצות שיח)."
  },
  3: {
    id: 3,
    title: "הטמעת AI כתשתית אינטגרטיבית ועמוקה בכל תהליכי הניהול וההוראה",
    shortSummary: "הפיכת ה-AI לתשתית ניהולית ופדגוגית מובילה שמפנה זמן למפגש אנושי.",
    description: "שימוש ב-AI כעוזר הוראה אישי וכלי ניהולי (בניית סילבוסים, חוסר ביורוקרטיה) המאפשר למנהל ולמורה לנצל את הזמן הרשמי שנחסך לצורך מנטורינג קבוצתי ואישי."
  },
  4: {
    id: 4,
    title: "הטמעת מודל BYOD - Bring Your Own Device",
    shortSummary: "רתום המכשירים האישיים בשילוב עבודה שיתופית וניהול מבוסס נתונים.",
    description: "הסבת המכשירים הקיימים של התלמידים לכלי פדגוגי בשגרת שיעור. הטמעת אמנת BYOD, מעבר לסביבת קלאסרום (Google Classroom) וחוקי רמזור בכיתה להורדת מוססות."
  },
  5: {
    id: 5,
    title: "חינוך טכנולוגי הוליסטי וספירלי",
    shortSummary: "שילוב הטכנולוגיה בכלל מקצועות הדעת ברצף מיומנויות רב-שנתי.",
    description: "רצף מיומנויות אחיד מגילאי היסודי ועד תיכון. רכז תקשוב עובד בשביל שילוב טכנולוגיה באופן סדור בנושאים הומניסטיים ומדעיים, במקום להישאר בשיעור מחשבים בודד."
  },
  6: {
    id: 6,
    title: "גיוון במרחבי ובסביבות הלמידה",
    shortSummary: "הסבת שטחי בית הספר והכיתה למרחבים גמישים, היברידיים ופונקציונליים.",
    description: "הסבת מסדרונות, ספריות, חצרות ומבואות שלומדות בהם כיתות מבוזרות. ניהול מערכת שעות של מרחבים גמישים בשיתוף כלים דיגיטליים אחידים."
  },
  7: {
    id: 7,
    title: "תרבות מייקרינג וניצול משאבים עירוניים",
    shortSummary: "למידה התנסותית פיזית במרכזי חדשנות עירוניים וקידום חשיבה עיצובית.",
    description: "מפגש מעשי שבועי ארוך 'בלוק פתוח במערכת' המועבר למרכזים עירוניים מורשים (מוזיאונים, אתחלא, בית רותר) המעודד חשיבה עיצובית ויצירת מוצרים פיזיים מוכחים."
  }
};

// Formulate introductory analysis and 3 custom clarifying questions
export async function initiate(body: any): Promise<{ status: number; json: any }> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return { status: 500, json: { error: "GEMINI_API_KEY missing from environment" } };
    }

    const { scores, answers, schoolName, schoolYear } = body || {};

    if (!scores || Object.keys(scores).length === 0) {
      return { status: 400, json: { error: "Missing scores in request body" } };
    }

    // Determine the highest (strength) and lowest two (breakthroughs)
    const scoreItems = Object.entries(scores).map(([id, score]) => ({
      id: parseInt(id),
      score: score as number,
    }));

    // Sort to find top and bottom
    const sortedDesc = [...scoreItems].sort((a, b) => b.score - a.score);
    const sortedAsc = [...scoreItems].sort((a, b) => a.score - b.score);

    const strengthId = sortedDesc[0]?.id;
    const breakthroughId1 = sortedAsc[0]?.id;
    // Ensure we don't pick the same one
    const breakthroughId2 = sortedAsc[1]?.id !== strengthId ? sortedAsc[1]?.id : sortedAsc[2]?.id;

    const strengthPrinciple = PRINCIPLES_DICT[strengthId as keyof typeof PRINCIPLES_DICT];
    const breakthrough1 = PRINCIPLES_DICT[breakthroughId1 as keyof typeof PRINCIPLES_DICT];
    const breakthrough2 = PRINCIPLES_DICT[breakthroughId2 as keyof typeof PRINCIPLES_DICT];

    // Gather corresponding evidence
    const strengthEvidence = answers?.[strengthId]?.evidence || "לא תועדו נתונים ספציפיים";
    const bt1Evidence = answers?.[breakthroughId1]?.evidence || "לא תועדו נתונים ספציפיים";
    const bt2Evidence = answers?.[breakthroughId2]?.evidence || "לא תועדו נתונים ספציפיים";

    // Call Gemini to generate exactly 3 clarifying questions
    const prompt = `אתה יועץ ארגוני ופדגוגי בכיר המלווה מנהלי בתי ספר בכתיבת תוכנית עבודה שנתית מבוססת שבעת העקרונות של מנהל החינוך.
לפניך ממצאי אבחון בשלות של הנהלת בית הספר${schoolName ? ` "${schoolName}"` : ""} לשנה"ל${schoolYear ? ` ${schoolYear}` : ""}:

- עוגן העוצמה המזוהה (הציון הגבוה ביותר במפה): עיקרון ${strengthId} - "${strengthPrinciple?.title}" (ציון: ${scores[strengthId]?.toFixed(1)}/4).
  הוכחות וראיות מהשטח: "${strengthEvidence}".

- יעד פריצת דרך ראשון (הציון הנמוך ביותר): עיקרון ${breakthroughId1} - "${breakthrough1?.title}" (ציון: ${scores[breakthroughId1]?.toFixed(1)}/4).
  הוכחות וראיות מהשטח: "${bt1Evidence}".

- יעד פריצת דרך שני (הציון השני בנמוכותו): עיקרון ${breakthroughId2} - "${breakthrough2?.title}" (ציון: ${scores[breakthroughId2]?.toFixed(1)}/4).
  הוכחות וראיות מהשטח: "${bt2Evidence}".

מטרתך: לנסח בדיוק שלוש (3) שאלות הבהרה קצרות, חכמות וממוקדות ברוסית/עברית (עברית בלבד!) בעבור משיב השאלון (המנהל/ת או חבר הנהלה).
השאלות נועדו לחדד את האילוצים והמשאבים הייחודיים של בית הספר, על מנת שהתוכנית האסטרטגית המלאה שנפיק מיד אחריה תהיה מותאמת אישית בצורה מקסימלית ועמוקה.

הנחיות לשאלות:
1. שאלה אחת תעסוק באיך בית הספר יכול למנף את עוגן העוצמה שלו ("${strengthPrinciple?.title}") כדי למנף או להשפיע על פריצות הדרך.
2. שאלה שנייה תתמקד בקושי, האילוצים (למשל: תמיכת הורים, משאבי תקציב, חוסר מוטיבציה של מורים, או עומסים) סביב יעד פריצת הדרך הראשון ("${breakthrough1?.title}").
3. שאלה שלישית תהיה מכוונת ליעד פריצת הדרך השני ("${breakthrough2?.title}") ותבקש הבהרה על מה שכבר נוסה בעבר או איזה שינוי קטן יחשב כהישג מהיר (Quick Win) בשנה הראשונה.

אנא החזר את התוצאה במבנה JSON תקין (ורק ה-JSON ללא markdown block קוד מיוחד או פילבוסט) התואם את הסכמה הבאה:
{
  "questions": [
    "שאלה ראשונה מנוסחת היטב הפונה ישירות למנהל/ת",
    "שאלה שנייה מנוסחת היטב",
    "שאלה שלישית מנוסחת היטב"
  ],
  "introText": "פנייה קצרה, מעריכה ומעוררת השראה באורך 2-3 משפטים המציגה את ניתוח עוגן העוצמה ושני יעדי פריצת הדרך כדי לחבר אותם לתהליך החשיבה מול המנהל."
}
ודא שהטקסט בעברית רהוטה ומקצועית ומכבדת.`;

    const chatResponse = await getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of exactly 3 custom clarifying questions in Hebrew",
            },
            introText: {
              type: Type.STRING,
              description: "A short elegant opening brief in Hebrew thanking the user and stating the highlighted strength and weaknesses.",
            }
          },
          required: ["questions", "introText"],
        }
      }
    });

    const result = JSON.parse(chatResponse.text || "{}");
    return {
      status: 200,
      json: {
        ...result,
        strengthId,
        breakthroughIds: [breakthroughId1, breakthroughId2]
      }
    };
  } catch (error: any) {
    console.error("Initiation error:", error);
    return { status: 500, json: { error: error.message || "Failed to initiate AI diagnostic check." } };
  }
}

// Generate the final full strategic plan based on questionnaire answers
export async function generate(body: any): Promise<{ status: number; json: any }> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return { status: 500, json: { error: "GEMINI_API_KEY missing from environment" } };
    }

    const {
      scores,
      answers,
      strengthId,
      breakthroughIds,
      questions,
      userAnswers,
      schoolName,
      schoolYear
    } = body || {};

    const strengthPrinciple = PRINCIPLES_DICT[strengthId as keyof typeof PRINCIPLES_DICT];
    const bt1 = PRINCIPLES_DICT[breakthroughIds?.[0] as keyof typeof PRINCIPLES_DICT];
    const bt2 = PRINCIPLES_DICT[breakthroughIds?.[1] as keyof typeof PRINCIPLES_DICT];

    const strengthEvidence = answers?.[strengthId]?.evidence || "לא הוכנסו הערות";
    const bt1Evidence = answers?.[breakthroughIds?.[0]]?.evidence || "לא הוכנסו הערות";
    const bt2Evidence = answers?.[breakthroughIds?.[1]]?.evidence || "לא הוכנסו הערות";

    // Format the clarifying questions and user responses if provided
    let clarifyingSection = "";
    if (questions && userAnswers) {
      clarifyingSection = "\n\nתשובות ישירות ומידע קונקרטי נוסף מההנהלה:\n";
      questions.forEach((q: string, idx: number) => {
        const uAns = userAnswers[idx] || "לא סופקה תשובה ספציפית";
        clarifyingSection += `שאלה: ${q}\nתשובה מהשטח: ${uAns}\n\n`;
      });
    }

    const prompt = `אתה יועץ ארגוני ופדגוגי בעל מומחיות יוצאת דופן בהטמעת 'תוכניות העבודה השנתיות של מנהל החינוך'.
לפניך ממצאי אבחון בשלות פדגוגי וניהולי עבור בית הספר${schoolName ? ` "${schoolName}"` : ""}${schoolYear ? ` לשנת לימודים ${schoolYear}` : ""}:

עקרונות המפה והציונים (מ-1.0 עד 4.0):
1. המיומנויות בליבת העשייה: צמד ציונים ממוצע: ${scores?.[1]?.toFixed(1) || "1.0"}
2. שינוי תפקיד המורה למוביל למידה אנושית: צמד ציונים ממוצע: ${scores?.[2]?.toFixed(1) || "1.0"}
3. הטמעת AI כתשתית אינטגרטיבית ועמוקה בכל תהליכי הניהול וההוראה: צמד ציונים ממוצע: ${scores?.[3]?.toFixed(1) || "1.0"}
4. הטמעת מודל BYOD: צמד ציונים ממוצע: ${scores?.[4]?.toFixed(1) || "1.0"}
5. חינוך טכנולוגי הוליסטי וספירלי: צמד ציונים ממוצע: ${scores?.[5]?.toFixed(1) || "1.0"}
6. גיוון במרחבי ובסביבות הלמידה: צמד ציונים ממוצע: ${scores?.[6]?.toFixed(1) || "1.0"}
7. תרבות מייקרינג וניצול משאבים עירוניים: צמד ציונים ממוצע: ${scores?.[7]?.toFixed(1) || "1.0"}

מתוכם:
- אזור העוצמה (Strength Anchor): עיקרון ${strengthId} - "${strengthPrinciple?.title}" (ציון: ${scores?.[strengthId]?.toFixed(1)}/4)
  ראיות ותיעוד ההנהלה: "${strengthEvidence}"

- שני אזורי פריצת דרך (Breakthrough Domains):
  1. יעד פריצת דרך א': עיקרון ${breakthroughIds?.[0]} - "${bt1?.title}" (ציון: ${scores?.[breakthroughIds?.[0]]?.toFixed(1)}/4)
     ראיות מוקדמות: "${bt1Evidence}"
  2. יעד פריצת דרך ב': עיקרון ${breakthroughIds?.[1]} - "${bt2?.title}" (ציון: ${scores?.[breakthroughIds?.[1]]?.toFixed(1)}/4)
     ראיות מוקדמות: "${bt2Evidence}"

${clarifyingSection}

אנא הפק תכנית מקיפה, מעמיקה, בעלת רזולוציה אופרטיבית גבוהה ביותר (עבור מנהל ביה"ס והצוות), המוגשת בעברית רהוטה וכוללת את הסעיפים ההעוקבים:

1. **אזור העוצמה הבית ספרי (עוגן העוצמה הבית-ספרי)**:
   - ניתוח רפלקטיבי מעצים ומבוסס ראיות.
   - הצעה על דרכים קונקרטיות לשימוש בעוגן חזק זה כמשקל נגד (Leverage Point) שיקל על דחיפת שני יעדי פריצת הדרך האחרים.

2. **ניתוח יעד פריצת דרך ראשון - "${bt1?.title}"**:
   - **מהלך חשיבה משמעותי**: שינוי תודעתי פדגוגי עמוק ומנומק לצוות (Mindset Shift paradigm).
   - **חזון אופרטיבי לשנה הראשונה**: איך יראה בית הספר בספטמבר ובסיום השנה סביב עיקרון זה. למה שואפים לקבע.
   - **סדירויות אפשריות**: בדיוק אילו שגרות מובנות (במליאות, בבניית מערכת שעות, בוועדות) יש ליצור כדי לעשות מזה סדירות עמידה, כולל מי ינהל, מתי וכמה פעמים.
   - **אבני דרך ראשונות לפריצת הדרך**: סדרה של 3-4 אבני דרך עם תאריכים מוגדרים (למשל: ספטמבר 2026, דצמבר 2026, אפריל 2027) שיש להשלים.

3. **ניתוח יעד פריצת דרך שני - "${bt2?.title}"**:
   - **מהלך חשיבה משמעותי**: שינוי תודעתי פדגוגי עמוק ומנומק לצוות.
   - **חזון אופרטיבי לשנה הראשונה**.
   - **סדירויות אפשריות** (סעיפי מערכת ספציפיים ולוחות זמנים קונקרטיים).
   - **אבני דרך ראשונות לפריצת הדרך** (3-4 אבני דרך מדויקות).

4. **ויתור ארגוני מומלץ (Organizational Sacrifice)**:
   - על סמך ניתוח האילוצים, הצע ויתור פדגוגי/תפעולי משמעותי ביותר (למשל: ביטול משימות שינון, ביטול מערכת שעות בני 45 דק', צמצום הדפסות וכו') שיפנה את הקיבולת והקשב של המורים לעבוד על שתי פריצות דרך אלו.

דגשים קריטיים:
- הקפד על פדגוגיה ריאלית, מעשית מאוד, תקיפה ומעוררת שינוי.
- הטקסט חייב להיבנות ב-Markdown קריא לעילא ומסודר בפסקאות מופרדות היטב.
- קריטי: חלק את התוכן לפסקאות קצרות, ממוקדות ומופרדות באמצעות שני מעברי שורה ("\n\n" או "\\n\\n") לפחות בין פסקה לפסקה. אל תייצר בלוקים ארוכים ורציפים של מלל - כל רעיון, סדירות, או שלב חייב לקבל פסקה משלו עם כותרת משנה מודגשת או נקודת בולט (bullet point) ייעודית, כדי לאפשר קריאה קלה ונוחה להנהלת בית הספר.
- אל תציג Mock data או שמות של פונקציות תכנותיות. התוכן מיועד ישירות לעיני הנהלת בית הספר.

החזר את התשובה במבנה ה-JSON הבא בדיוק:
{
  "summaryHtml": "טקסט מקיף בפורמט Markdown מעושר ומעולה הכולל את כל האבחון לעיל, מוכן להצגה יפהפייה למשתמש.",
  "quickTips": [
    "טיפ מעשי מהיר ראשון קצר",
    "טיפ מעשי מהיר שני",
    "טיפ מעשי מהיר שלישי"
  ],
  "autoFill": {
    "strengthReason": "תמצית אופרטיבית קצרה (עד 2-3 משפטים) שנועדה למילוי אוטומטי בקנבס של עוגן העוצמה",
    "breakthroughReason1": "תמצית אופרטיבית קצרה של החלוציות והסדירות של יעד 1 למילוי אוטומטי בקנבס",
    "breakthroughReason2": "תמצית אופרטיבית קצרה של החלוציות והסדירות של יעד 2 למילוי אוטומטי בקנבס",
    "organizationalSacrifice": "המלצת הוויתור הארגוני המרכזי שנועדה למילוי בתיבת הוויתור בקנבס"
  }
}
שימו לב שהתגובה צריכה להיות JSON נקי לחלוטין ללא markdown wrapper.`;

    const chatResponse = await getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summaryHtml: {
              type: Type.STRING,
              description: "Complete strategic evaluation study in beautiful Hebrew Markdown format.",
            },
            quickTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 concise checklist bullet items for successful implementation.",
            },
            autoFill: {
              type: Type.OBJECT,
              properties: {
                strengthReason: { type: Type.STRING },
                breakthroughReason1: { type: Type.STRING },
                breakthroughReason2: { type: Type.STRING },
                organizationalSacrifice: { type: Type.STRING }
              },
              required: ["strengthReason", "breakthroughReason1", "breakthroughReason2", "organizationalSacrifice"],
            }
          },
          required: ["summaryHtml", "quickTips", "autoFill"],
        }
      }
    });

    const result = JSON.parse(chatResponse.text || "{}");
    return { status: 200, json: result };
  } catch (error: any) {
    console.error("Plan Generation error:", error);
    return { status: 550, json: { error: error.message || "Failed to generate AI strategic roadmap." } };
  }
}
