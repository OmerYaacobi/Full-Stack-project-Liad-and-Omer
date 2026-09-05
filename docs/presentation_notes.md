# Presentation Script — PayrollPortal

**Course:** Internet Technologies, RUNI CS 2026  
**Presenters:** Liad Pilosof and Omer Yaacobi  
**Length:** 10–15 minutes, 12 slides  

*Note: Use arrow keys or space to move. Press `N` for speaker notes.*

---

## 1. Opening (45s)
**"Welcome to PayrollPortal."** 
We built a payroll portal designed for bookkeeping firms and their client businesses. 
*Tech Stack:* Next.js, TypeScript, Supabase, Vercel. 
*(No demo yet. Hook the audience with the problem first).*

## 2. The Problem (1m)
Payroll is already calculated effectively at the firm. What breaks is everything that happens *after* that:
* Employees ask for a pay slip or Form 106 on WhatsApp, and the firm sends PDFs one by one.
* Managers approve vacations in a spreadsheet, with no live balance and no view of who else is away.
* Nobody can answer “how much was deducted from me this year?” without opening a pile of files.
* A firm with several clients relies on local folders, with no clear permission split.
**Our Goal:** We do not replace the payroll engine. We replace the messy email chain.

## 3. Users and Customer (45s)
The primary customer is **the firm (bookkeeper)**. It brings several businesses, uploads slips, and invites staff.
The users in the system are:
* **Employee:** Sees only their company data.
* **Manager:** Is also an employee (personal pay) + has team oversight.
* **Bookkeeper:** Manages multiple businesses, but sees only its own clients, never another firm’s.

## 4. Business Value (1m)
* **Firm:** Upload many slips at once, get a suggested match by ID number, and publish a full month in one click.
* **Employee:** Get instant access to slips, live leave balances, and Form 101 without messaging the firm.
* **Manager:** Access an approval queue with live balances, and a team calendar.
* **Security for Everyone:** Drafts stay hidden. Managers see another person’s file only if it is explicitly shared. Roles are strictly derived from the invite token.

## 5. The Product (90s)
Three distinct screens within one app:
* **Employee:** Pay summary, balances, slips, documents, time off, Form 101.
* **Manager:** The same personal area, plus approvals, team by consent, shared files, team calendar.
* **Bookkeeper:** Global queue for several businesses, draft/publish a month, PDF parsing, and leave approval when no manager is assigned.
*(Insert short demo here: Publish as the firm, then switch to show what the employee sees).*

## 6. Architecture (90s)
`Browser → Next.js (Vercel) → Supabase (Auth, DB, Storage)`
* Payroll loads natively on the server with the page, not via exposed browser JavaScript API.
* Form writes are validated strictly on the server.
* Leave approval and month publishing run as RPCs in the database, ensuring two clicks cannot overwrite each other.
* Files are completely private. Download links expire after ~120 seconds.
* **Key Takeaway:** There is no superuser (`service_role`) key in the app. The database entirely decides what each user sees. Even if someone bypassed our website, an employee using their own login still cannot read someone else’s salary.

## 7. Database & RLS (1m)
* **Identities:** A profile, membership in a company, membership in a firm.
* **Payroll:** One slip per employee per month.
* **Leave:** Entitlements and requests. The database actively blocks overlapping days via Exclusion Constraints.
* **Files:** Filed to one person. Sharing with managers is per file.
* **Team:** A manager asks, the employee accepts.
*Role comes from the invite. The user cannot manipulate it via browser metadata.*

## 8. Core Flows (90s)
1. **Publish a month:** Draft → Upload → Suggested match → Human confirm → Publish. (Employees see empty state until published).
2. **Time off:** The server counts working days (excluding weekends/holidays). Pending status immediately deducts from the balance. A manager or the firm decides. You cannot approve yourself.
3. **Team:** A manager asks, the employee accepts. Removing from a team is just a status change, not data termination.

## 9. Tests (45s)
The product meets the definition of "working":
* **E2E Flows:** Publish, time off, and join-a-team succeed (checked manually).
* **Security:** An employee cannot see another’s pay, write payroll, or approve themselves. Bad input is rejected without a crash.
* **Automated:** Working days math, pay summaries, and Zod input rules run in `npm test` (22 passing tests).
*(Acknowledge limitations: Mention plainly that automated browser UI tests and automated RLS DB tests are not included).*

## 10. Scale (1m)
Designed for tens to hundreds of users per firm, not millions.
* **What holds well:** Indexes by company and employee, Server Components handling payroll, at most 30 PDFs per upload, and calendar fetched by month.
* **What breaks first:** The firm-wide document cabinet (needs pagination), and heavy synchronous PDF parsing in the same request.
* **Load Analysis:** An employee opening their own slip is incredibly cheap (indexed lookup). The heaviest load is the firm uploading and listing everything at once.

## 11. Security (90s)
Four layers of defense. The real boundary is the database (RLS):
1. **Routing:** No session, no private app.
2. **UI Guards:** The wrong role’s page sends you home.
3. **Server Validation:** The server strictly checks input (Zod).
4. **Database (RLS):** Even without our website, an employee cannot see someone else’s salary.
*(Highlight: Role lives in our backend table, not in a field the user can edit).*

## 12. Close (1m)
* **GitHub:** `LiadPilosof/Full-Stack-project-Liad-and-Omer`
* **Live App:** Deployed on Vercel. 
* **Documentation:** PRD, Tech Design, Test Plan, and Scale/Security docs are in the `docs/` folder.
*(Show Live URL, open floor for questions).*
