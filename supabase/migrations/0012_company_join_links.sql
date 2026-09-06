-- Two reusable join links per business: one for employees, one for managers.
-- One-time invites stay as they are.
--
-- Run this in the Supabase SQL editor after 0011. Safe to run again if an
-- earlier draft of this file created a single unscoped link.

alter table public.invitations
  add column if not exists reusable boolean not null default false;

alter table public.invitations
  drop constraint if exists invitations_reusable_role_check;

drop index if exists uniq_company_reusable_invite;

-- Older draft allowed a role-less group link. Pin those to employee, then
-- require a role on every invite.
update public.invitations
  set role = 'employee'
where reusable and role is null;

alter table public.invitations
  drop constraint if exists invitations_role_check;

alter table public.invitations
  alter column role set not null;

alter table public.invitations
  add constraint invitations_role_check
  check (role in ('employee', 'manager'));

create unique index if not exists uniq_company_reusable_invite
  on public.invitations (company_id, role)
  where reusable;

create or replace function public.ensure_company_join_links()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.invitations (company_id, role, reusable, expires_at, created_by)
  values
    (new.id, 'employee', true, now() + interval '90 days', (select auth.uid())),
    (new.id, 'manager', true, now() + interval '90 days', (select auth.uid()))
  on conflict (company_id, role) where reusable do nothing;
  return new;
end;
$$;

drop trigger if exists trg_company_join_link on public.companies;
drop trigger if exists trg_company_join_links on public.companies;
drop function if exists public.ensure_company_join_link();
create trigger trg_company_join_links
after insert on public.companies
for each row execute function public.ensure_company_join_links();

insert into public.invitations (company_id, role, reusable, expires_at)
select c.id, r.role, true, now() + interval '90 days'
from public.companies c
cross join (values ('employee'::app_role), ('manager'::app_role)) as r(role)
where not exists (
  select 1 from public.invitations i
  where i.company_id = c.id
    and i.reusable
    and i.role = r.role
);

drop function if exists public.get_invitation_by_token(text);

create function public.get_invitation_by_token(p_token text)
returns table (
  id uuid,
  token text,
  role app_role,
  email citext,
  expires_at timestamptz,
  used_at timestamptz,
  reusable boolean,
  company_id uuid,
  company_name text,
  company_tax_id text
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    i.id,
    i.token,
    i.role,
    i.email,
    i.expires_at,
    i.used_at,
    i.reusable,
    c.id as company_id,
    c.name as company_name,
    c.tax_id as company_tax_id
  from public.invitations i
  join public.companies c on c.id = i.company_id
  where i.token = p_token
  limit 1;
$$;

grant execute on function public.get_invitation_by_token(text) to anon, authenticated;

-- Reusable links stay unused, so the old "any unused invite" policies would
-- let a guest list every company and every team join token. Lookups go through
-- get_invitation_by_token instead.
drop policy if exists "invitations_select_active_token" on public.invitations;

drop policy if exists "companies_select_invited" on public.companies;
create policy "companies_select_invited" on public.companies for select to anon, authenticated
  using (exists (
    select 1 from public.invitations i
    where i.company_id = companies.id
      and i.used_at is null
      and i.expires_at > now()
      and not i.reusable
  ));

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
      and expires_at > now()
      and (reusable or used_at is null)
    for update;

    if found then
      if v_invitation.role not in ('employee', 'manager') then
        raise exception 'JOIN_ROLE_REQUIRED' using errcode = '23514';
      end if;

      insert into public.memberships (company_id, profile_id, role, is_active, invited_by)
      values (v_invitation.company_id, new.id, v_invitation.role, true, v_invitation.created_by)
      on conflict (company_id, profile_id) do update
        set role = v_invitation.role,
            is_active = true
      returning id into v_membership_id;

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

      if not v_invitation.reusable then
        update public.invitations
          set used_at = now(),
              used_by = new.id
        where id = v_invitation.id;
      end if;
    end if;
  end if;

  return new;
end;
$$;
