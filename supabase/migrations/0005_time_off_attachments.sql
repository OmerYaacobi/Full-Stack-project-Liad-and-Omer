-- Time-off request attachments (doctor notes, travel docs, etc.)
-- Run after 0004. Employees upload their own files; managers of that
-- person and the bookkeeper can open them.

create table if not exists public.time_off_attachments (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.time_off_requests(id) on delete cascade,
  company_id    uuid not null references public.companies(id) on delete cascade,
  employee_id   uuid not null references public.employees(id) on delete cascade,
  title         text not null,
  file_path     text not null,
  file_size     integer not null check (file_size between 1 and 10485760),
  uploaded_by   uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);

create index if not exists idx_time_off_attachments_request
  on public.time_off_attachments (request_id);

alter table public.time_off_attachments enable row level security;

drop policy if exists "time_off_attachments_select_own" on public.time_off_attachments;
create policy "time_off_attachments_select_own" on public.time_off_attachments
  for select to authenticated
  using (employee_id in (select app.my_employee_ids()));

drop policy if exists "time_off_attachments_select_team" on public.time_off_attachments;
create policy "time_off_attachments_select_team" on public.time_off_attachments
  for select to authenticated
  using (app.manages_employee(employee_id));

drop policy if exists "time_off_attachments_select_bookkeeper" on public.time_off_attachments;
create policy "time_off_attachments_select_bookkeeper" on public.time_off_attachments
  for select to authenticated
  using (app.has_role(company_id, array['bookkeeper']::app_role[]));

drop policy if exists "time_off_attachments_insert_own" on public.time_off_attachments;
create policy "time_off_attachments_insert_own" on public.time_off_attachments
  for insert to authenticated
  with check (
    employee_id in (select app.my_employee_ids())
    and uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.time_off_requests r
      where r.id = request_id
        and r.employee_id = employee_id
        and r.company_id = company_id
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'time_off',
  'time_off',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do nothing;

-- Object key: {company_id}/{employee_id}/{request_id}/{uuid}.ext
drop policy if exists "time_off_read" on storage.objects;
create policy "time_off_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'time_off'
    and (
      app.try_uuid((storage.foldername(name))[2]) in (select app.my_employee_ids())
      or app.manages_employee(app.try_uuid((storage.foldername(name))[2]))
      or app.has_role(
        app.try_uuid((storage.foldername(name))[1]),
        array['bookkeeper']::app_role[]
      )
    )
  );

drop policy if exists "time_off_write" on storage.objects;
create policy "time_off_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'time_off'
    and app.try_uuid((storage.foldername(name))[2]) in (select app.my_employee_ids())
  );
