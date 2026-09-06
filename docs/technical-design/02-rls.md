# Row Level Security

The rule we hold ourselves to: **if every line of TypeScript in this repo were
deleted and replaced with a raw Postgres connection using a valid employee
JWT, that employee still could not read anyone else's salary.**

Policies live in `supabase/migrations/`. This page describes the posture as
built after `0012`.

## 1. Baseline posture

RLS is enabled on every public table that holds tenant data (profiles,
companies, memberships, employees, payroll, leave, documents, invitations,
team join requests, audit log, firm tables). Enabled with no policy is
deny-all. `anon` gets almost nothing: invitation token lookup and the
company name on an invite page are the exceptions.

## 2. Helper functions

Policies need to answer "what is this user allowed to do here?" without
recursing. Helpers live in schema `app`, `security definer`, with
`search_path` pinned to `public, pg_temp`.

| Function | Meaning |
| --- | --- |
| `app.has_role(company, roles)` | Active `memberships` row for `auth.uid()` |
| `app.my_employee_id(company)` / `app.my_employee_ids()` | HR rows linked to this login |
| `app.manages_employee(employee)` | Direct line manager (`employees.manager_id`) |
| `app.can_decide_time_off(employee)` | May approve/reject that person's leave: a manager or bookkeeper at the company, and not the requester themselves (`0006`) |

`(select auth.uid())` is used so Postgres evaluates the uid once per
statement.

`manages_employee` is still **one hop**. A director does not inherit every
salary under them. Company-wide *visibility* for managers was added later
(`employees_select_company_manager`, and the same idea on requests and
entitlements) so any manager at the business can plan leave — that is
deliberately wider than `manages_employee`.

## 3. Policies by area

### Identity and tenancy

- `profiles`: self select/update; colleagues visible to managers/bookkeepers
  who can already see that HR row.
- `memberships`: own row, plus bookkeeper of that company.
- `companies`: members, or a firm bookkeeper via `firm_id`, or anyone holding
  a live invite token (so `/invite/[token]` can show the company name).
- `invitations`: bookkeepers write; an unused/reusable token is readable
  enough to accept the invite.
- `bookkeeping_firms` / `firm_memberships`: the signed-in bookkeeper's firm.

### Employees

Select if you are that person, their line manager, a **company manager**, a
bookkeeper of the company, or they have a pending team-join request toward
you (so you can see who asked). Writes are bookkeeper-only, except RPCs
that set `manager_id` (team join, remove from team).

### Pay slips and periods

Members can read periods. Only bookkeepers write them.

Pay slips:

- Own row, and only `status = 'published'`
- Another person's published row if `visible_to_managers` and the reader is
  a manager at that company
- Line-manager policy from 0001 still exists for published slips
- Bookkeeper sees drafts too

`payslip_components` visibility follows the parent slip (`exists` into
`payslips`, so RLS on the parent cannot drift).

`file_path` on a row is not a download grant. Storage policies and signed
URLs are checked separately.

### Leave

Leave types and holidays: members read, bookkeepers write.

Entitlements: self, line manager, any company manager, bookkeeper.

Time-off requests: self, line manager, any company manager, bookkeeper.
Employees insert only their own row as `pending`. **There is no update or
delete policy**; `revoke update, delete` on the table. Status changes go
through `decide_time_off` and `cancel_time_off`.

`decide_time_off` (after `0006`) uses `app.can_decide_time_off`, not only
`app.manages_employee`. It row-locks, refuses non-pending rows, sets
`decided_by` from `auth.uid()`, and writes `audit_log` in the same
transaction. Bookkeepers can decide client-company requests. You cannot
decide your own.

### Documents

- Owner (the employee the file is filed to)
- Company manager if `visible_to_managers`
- Bookkeeper of the company
- Insert: bookkeeper for any kind; the employee only for `form_101` on
  their own row (`0010`)

### Team join

Select: the employee asked, the manager who asked, bookkeeper. No direct
insert/update/delete for `authenticated`. RPCs: `request_direct_report`,
`decide_team_join`, `cancel_team_join_request`.

### Audit log

Bookkeepers may select. Inserts come from RPCs only.

## 4. Storage

Private buckets: `payslips`, `documents`, `time_off`. Nothing is public.
Keys encode tenancy, for example:

```
payslips/{company_id}/{employee_id}/...
documents/{company_id}/{employee_id}/{kind}/...
time_off/{company_id}/{employee_id}/{request_id}/...
```

Reads: the employee whose id is in the path, a bookkeeper of that company,
or a manager when the matching database row is shared. Writes: bookkeepers
inside companies they manage; employees may write Form 101 objects under
their own id (`0010`). Time-off attachments: the requester on insert.

Downloads go through Server Actions that re-check a table read, then mint a
signed URL (~120 seconds). A URL pasted into a chat dies quickly.
`file_size_limit` and `allowed_mime_types` on the bucket stop huge or
wrong-typed files before application code runs.

## 5. What we do not have yet

There is no `tests/rls/` suite in the repo. The original adversarial cases
(employee A cannot read B, cannot self-approve, unpublished slips stay
hidden, overlapping leave hits `23P01`, `anon` sees nothing) are still the
right tests to add. Until they exist, treat a missing policy as the failure
mode that shows up as an empty list rather than an exception.
