-- Let company managers and firm bookkeepers see and decide time-off
-- requests, not only the named line manager. Run after 0005.

create or replace function app.can_decide_time_off(p_employee uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.employees e
    where e.id = p_employee
      and e.id not in (select app.my_employee_ids())
      and (
        app.manages_employee(e.id)
        or app.has_role(e.company_id, array['manager', 'bookkeeper']::app_role[])
      )
  );
$$;

grant execute on function app.can_decide_time_off(uuid) to authenticated;

create or replace function public.decide_time_off(
  p_request_id uuid,
  p_approve boolean,
  p_note text default null
) returns public.time_off_requests
language plpgsql security definer set search_path = public, pg_temp
as $$
declare r public.time_off_requests;
begin
  select * into r from public.time_off_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not app.can_decide_time_off(r.employee_id) then
    raise exception 'NOT_YOUR_TEAM' using errcode = '42501';
  end if;

  if r.status <> 'pending' then
    raise exception 'ALREADY_DECIDED' using errcode = 'P0001';
  end if;

  update public.time_off_requests set
    status = case when p_approve then 'approved' else 'rejected' end::public.request_status,
    decided_by = (select auth.uid()),
    decided_at = now(),
    decision_note = left(p_note, 500)
  where id = p_request_id
  returning * into r;

  insert into public.audit_log (company_id, actor_profile_id, action, entity, entity_id, diff)
  values (r.company_id, (select auth.uid()),
          case when p_approve then 'time_off.approve' else 'time_off.reject' end,
          'time_off_requests', r.id,
          jsonb_build_object('status', r.status, 'note', p_note));

  return r;
end $$;

grant execute on function public.decide_time_off(uuid, boolean, text) to authenticated;

drop policy if exists "requests_select_company_manager" on public.time_off_requests;
create policy "requests_select_company_manager" on public.time_off_requests
  for select to authenticated
  using (app.has_role(company_id, array['manager']::app_role[]));

drop policy if exists "employees_select_company_manager" on public.employees;
create policy "employees_select_company_manager" on public.employees
  for select to authenticated
  using (app.has_role(company_id, array['manager']::app_role[]));

drop policy if exists "entitlements_select_company_manager" on public.leave_entitlements;
create policy "entitlements_select_company_manager" on public.leave_entitlements
  for select to authenticated
  using (app.has_role(company_id, array['manager']::app_role[]));

drop policy if exists "time_off_attachments_select_company_manager" on public.time_off_attachments;
create policy "time_off_attachments_select_company_manager" on public.time_off_attachments
  for select to authenticated
  using (app.has_role(company_id, array['manager']::app_role[]));
