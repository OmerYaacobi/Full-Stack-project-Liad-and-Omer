-- Managers can take people from the company team as their own reports.
-- New files and pay slips are visible to managers unless the uploader turns
-- that off.

alter table public.documents
  alter column visible_to_managers set default true;

alter table public.payslips
  alter column visible_to_managers set default true;

create or replace function public.claim_direct_report(p_employee_id uuid)
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
    return;
  end if;

  update public.employees
    set manager_id = my_id
  where id = p_employee_id;

  insert into public.audit_log (company_id, actor_profile_id, action, entity, entity_id, diff)
  values (
    emp.company_id,
    (select auth.uid()),
    'employee.claim_report',
    'employees',
    p_employee_id,
    jsonb_build_object('from', emp.manager_id, 'to', my_id)
  );
end;
$$;

grant execute on function public.claim_direct_report(uuid) to authenticated;
