-- Time off: line manager on invite, and leave days for new and existing people.
--
-- Run this in the Supabase SQL editor after 0003. Without it, invitation
-- manager_id is rejected and employees have no entitlement rows, so the
-- balance view is empty.

alter table public.invitations
  add column if not exists manager_id uuid references public.employees(id) on delete set null;

create index if not exists idx_invitations_manager on public.invitations(manager_id)
  where manager_id is not null;

-- The invited person's manager must work at the same business.
create or replace function public.check_invitation_manager()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.manager_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.employees e
    where e.id = new.manager_id
      and e.company_id = new.company_id
  ) then
    raise exception 'MANAGER_WRONG_COMPANY' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invitation_manager on public.invitations;
create trigger trg_invitation_manager
before insert or update on public.invitations
for each row execute function public.check_invitation_manager();

-- Same-company rule for an existing employee's line manager.
create or replace function public.check_employee_manager()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.manager_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.employees e
    where e.id = new.manager_id
      and e.company_id = new.company_id
  ) then
    raise exception 'MANAGER_WRONG_COMPANY' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_employee_manager on public.employees;
create trigger trg_employee_manager
before insert or update on public.employees
for each row execute function public.check_employee_manager();

-- Grant this year's leave days from each active leave type. Idempotent.
create or replace function public.seed_leave_entitlements(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company uuid;
  v_start date;
  v_year smallint := extract(year from current_date)::smallint;
begin
  select company_id, start_date into v_company, v_start
  from public.employees
  where id = p_employee_id;
  if not found then
    return;
  end if;

  insert into public.leave_entitlements (
    company_id, employee_id, leave_type_id, year, entitled_days
  )
  select
    lt.company_id,
    p_employee_id,
    lt.id,
    v_year,
    case
      when lt.accrual_days_per_month <= 0 then 0
      else round(
        lt.accrual_days_per_month * (
          13 - extract(month from greatest(v_start, make_date(v_year, 1, 1)))::int
        ),
        2
      )
    end
  from public.leave_types lt
  where lt.company_id = v_company
    and lt.is_active
  on conflict (employee_id, leave_type_id, year) do nothing;
end;
$$;

revoke all on function public.seed_leave_entitlements(uuid) from public, anon, authenticated;

-- An employee opening Time off can grant their own missing rows for this year.
create or replace function public.ensure_my_leave_entitlements()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare emp uuid;
begin
  for emp in select app.my_employee_ids() loop
    perform public.seed_leave_entitlements(emp);
  end loop;
end;
$$;

grant execute on function public.ensure_my_leave_entitlements() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_full_name text;
  v_phone text;
  v_signup_type text;
  v_firm_name text;
  v_tax_id text;
  v_national_id text;
  v_firm_id uuid;
  v_invitation_token text;
  v_invitation record;
  v_membership_id uuid;
  v_employee_num text;
  v_employee_id uuid;
begin
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  if length(btrim(v_full_name)) < 2 then
    v_full_name := 'New User';
  end if;
  v_phone := new.raw_user_meta_data->>'phone';
  v_signup_type := coalesce(new.raw_user_meta_data->>'signup_type', 'worker');
  v_firm_name := new.raw_user_meta_data->>'firm_name';
  v_tax_id := new.raw_user_meta_data->>'tax_id';
  v_national_id := coalesce(new.raw_user_meta_data->>'national_id', new.raw_user_meta_data->>'id_number');
  v_invitation_token := new.raw_user_meta_data->>'invitation_token';

  insert into public.profiles (id, full_name, email, phone, locale, national_id)
  values (new.id, v_full_name, new.email, v_phone, 'en', v_national_id)
  on conflict (id) do update
  set full_name = excluded.full_name,
      phone = coalesce(excluded.phone, profiles.phone),
      national_id = coalesce(excluded.national_id, profiles.national_id);

  if v_signup_type = 'bookkeeper' and v_tax_id is not null and length(btrim(v_tax_id)) > 0 then
    v_firm_name := coalesce(v_firm_name, 'My Bookkeeping Firm');

    insert into public.bookkeeping_firms (name, tax_id)
    values (v_firm_name, v_tax_id)
    on conflict (tax_id) do update set name = excluded.name
    returning id into v_firm_id;

    insert into public.firm_memberships (firm_id, profile_id, role, is_active)
    values (v_firm_id, new.id, 'bookkeeper', true)
    on conflict (firm_id, profile_id) do update set is_active = true;

  elsif v_invitation_token is not null and length(btrim(v_invitation_token)) > 0 then
    select * into v_invitation
    from public.invitations
    where token = v_invitation_token
      and used_at is null
      and expires_at > now()
    for update;

    if found then
      insert into public.memberships (company_id, profile_id, role, is_active, invited_by)
      values (v_invitation.company_id, new.id, v_invitation.role, true, v_invitation.created_by)
      on conflict (company_id, profile_id) do update set role = v_invitation.role, is_active = true
      returning id into v_membership_id;

      -- Prefer ת.ז as the employee number so pay-slip matching can find them.
      v_employee_num := coalesce(v_national_id, new.raw_user_meta_data->>'employee_number', substr(md5(random()::text), 1, 6));
      insert into public.employees (
        company_id,
        membership_id,
        employee_number,
        national_id,
        national_id_last4,
        full_name,
        job_title,
        department,
        start_date,
        manager_id
      )
      values (
        v_invitation.company_id,
        v_membership_id,
        v_employee_num,
        v_national_id,
        case when v_national_id is not null then right(v_national_id, 4) else null end,
        v_full_name,
        new.raw_user_meta_data->>'job_title',
        new.raw_user_meta_data->>'department',
        current_date,
        v_invitation.manager_id
      )
      on conflict (company_id, employee_number) do update
      set membership_id = v_membership_id,
          national_id = coalesce(excluded.national_id, employees.national_id),
          national_id_last4 = coalesce(excluded.national_id_last4, employees.national_id_last4)
      returning id into v_employee_id;

      perform public.seed_leave_entitlements(v_employee_id);

      update public.invitations
      set used_at = now(),
          used_by = new.id
      where id = v_invitation.id;
    end if;
  end if;

  return new;
end;
$$;

-- Existing people who joined before this migration still need this year's days.
do $$
declare emp record;
begin
  for emp in select id from public.employees loop
    perform public.seed_leave_entitlements(emp.id);
  end loop;
end $$;
