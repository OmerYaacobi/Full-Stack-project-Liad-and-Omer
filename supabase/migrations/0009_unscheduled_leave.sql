-- Unscheduled leave: spend remaining days (including fractions) without
-- occupying calendar dates. Dummy start/end are stored as today so existing
-- NOT NULL date columns stay valid; those rows are excluded from overlap.

alter table public.time_off_requests
  add column if not exists unscheduled boolean not null default false;

alter table public.time_off_requests
  drop constraint if exists no_overlapping_active_leave;

alter table public.time_off_requests
  add constraint no_overlapping_active_leave
  exclude using gist (
    employee_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status in ('pending', 'approved') and not unscheduled);

create unique index if not exists uniq_pending_unscheduled_leave
  on public.time_off_requests (employee_id, leave_type_id)
  where (unscheduled and status = 'pending');
