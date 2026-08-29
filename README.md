# SMB Payroll & Bookkeeping Portal

A web portal that lets small businesses share payroll data with their employees
without doing it over email. Three roles, one app:

- **Employee** — salary insights, leave balance, pay slips and forms, time-off
  requests, Form 101 upload.
- **Manager** — own employee workspace plus team overview, leave approvals, a
  calendar of who is away, and files shared with managers.
- **Bookkeeper** — a firm that manages several client businesses: upload and
  parse pay slips, publish months, file HR documents, approve leave when needed.

Final project for Internet Technologies, RUNI CS 2026.
Built by Liad Pilosof and Omer Yaacobi.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Database | Supabase Postgres with Row Level Security |
| Auth | Supabase Auth (password + magic link) |
| Files | Supabase Storage (private buckets) |
| Styling | Tailwind CSS 4 |
| Validation | Zod |
| Hosting | Vercel |

## Running locally

Requires Node.js 20 or later.

```bash
git clone https://github.com/LiadPilosof/Full-Stack-project-Liad-and-Omer.git
cd Full-Stack-project-Liad-and-Omer
npm install
cp .env.example .env.local   # then fill in the values, see below
npm run dev
```

The app runs at http://localhost:3000.

Apply SQL in `supabase/migrations/` in order (0001 through 0012) in the
Supabase SQL editor if the remote database is behind the repo.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm test` | Run automated unit test suite (20 tests) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck without emitting files |

## Environment variables

Copy `.env.example` to `.env.local` and fill in both values. `.env.local` is
gitignored and must never be committed.

| Variable | Where to find it | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API | The project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page, "anon" / "publishable" key | Safe in the browser |
| `DEV_AUTH_ROLE` | Optional, local only | `employee`, `manager`, or `bookkeeper` to skip login for UI work. Ignored in production. |

Two things to understand about these:

**The `NEXT_PUBLIC_` prefix is required.** Without it Next.js keeps the variable
server-only and the browser client receives `undefined`.

**The anon key is meant to be public.** It grants no permissions on its own —
every table has Row Level Security enabled, so Postgres decides what each
logged-in user can read. That is also why the `service_role` key must never be
added to this file: anything prefixed `NEXT_PUBLIC_` is compiled into the
JavaScript every visitor downloads, and `service_role` bypasses RLS entirely.
The app does not use `service_role` today.

## Project structure

```
app/                    App Router pages and layouts
  (app)/                Authenticated shell (employee, manager, bookkeeper)
  (auth)/               Login, signup, invite accept
  api/                  File open redirects and payslip parse
lib/
  actions/              Server Actions (mutations and reads)
  domain/               Pure leave-day and insight math
  payslip/              Digital payslip parser (Liad)
  supabase/             Server, browser, and session clients
  validations/          Zod schemas shared by forms and actions
proxy.ts                Session refresh on every request
supabase/migrations/    Postgres schema, RLS, RPCs (0001–0012)
docs/
  technical-design/     Architecture, schema, RLS, API, UX
  for-liad-role-security.md
```

Reads happen in Server Components using `lib/supabase/server.ts`, so payroll
figures are rendered into HTML on the server and never fetched by browser
JavaScript. `lib/supabase/client.ts` is used only for sign-in and sign-out, where
the library has to write the session cookie itself.

## Documentation

Course deliverables (Hebrew) live under [`docs/`](docs/README.md). Open
[`docs/presentation.html`](docs/presentation.html) in a browser for the 10–15
minute talk (arrow keys; `N` toggles speaker notes; print to PDF if needed).

| Assignment | File |
| --- | --- |
| אפיון מוצר | [docs/01-product-spec.md](docs/01-product-spec.md) |
| ארכיטקטורה | [docs/02-architecture.md](docs/02-architecture.md) |
| תכנון טכני מפורט | [docs/03-technical-plan.md](docs/03-technical-plan.md) |
| אפיון בדיקות | [docs/04-test-spec.md](docs/04-test-spec.md) |
| תיעוד בדיקות | [docs/05-test-report.md](docs/05-test-report.md) |
| סקייל בסיסי | [docs/06-scale.md](docs/06-scale.md) |
| אבטחה בסיסית | [docs/07-security.md](docs/07-security.md) |
| מצגת | [docs/presentation.html](docs/presentation.html) |

English technical-design set (schema, RLS, API, UX):

| Document | Contents |
| --- | --- |
| [Overview](docs/technical-design/00-overview.md) | Scope, stack, roles, permission matrix |
| [Database](docs/technical-design/01-database.md) | Schema, constraints, indexes |
| [Row Level Security](docs/technical-design/02-rls.md) | Policies for all three roles, Storage rules |
| [API](docs/technical-design/03-api.md) | Server Actions, Route Handlers, RPCs |
| [Frontend](docs/technical-design/04-frontend.md) | Folder structure, components, state, errors |
| [Business logic](docs/technical-design/05-business-logic.md) | Salary maths, leave accounting, state machines |
| [UX](docs/technical-design/06-ux.md) | Screen-by-screen design per role |
| [Role security](docs/for-liad-role-security.md) | Why role must not live in `user_metadata` |

## Status

The three role flows are in use: invite-only employee/manager signup, firm
bookkeepers managing several businesses, pay slips (including PDF parse), time
off with company-wide approval, team join by consent, Form 101, documents, and
a manager leave calendar. Schema changes after 0001 live in
`supabase/migrations/` and must be applied on the Supabase project.
