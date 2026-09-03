# Presentation — PayrollPortal

**Course:** Internet Technologies, RUNI CS 2026  
**Presenters:** Liad Pilosof and Omer Yaacobi  
**Length:** 10–15 minutes, 12 slides  

Slides: [presentation.html](presentation.html)  
Open in a browser. Arrow keys or space to move. Press `N` for speaker notes.

Use the same names throughout: **employee**, **manager**, **firm** (bookkeeper).

---

## 1. Opening — 45 seconds

PayrollPortal. A payroll portal for bookkeeping firms and their client businesses.  
Liad Pilosof and Omer Yaacobi.  
Next.js, TypeScript, Supabase, Vercel.

No demo yet. Start with the problem.

---

## 2. The problem — 1 minute

Payroll is already calculated at the firm. What breaks is everything after that:

- An employee asks for a pay slip or Form 106 on WhatsApp, and the firm sends PDFs one by one.
- A manager approves vacation in a spreadsheet, with no balance and no view of who else is away.
- Nobody can answer “how much was deducted from me this year?” without opening a pile of files.
- A firm with several clients keeps folders, with no clear permission split.

We do not replace the payroll engine. We replace the email chain.

---

## 3. Users and customer — 45 seconds

The customer is **the firm**. It brings several businesses, uploads slips, and invites staff.

The users are employee, manager, and bookkeeper.  
A manager is also an employee — personal pay, plus a team.  
An employee sees only their company. The firm sees its own clients, not another firm’s.

---

## 4. Business value — 1 minute

- **Firm:** many slips at once, a suggested match by ID number, publish a month in one click.
- **Employee:** slip, leave balance, and Form 101 without messaging the firm.
- **Manager:** an approval queue with balances, and a calendar of who is away.
- **Everyone:** drafts stay hidden. A manager sees another person’s file only if it is shared. Role comes from the invite.

---

## 5. The product — 90 seconds

Three screens, one app:

- **Employee** — pay summary, balances, slips, documents, time off, Form 101.
- **Manager** — the same personal area, plus approvals, team by consent, shared files, calendar.
- **Bookkeeper** — several businesses, draft then publish a month, PDF parse, and leave approval when no manager is there.

If there is time: a short demo — publish as the firm, then show what the employee sees.

---

## 6. Architecture — 90 seconds

Browser → the app on Vercel → Supabase (auth, data, files).

- Payroll loads on the server with the page, not in browser JavaScript.
- Form writes are checked on the server. There is no public table API.
- Leave approval and month publish run in the database, so two clicks cannot overwrite each other.
- Files are private. Download links expire after about two minutes.
- No superuser key in the app. The database decides what each user sees.

Line to remember: even without our website, an employee using their own login still cannot read someone else’s salary.

---

## 7. Database — 1 minute

- Who signs in: a profile, membership in a company, membership in a firm.
- Payroll: a month and a slip — one slip per employee per month.
- Leave: entitlements and requests. The database blocks overlapping days.
- Files filed to one person. Sharing with managers is per file.
- Team: a manager asks, the employee accepts.

Role comes from the invite. The user cannot change it in their profile in the browser.

If they ask how it connects: firm → companies → employees → pay slips and leave.

---

## 8. Core flows — 90 seconds

1. **Publish a month** — draft, upload, suggested match, human confirm, publish. Before that the employee sees empty.
2. **Time off** — the server counts working days. Pending uses the balance. A manager or the firm decides. You cannot approve yourself.
3. **Team** — a manager asks, the employee accepts. Removing from a team is not termination.

---

## 9. Tests — 45 seconds

The product works if:

- Publish, time off, and join-a-team succeed (checked by hand).
- An employee cannot see another’s pay, write payroll, or approve themselves.
- Bad input is rejected without a crash.
- Working days, pay summaries, and input rules run in `npm test` — 22 tests.

Missing: automated browser tests, and automated permission tests against the database. Say that plainly.

---

## 10. Scale — 1 minute

Tens to hundreds of users, not millions.

What holds: indexes by company and employee, payroll on the server, at most 30 PDFs, calendar by month.

What breaks first: the firm-wide document cabinet, and heavy PDF parsing in the same request.

An employee opening their own slip is cheap. The load is the firm uploading and listing everything at once.

---

## 11. Security — 90 seconds

Four layers. The real boundary is the database:

1. No session, no private app.
2. The wrong role’s page sends you home.
3. The server checks input.
4. The database — even without our website, an employee cannot see someone else’s salary.

Role lives in our table, not in a field the user can edit.  
Still open: a leaked manager invite link, no two-factor for the firm.

If they ask one question: why role is not in user-editable profile metadata. That is the strong story.

---

## 12. Close — 1 minute

GitHub: `LiadPilosof/Full-Stack-project-Liad-and-Omer`  
Live app on Vercel. Docs in `docs/`.

Live URL, a demo if you have not done one yet, then questions.
