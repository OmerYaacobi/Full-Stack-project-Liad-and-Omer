# Frontend Design

## 1. Folder structure (as built)

```
app/
├── layout.tsx                      # lang="en", LTR, no Toaster
├── page.tsx                        # marketing; signed-in users redirect home
├── no-access/page.tsx
├── dashboard/page.tsx              # leftover firm dashboard; bookkeepers use /bookkeeper
├── (auth)/                         # login, verify, signup, invite/[token]
├── (app)/                          # AppShell + role layouts
│   ├── employee/                   # dashboard, payslips, documents, form-101, time-off
│   ├── manager/                    # overview, approvals, team, shared, calendar
│   └── bookkeeper/                 # queue, approvals, businesses, periods, documents
├── auth/callback/route.ts
├── auth/signout/route.ts
└── api/
    ├── payslips/[payslipId]/route.ts
    ├── payslips/parse/route.ts
    ├── documents/[documentId]/route.ts
    └── time-off/attachments/[attachmentId]/route.ts

components/
├── layout/                         # AppShell, SideNav, RoleBadge
├── insights/                       # PayInsightCards, NetPayTrend (SVG, not Recharts)
├── payslips/                       # upload, list, share, smart bulk upload
├── time-off/                       # RequestForm, ApprovalCard, TeamCalendar, …
├── documents/                      # folders, upload, share
├── employees/                      # team join, terminate, assign manager
├── invites/                        # join-link card, invite panel
├── businesses/  periods/  form-101/  shared/  dashboard/

lib/
├── supabase/                       # server.ts, client.ts, session.ts
├── actions/                        # "use server"
├── validations/                    # Zod
├── domain/                         # working-days.ts, insights.ts
├── payslip/                        # parser.ts (Liad), match-employee.ts
├── auth/                           # context.ts, dev-auth.ts
├── env.ts  format.ts

types/app.ts                        # AppRole, membership, workspace
proxy.ts                            # session refresh (Next.js 16 proxy, not middleware.ts)
supabase/migrations/                # 0001_initial_schema.sql … 0012_company_join_links.sql
docs/
```

There is no `components/ui` shadcn kit, no `lib/queries/`, no
`types/database.ts`, and no `tests/` tree.

**Route groups by role.** `(app)/employee/*`, `(app)/manager/*`,
`(app)/bookkeeper/*` each have a layout that calls `requireRole`. Managers
are also allowed on employee routes (`["employee", "manager"]`) because
they have a personal workspace. Bookkeepers are not.

**`proxy.ts`** refreshes the Supabase cookie and sends anonymous visitors
to `/login`. It does not decide roles — that would need a database. Public
prefixes: `/login`, `/verify`, `/auth`, `/signup`, `/invite`.

## 2. The authenticated shell

`app/(app)/layout.tsx` calls `requireWorkspace()` once and passes
workspace + profile into `AppShell`. Role layouts then call `requireRole`.

`DEV_AUTH_ROLE` in `.env.local` can impersonate a role for UI work without
a session. Production builds ignore it. RLS still sees an anonymous
visitor, so queries return nothing — it unblocks layout, not data.

## 3. Component structure

Server Components by default. `"use client"` only for interactivity
(forms, toggles, calendar day click, bulk upload).

Employee dashboard (example):

```
EmployeeDashboardPage                 (server) payslips, balances, documents, team asks
├── IncomingTeamJoinList              (client) accept / decline
├── PayInsightCards                   (server)
├── NetPayTrend                       (client) SVG from a pre-shaped month array
├── LeaveBalanceCards                 (server)
├── PayslipList                       (server)
└── DocumentFolders                   (server)
```

Insights are shaped by `lib/domain/insights.ts`, never raw `payslips`
rows. There is no TanStack Table; lists are plain `<table>` / `<ul>`.
There is no toast library; action errors render inline.

## 4. State management

No Redux or Zustand for server data.

| State | Where it lives |
| --- | --- |
| Pay slips, requests, balances | RSC fetch + `revalidatePath` |
| Calendar month | URL `?month=YYYY-MM` |
| Form fields | native inputs |
| Submit status | `useActionState` / `useTransition` |
| Selected calendar day, dialogs | `useState` |
| Session | cookies via Supabase SSR |

Approvals are a click + `useTransition`, not optimistic undo. A second
decision on an already-decided row comes back as a conflict message.

## 5. Validation

1. **Client** — enough to disable submit (for example remaining days vs
   requested working days). Assumed defeatable.
2. **Server Action** — Zod `safeParse` before any write. Trusted boundary.
3. **Database** — CHECK, UNIQUE, EXCLUDE, enums, RPCs.

`workingDays` and `employeeId` are not accepted from the client on a
time-off submit; the server derives them. Leave dates are ISO date
strings, not `Date` objects, so a timezone cannot shift the calendar day.

Money is `numeric` in Postgres. The UI formats with
`Intl.NumberFormat("en-IL")` in `lib/format.ts`.

## 6. Error handling

| Failure | What the user sees |
| --- | --- |
| Zod | Inline field errors from `fieldErrors` |
| RLS `42501` | "You do not have permission to do that." |
| Overlap / unique | A specific conflict sentence |
| Already decided | Conflict + the list revalidates |
| Missing row | `notFound()` on some pages; empty states elsewhere |
| Upload | Action error, no DB row if Storage failed first |

There are no per-segment `loading.tsx` or `error.tsx` files yet. Empty
states always name the next step (`EmptyState`).

## 7. i18n and formatting

The UI is English, `dir="ltr"`. Locale on `profiles` can be `he` or `en`
but the chrome is not RTL. Leave dates are Postgres `date` values rendered
as UTC calendar days so "1 March" does not become 28 February in UTC-5.
