# תכנון טכני מפורט — PayrollPortal

מסמך זה עונה על סעיף 4 בתרגיל. הוא מתאר את המערכת **כפי שנבנתה**.
העומק המלא (סכימה, RLS, כל Action, UX מסך-מסך) נמצא באנגלית בתיקייה
[technical-design/](technical-design/) — זה אותו תכנון, מפוצל לקבצים.

| קובץ | תוכן |
| --- | --- |
| [00-overview.md](technical-design/00-overview.md) | היקף, סטאק, מטריצת הרשאות |
| [01-database.md](technical-design/01-database.md) | סכימה, אילוצים, אינדקסים |
| [02-rls.md](technical-design/02-rls.md) | מדיניות RLS ו-Storage |
| [03-api.md](technical-design/03-api.md) | Actions, Routes, RPCs, מטריצת CRUD |
| [04-frontend.md](technical-design/04-frontend.md) | תיקיות, קומפוננטות, State, שגיאות |
| [05-business-logic.md](technical-design/05-business-logic.md) | תובנות שכר, ימי עבודה, מכונות מצבים |
| [06-ux.md](technical-design/06-ux.md) | UX לכל תפקיד |

---

## 1. מבנה התיקיות

```
app/
  layout.tsx                 lang="en", LTR
  page.tsx                   שיווק; מחוברים מופנים הביתה
  (auth)/                    login, signup, invite/[token], verify
  (app)/                     AppShell + layouts לפי תפקיד
    employee/                דשבורד, תלושים, מסמכים, 101, חופשה
    manager/                 סקירה, אישורים, צוות, משותף, לוח שנה
    bookkeeper/              תור, אישורים, עסקים, תקופות, מסמכים
  auth/callback|signout      החלפת קוד / יציאה
  api/                       הפניות לקבצים + parse
components/                  layout, insights, payslips, time-off, documents, …
lib/
  actions/                   "use server"
  validations/               Zod
  domain/                    working-days.ts, insights.ts
  payslip/                   parser + match-employee
  supabase/                  server.ts, client.ts, session.ts
  auth/                      context.ts, dev-auth.ts
proxy.ts                     רענון סשן (Next.js 16, לא middleware.ts)
supabase/migrations/         0001 … 0012
types/app.ts
docs/
```

אין `components/ui` של shadcn, אין `types/database.ts` שנוצר אוטומטית, ואין עץ `tests/` עדיין — ראו אפיון הבדיקות.

---

## 2. מבנה הקומפוננטות המרכזיות

ברירת המחדל היא Server Component. `"use client"` רק לאינטראקציה (טפסים, לוח שנה, העלאה מרובה).

דוגמה — דשבורד עובד:

```
EmployeeDashboardPage              server: תלושים, יתרות, מסמכים, בקשות צוות
├── IncomingTeamJoinList           client: אישור / דחייה
├── PayInsightCards                server
├── NetPayTrend                    client: SVG ממערך חודשים מוכן מראש
├── LeaveBalanceCards              server
├── PayslipList                    server
└── DocumentFolders                server
```

`AppShell` + `SideNav` מקבלים workspace מה-layout. ניווט לפי תפקיד: עובד לא רואה פריטי מנהל; משרד לא רואה קבוצת עובד אישית.

---

## 3. מבנה בסיס הנתונים

ראו דיאגרמת ER ופירוט עמודות ב-[01-database.md](technical-design/01-database.md).

עקרונות:

- **שתי שכבות זהות:** `profiles` (לוגין) ו-`employees` (HR). אפשר לתייק תלוש לפני הרשמה.
- **תפקיד ב-`memberships` / `firm_memberships` בלבד**, מועתק מההזמנה ב-trigger `handle_new_user`.
- **כסף:** `numeric(12,2)`. **תאריכים:** `date` ב-Postgres, מחרוזת ISO באפליקציה.
- **אין מחיקה קשה** של עובד: `status = 'terminated'`. בקשת חופשה עוברת ל-`cancelled`, לא DELETE.
- **חפיפת חופשה:** EXCLUDE gist על טווח תאריכים לבקשות `pending`/`approved` שאינן `unscheduled`.
- **ייחודיות תלוש:** `(period_id, employee_id)` + checksum לקובץ כפול.

הרחבות: `pg_trgm`, `btree_gist`, `citext`.

---

## 4. פעולות CRUD מרכזיות

| ישות | Create | Read | Update | Delete |
| --- | --- | --- | --- | --- |
| פרופיל | trigger בהרשמה | עצמי; עמיתים בהיקף מנהל/משרד | עצמי | cascade מ-auth |
| חברות בעסק | trigger הזמנה | עצמי, משרד | משרד (`is_active`) | משרד |
| עובד HR | הזמנה / משרד | עצמי, מנהלי העסק, משרד | משרד + RPCs של צוות | אין — terminate |
| תקופת שכר | משרד | חברי העסק | משרד | משרד אם אין שימוש |
| תלוש | משרד | עצמי published; מנהל אם שותף; משרד תמיד | עד נעילה | unassigned בלבד |
| בקשת חופשה | עצמי כ-pending | עצמי, מנהלי העסק, משרד | RPC בלבד | אין — cancel |
| מסמך | משרד; עובד רק 101 | בעלים, מנהל אם שותף, משרד | דגל שיתוף | משרד |
| צירוף לצוות | RPC | הצדדים + משרד | RPC בלבד | — |
| audit_log | RPCs | משרד | — | — |

