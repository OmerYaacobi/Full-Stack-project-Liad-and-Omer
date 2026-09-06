# API Design — Server Actions, Route Handlers, RPCs

## 1. When to use which

| Mechanism | Used for | Why |
| --- | --- | --- |
| **Server Component data fetching** | every read that renders a page | No client-side fetch; payroll data stays out of the JS bundle |
| **Server Action** | mutations and some reads triggered from the UI | CSRF via the Next.js action POST, `revalidatePath` in the same trip |
| **Route Handler** | file open (HTTP redirect), PDF parse, auth callback | Needs real HTTP: `307`, streaming, query bodies |
| **Postgres RPC** | state machines | Row locks and multi-statement atomicity (see `02-rls.md`) |

We do **not** expose a public REST CRUD API. The browser talks to Server
Actions; PostgREST is used only through the user-scoped Supabase client,
which is already guarded by RLS.

## 2. The action contract

Actions do not throw across the boundary. They return:

```ts
// lib/actions/result.ts
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: ErrorCode; fieldErrors?: Record<string, string[]> };
```

There is no shared `wrap.ts` middleware. Each `"use server"` file calls
`safeParse`, `createClient()`, and `fail()` / `fromZod()` itself. Postgres
errors are mapped in the same files (`42501` → forbidden, `23P01` /
`23505` → conflict, RPC `P0001`/`P0002` → already decided / not found).

## 3. Actions by domain

All live under `lib/actions/`.

### Auth (`auth.ts`)

| Action | Effect |
| --- | --- |
| `signIn` | Password or magic link, then redirect to the role home |

Bookkeeper and invite signup live in the `(auth)` pages and call
`supabase.auth.signUp` with metadata (`signup_type`, `invitation_token`,
national id). The trigger writes the real role.

### Time off (`time-off.ts`)

| Action | Notes |
| --- | --- |
| `previewTimeOff` / `submitTimeOffRequest` | Recomputes working days server-side. Optional remaining-day (`unscheduled`) path. Attachments allowed. |
| `cancelTimeOffRequest` | RPC `cancel_time_off` |
| `approveTimeOffRequest` / `rejectTimeOffRequest` | RPC `decide_time_off`; reject requires a note |
| `listPendingApprovals` / `listFirmPendingApprovals` | Manager vs bookkeeper queues; overlap warning |
| `listDirectReportSummaries` / `managerOverviewStats` | Team table and overview cards |
| `listManagerCalendar` | Approved + pending dated leave for the month |

### People (`employees.ts`)

| Action | Notes |
| --- | --- |
| `requestDirectReport` | RPC — creates a team-join request |
| `decideTeamJoin` / `cancelTeamJoinRequest` | Employee accepts/declines; manager can cancel the ask |
| `removeDirectReport` | RPC — `manager_id = null` only |
| `setEmployeeManager` | Bookkeeper assigns a line manager directly |
| `terminateEmployee` | RPC — status `terminated`, keeps pay history |
| `applyPayslipLeaveBalances` | Writes remaining days from a parsed slip onto entitlements |

### Businesses and invites (`businesses.ts`, `invitations.ts`)

| Action | Notes |
| --- | --- |
| `createBusiness` / `listFirmBusinesses` / `removeCompany` | Firm bookkeeper |
| `getOrCreateCompanyJoinLink` / `rotateCompanyJoinLink` | Reusable employee and manager URLs |
| `createInvitationLink` / `listBusinessInvitations` | One-time personal invites |

### Payroll (`periods.ts`, `payslips.ts`, `parse-payslip.ts`)

| Action | Notes |
| --- | --- |
| `openPayrollPeriod` / `ensurePayrollPeriod` / `publishPayrollPeriod` | Publish is an RPC so period + slips flip together |
| `uploadPayslip` | MIME, size, `%PDF` magic bytes, checksum |
| `parsePayslipAction` | Server parse; matching is a suggestion |
| `setPayslipManagerShare` / `getPayslipOpenUrl` | Per-file share; signed URL |

### Documents (`documents.ts`)

| Action | Notes |
| --- | --- |
| `uploadDocument` | Bookkeeper; always an `employeeId` |
| `uploadOwnForm101` / `storeEmployeeForm101` | Employee Form 101 |
| `listFirmDocuments` / `listMyDocuments` / `listDocumentsSharedWithManagers` | Cabinets |
| `setDocumentManagerShare` / `getDocumentDownloadUrl` | Share + signed URL |

## 4. Route Handlers

| Route | Method | Purpose |
| --- | --- | --- |
| `/auth/callback` | GET | Exchange auth code for a session cookie, redirect home |
| `/auth/signout` | POST | Clear the session |
| `/api/payslips/[payslipId]` | GET | `307` to a signed URL after `getPayslipOpenUrl` |
| `/api/documents/[documentId]` | GET | Same for documents |
| `/api/time-off/attachments/[attachmentId]` | GET | Same for leave attachments |
| `/api/payslips/parse` | POST | Multipart PDF → parser (used by bulk upload) |

There is **no** `/api/cron/accrue-leave` and **no** `/api/health` in the
repo. Entitlements are seeded (`ensure_my_leave_entitlements` /
`seed_leave_entitlements`) and can be adjusted from a parsed pay slip.

## 5. RPCs (state machines)

| RPC | Who | Effect |
| --- | --- | --- |
| `decide_time_off` | company manager or bookkeeper | pending → approved/rejected |
| `cancel_time_off` | the requester | pending → cancelled |
| `publish_payroll_period` | bookkeeper | draft → published, slips published |
| `request_direct_report` | manager | pending team-join row |
| `decide_team_join` | the employee | sets `manager_id` on accept |
| `cancel_team_join_request` | the manager who asked | pending → cancelled |
| `remove_direct_report` | that line manager | `manager_id = null` |
| `terminate_employee` | bookkeeper | `status = terminated` |
| `remove_company` | bookkeeper | drops a client business |
| `get_invitation_by_token` | invite page | safe token lookup |
| `ensure_my_leave_entitlements` | employee | creates this year's rows |

## 6. CRUD matrix (after RLS)

| Entity | Create | Read | Update | Delete |
| --- | --- | --- | --- | --- |
| `profiles` | auth trigger | self, colleagues already in scope | self | cascade from auth user |
| `memberships` | invite trigger / bookkeeper | self, bookkeeper | bookkeeper | bookkeeper |
| `employees` | invite trigger / bookkeeper | self, company managers, bookkeeper | bookkeeper + team RPCs | — (`terminated`) |
| `invitations` | bookkeeper / company trigger | bookkeeper, token holder | bookkeeper | bookkeeper |
| `team_join_requests` | RPC | parties + bookkeeper | RPC only | — |
| `payroll_periods` | bookkeeper | members | bookkeeper | bookkeeper if unused |
| `payslips` | bookkeeper | own published; managers if shared; bookkeeper always | bookkeeper until locked | unassigned only |
| `time_off_requests` | self, pending | self, company managers, bookkeeper | RPC only | — (`cancelled`) |
| `documents` | bookkeeper; employee Form 101 | owner, shared managers, bookkeeper | share toggle | bookkeeper |
| `audit_log` | RPCs | bookkeeper | — | — |

Patterns that still hold: almost nothing is hard-deleted; employees do not
write payroll; time-off and team-join status changes are RPC-only.
