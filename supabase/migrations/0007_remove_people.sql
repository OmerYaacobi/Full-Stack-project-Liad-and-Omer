-- Manager: take a direct report off the team (they stay at the business).
-- Bookkeeper: take a person off payroll without deleting pay history, or
-- remove a client business. payslips.employee_id is ON DELETE RESTRICT, so a
-- company delete must drop slips first.

create or replace function public.remove_direct_report(p_employee_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare emp public.employees;
begin
  select * into emp from public.employees where id = p_employee_id for update;
  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not app.manages_employee(p_employee_id) then
    raise exception 'NOT_THEIR_MANAGER' using errcode = '42501';
  end if;

  update public.employees
    set manager_id = null
  where id = p_employee_id;

  insert into public.audit_log (company_id, actor_profile_id, action, entity, entity_id, diff)
  values (
    emp.company_id,
    (select auth.uid()),
    'employee.remove_from_team',
    'employees',
    p_employee_id,
    jsonb_build_object('manager_id', emp.manager_id)
  );
end;
$$;

grant execute on function public.remove_direct_report(uuid) to authenticated;

create or replace function public.terminate_employee(p_employee_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare emp public.employees;
begin
  select * into emp from public.employees where id = p_employee_id for update;
  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not app.has_role(emp.company_id, array['bookkeeper']::app_role[]) then
    raise exception 'NOT_BOOKKEEPER' using errcode = '42501';
  end if;

  if emp.status = 'terminated' then
    raise exception 'ALREADY_REMOVED' using errcode = 'P0001';
  end if;

  update public.employees
    set status = 'terminated',
        end_date = current_date,
        manager_id = null
  where id = p_employee_id;

  update public.employees
    set manager_id = null
  where manager_id = p_employee_id;

  if emp.membership_id is not null then
    update public.memberships
      set is_active = false
    where id = emp.membership_id;
  end if;

  update public.time_off_requests
    set status = 'cancelled'::public.request_status
  where employee_id = p_employee_id
    and status = 'pending';

  insert into public.audit_log (company_id, actor_profile_id, action, entity, entity_id, diff)
  values (
    emp.company_id,
    (select auth.uid()),
    'employee.terminate',
    'employees',
    p_employee_id,
    jsonb_build_object('status', 'terminated')
  );
end;
$$;

grant execute on function public.terminate_employee(uuid) to authenticated;

create or replace function public.remove_company(p_company_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare company_row public.companies;
begin
  select * into company_row from public.companies where id = p_company_id for update;
  if not found then
    raise exception 'COMPANY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not app.is_firm_bookkeeper(company_row.firm_id) then
    raise exception 'NOT_BOOKKEEPER' using errcode = '42501';
  end if;

  -- Restrict on payslips.employee_id would block cascading employee deletes.
  delete from public.payslips where company_id = p_company_id;
  delete from public.companies where id = p_company_id;
end;
$$;

grant execute on function public.remove_company(uuid) to authenticated;
