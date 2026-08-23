-- Per-file share with every manager in the same company.
--
-- Company-wide document folders are gone: a file always belongs to one
-- employee. Managers are not that employee, so they need an explicit grant
-- rather than the old "everyone in the business" slot.

alter table public.documents
  add column if not exists visible_to_managers boolean not null default false;

alter table public.payslips
  add column if not exists visible_to_managers boolean not null default false;

drop policy if exists "documents_select_managers" on public.documents;
create policy "documents_select_managers" on public.documents
  for select to authenticated
  using (
    visible_to_managers
    and app.has_role(company_id, array['manager']::app_role[])
  );

drop policy if exists "payslips_select_managers_shared" on public.payslips;
create policy "payslips_select_managers_shared" on public.payslips
  for select to authenticated
  using (
    visible_to_managers
    and status = 'published'
    and app.has_role(company_id, array['manager']::app_role[])
  );

-- Sharing an existing pay slip is an update that must not require the current
-- bookkeeper to be the original uploader.
drop policy if exists "payslips_write_bookkeeper" on public.payslips;
drop policy if exists "payslips_insert_bookkeeper" on public.payslips;
drop policy if exists "payslips_update_bookkeeper" on public.payslips;
drop policy if exists "payslips_delete_bookkeeper" on public.payslips;

create policy "payslips_insert_bookkeeper" on public.payslips
  for insert to authenticated
  with check (
    app.has_role(company_id, array['bookkeeper']::app_role[])
    and uploaded_by = (select auth.uid())
  );

create policy "payslips_update_bookkeeper" on public.payslips
  for update to authenticated
  using (app.has_role(company_id, array['bookkeeper']::app_role[]))
  with check (app.has_role(company_id, array['bookkeeper']::app_role[]));

create policy "payslips_delete_bookkeeper" on public.payslips
  for delete to authenticated
  using (app.has_role(company_id, array['bookkeeper']::app_role[]));

-- Opening the file is a Storage read. The table flag is the source of truth
-- so a manager cannot wander the bucket, only objects that were shared.
drop policy if exists "documents_read_managers" on storage.objects;
create policy "documents_read_managers" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
      where d.file_path = name
        and d.visible_to_managers
        and app.has_role(d.company_id, array['manager']::app_role[])
    )
  );

drop policy if exists "payslips_read_managers_shared" on storage.objects;
create policy "payslips_read_managers_shared" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payslips'
    and exists (
      select 1 from public.payslips p
      where p.file_path = name
        and p.visible_to_managers
        and p.status = 'published'
        and app.has_role(p.company_id, array['manager']::app_role[])
    )
  );