פירוט מלא: [03-api.md](technical-design/03-api.md).

---

## 5. תיאור ה-API

חוזה אחיד לכל Action — לא זורקים מעל הגבול:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: ErrorCode; fieldErrors?: Record<string, string[]> };
```

מיפוי שגיאות Postgres: `42501` → forbidden, `23P01`/`23505` → conflict, `P0001`/`P0002` מה-RPC → כבר הוחלט / לא נמצא.

CSRF: POST של Server Action של Next.js. הרשאה: JWT + RLS. אין מפתח שרת שעוקף RLS.

---

## 6. לוגיקה עסקית מרכזית

**תובנות שכר** (`lib/domain/insights.ts`): רק חודשים שפורסמו. ממוצע 12 חודשים מוצג מ-3 חודשים ומעלה. CV של הנטו מסווג Stable / Some variation / Highly variable. השפה בממשק היא "deduction rate", לא "tax rate".

**ימי עבודה** (`lib/domain/working-days.ts`): שני הקצוות Inclusive; סופ״ש לפי `weekend_days` (ברירת מחדל שישי-שבת); חג מלא = 0, ערב חג = 0.5. הטופס מציג תצוגה מקדימה; ה-INSERT מחשב מחדש.

**יתרת חופשה:**

```
available = entitled + carried_over + adjustment − approved − pending
```

Pending צורך יתרה. אין cron צבירה. יתרה מתלוש יכולה להיכתב ל-entitlements בידי המשרד.

**מכונות מצבים** (סטטוס טרמינלי לא משתנה; שני קליקים מסתדרים עם `FOR UPDATE`):

- חופשה: pending → approved | rejected | cancelled
- צוות: pending → approved | rejected | cancelled
- תלוש: unassigned → assigned → published
- תקופה: draft → published → locked

**שידוך תלוש:** פענוח ה-PDF מציע שידוך לעובד לפי ת.ז. / מספר עובד. הקצאה בלי אישור אנושי אסורה — שכן חשיפת משכורת של עובד אחד לאחר היא התקלה החמורה ביותר במוצר.

---

## 7. ניהול State

אין Redux / Zustand לנתוני שרת.

| מצב | איפה הוא חי |
| --- | --- |
| תלושים, בקשות, יתרות | fetch ב-RSC + `revalidatePath` |
| חודש בלוח שנה | URL `?month=YYYY-MM` |
| שדות טופס | input native |
| סטטוס שליחה | `useActionState` / `useTransition` |
| יום נבחר, דיאלוגים | `useState` מקומי |
| סשן | עוגיות דרך Supabase SSR |

אישורים הם קליק + המתנה, לא undo אופטימי. החלטה שנייה על שורה שכבר הוחלטה חוזרת כ-conflict.

`DEV_AUTH_ROLE` ב-`.env.local` מדמה תפקיד לעבודת UI בלי סשן. ב-production מתעלמים ממנו. RLS עדיין רואה אנונימי — זה פותח layout, לא נתונים.

---

## 8. טיפול בשגיאות

| כשל | מה המשתמש רואה |
| --- | --- |
| Zod | שגיאות שדה מ-`fieldErrors` |
| RLS `42501` | "You do not have permission to do that." |
| חפיפה / ייחודיות | משפט conflict ספציפי |
| כבר הוחלט | conflict + הרשימה מתרעננת |
| שורה חסרה | `notFound()` או empty state |
| העלאה | שגיאת Action; אין שורת DB אם Storage נכשל קודם |

אין עדיין `loading.tsx` / `error.tsx` לכל מקטע. `EmptyState` תמיד מציין את הצעד הבא.

---

## 9. ולידציות קלט

שלוש שכבות. הלקוח נחשב עביר.

1. **דפדפן** — למשל השבתת שליחה אם הימים המבוקשים גדולים מהיתרה.
2. **Server Action + Zod** — הגבול שאנחנו סומכים עליו.
3. **Postgres** — CHECK, UNIQUE, EXCLUDE, enums, RPCs.

דוגמאות מהקוד:

- אימייל מנורמל; סיסמה מינימום 6; ת.ז. 7–9 ספרות.
- חופשה: UUID של סוג, תאריכי ISO, סוף ≥ התחלה, טווח ≤ 90 ימים, סיבה ≤ 500 תווים, דחייה מחייבת הערה.
- תלוש: שנה 2000–2100, חודש 1–12, נטו ≤ ברוטו, קובץ ≤ 10MB, magic bytes `%PDF`, עד 30 בקבוצה.
- מסמך: סוג מתוך enum, כותרת 2–160, MIME pdf/png/jpeg.
- `workingDays` ו-`employeeId` לא מתקבלים מהלקוח בבקשת חופשה.

---

## 10. תכנון חוויית המשתמש המרכזית

כל תפקיד נפתח עם שאלה אחת. דף הנחיתה עונה בלי קליק נוסף.

| תפקיד | השאלה | התשובה בדף הבית |
| --- | --- | --- |
| עובד | כמה הרווחתי, וכמה חופשה נשארה? | כרטיסי תובנות, יתרות, תלושים אחרונים |
| מנהל | מי מחכה לי, ומי בחופש? | מונה ממתינים, away החודש, התור |
| משרד | מה לא גמור? | תקופות לא מפורסמות, חופשות לאישור |

אישורים שמורים לפרסום חודש, סיום העסקה, ומחיקת עסק. ניווט לא מציג דלת נעולה. פירוט מסך-מסך: [06-ux.md](technical-design/06-ux.md).
