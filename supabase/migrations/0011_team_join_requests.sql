-- Manager asks to add someone to their team; that person must accept before
-- manager_id changes. Bookkeepers can still assign a line manager directly.
--
-- Run this in the Supabase SQL editor after 0010. Without it, asking someone
-- onto a team still assigns them immediately.

create table if not exists public.team_join_requests (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  manager_id  uuid not null references public.employees(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  check (manager_id is distinct from employee_id),
  check ((status = 'pending') = (decided_at is null))
);

create index if not exists idx_team_join_employee_pending
  on public.team_join_requests (employee_id)
  where status = 'pending';

create unique index if not exists uniq_pending_team_join
  on public.team_join_requests (manager_id, employee_id)
  where status = 'pending';

alter table public.team_join_requests enable row level security;

drop policy if exists "team_join_select_employee" on public.team_join_requests;
create policy "team_join_select_employee" on public.team_join_requests
  for select to authenticated
  using (employee_id in (select app.my_employee_ids()));

drop policy if exists "team_join_select_manager" on public.team_join_requests;
create policy "team_join_select_manager" on public.team_join_requests
  for select to authenticated
  using (manager_id in (select app.my_employee_ids()));

drop policy if exists "team_join_select_bookkeeper" on public.team_join_requests;
create policy "team_join_select_bookkeeper" on public.team_join_requests
  for select to authenticated
  using (app.has_role(company_id, array['bookkeeper']::app_role[]));

-- So the employee can read the manager's name on a request to them.
drop policy if exists "employees_select_join_requester" on public.employees;
create policy "employees_select_join_requester" on public.employees
  for select to authenticated
  using (
    exists (
      select 1
      from public.team_join_requests r
      where r.manager_id = employees.id
        and r.employee_id in (select app.my_employee_ids())
        and r.status = 'pending'
    )
  );

grant select on public.team_join_requests to authenticated;
revoke insert, update, delete on public.team_join_requests from authenticated;
revoke all on public.team_join_requests from anon;

create or replace function public.request_direct_report(p_employee_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  emp public.employees;
  my_id uuid;
begin
  select * into emp from public.employees where id = p_employee_id for update;
  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not app.has_role(emp.company_id, array['manager']::app_role[]) then
    raise exception 'NOT_A_MANAGER' using errcode = '42501';
  end if;

  my_id := app.my_employee_id(emp.company_id);
  if my_id is null then
    raise exception 'NOT_A_MANAGER' using errcode = '42501';
  end if;

  if my_id = p_employee_id then
    raise exception 'CANNOT_MANAGE_SELF' using errcode = '23514';
  end if;

  if emp.status = 'terminated' then
    raise exception 'ALREADY_REMOVED' using errcode = 'P0001';
  end if;

  if emp.manager_id is not distinct from my_id then
    raise exception 'ALREADY_ON_TEAM' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.team_join_requests
    where manager_id = my_id
      and employee_id = p_employee_id
      and status = 'pending'
  ) then
    raise exception 'ALREADY_PENDING' using errcode = 'P0001';
  end if;

  insert into public.team_join_requests (company_id, manager_id, employee_id)
  values (emp.company_id, my_id, p_employee_id);

  insert into public.audit_log (company_id, actor_profile_id, action, entity, entity_id, diff)
  values (
    emp.company_id,
    (select auth.uid()),
    'employee.request_report',
    'employees',
    p_employee_id,
    jsonb_build_object('manager_id', my_id)
  );
exception
  when unique_violation then
    raise exception 'ALREADY_PENDING' using errcode = 'P0001';
end;
$$;

grant execute on function public.request_direct_report(uuid) to authenticated;

create or replace function public.decide_team_join(p_request_id uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare r public.team_join_requests;
begin
  select * into r from public.team_join_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  if r.employee_id not in (select app.my_employee_ids()) then
    raise exception 'NOT_YOUR_REQUEST' using errcode = '42501';
  end if;

  if r.status <> 'pending' then
    raise exception 'ALREADY_DECIDED' using errcode = 'P0001';
  end if;

  if p_approve and not exists (
    select 1 from public.employees
    where id = r.employee_id
      and status <> 'terminated'
  ) then
    raise exception 'ALREADY_REMOVED' using errcode = 'P0001';
  end if;

  update public.team_join_requests
    set status = case when p_approve then 'approved' else 'rejected' end,
        decided_at = now()
  where id = p_request_id;

  if p_approve then
    update public.employees
      set manager_id = r.manager_id
    where id = r.employee_id;
  end if;

  insert into public.audit_log (company_id, actor_profile_id, action, entity, entity_id, diff)
  values (
    r.company_id,
    (select auth.uid()),
    case when p_approve then 'employee.accept_manager' else 'employee.decline_manager' end,
    'team_join_requests',
    p_request_id,
    jsonb_build_object('manager_id', r.manager_id)
  );
end;
$$;

grant execute on function public.decide_team_join(uuid, boolean) to authenticated;

create or replace function public.cancel_team_join_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare r public.team_join_requests;
begin
  select * into r from public.team_join_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  if r.manager_id not in (select app.my_employee_ids()) then
    raise exception 'NOT_YOUR_REQUEST' using errcode = '42501';
  end if;

  if r.status <> 'pending' then
    raise exception 'ALREADY_DECIDED' using errcode = 'P0001';
  end if;

  update public.team_join_requests
    set status = 'cancelled',
        decided_at = now()
  where id = p_request_id;
end;
$$;

grant execute on function public.cancel_team_join_request(uuid) to authenticated;

-- Old clients called this to assign immediately. Asking is the only path now.
create or replace function public.claim_direct_report(p_employee_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform public.request_direct_report(p_employee_id);
end;
$$;

-- Drop leftover pending asks when HR assigns a manager or someone leaves.
create or replace function public.cancel_pending_team_joins()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.manager_id is distinct from old.manager_id then
    update public.team_join_requests
      set status = 'cancelled',
          decided_at = now()
    where employee_id = new.id
      and status = 'pending';
  end if;

  if tg_op = 'UPDATE' and new.status = 'terminated' and old.status is distinct from 'terminated' then
    update public.team_join_requests
      set status = 'cancelled',
          decided_at = now()
    where status = 'pending'
      and (employee_id = new.id or manager_id = new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cancel_pending_team_joins on public.employees;
create trigger trg_cancel_pending_team_joins
after update of manager_id, status on public.employees
for each row execute function public.cancel_pending_team_joins();
