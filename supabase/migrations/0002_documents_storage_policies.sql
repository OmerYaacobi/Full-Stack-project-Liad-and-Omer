-- Storage policies for the `documents` bucket.
--
-- 0001 creates both buckets but only ever writes policies for `payslips`, so
-- every read and write against `documents` was denied: storage.objects has RLS
-- on, and a bucket with no matching policy is closed rather than open.
--
-- Object key layout, matching docs/technical-design/02-rls.md §4:
--   documents/{company_id}/{employee_id|_company}/{kind}/{uuid}.{ext}
-- so foldername()[1] is the company, [2] is the owner slot, [3] is the kind.

-- Casting foldername()[2] directly would raise on the literal '_company' used
-- for company-wide files. Postgres does not promise to short-circuit AND before
-- evaluating a cast, so the guard has to live inside the cast itself.
create or replace function app.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  return p_value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

grant execute on function app.try_uuid(text) to authenticated;

drop policy if exists "documents_read" on storage.objects;
create policy "documents_read" on storage.objects for select to authenticated
using (
  bucket_id = 'documents'
  and (
    -- A bookkeeper of the managing firm sees everything in the company folder.
    app.has_role(
      app.try_uuid((storage.foldername(name))[1]),
      array['bookkeeper']::app_role[]
    )
    -- Company-wide files are visible to anyone in the company.
    or (
      (storage.foldername(name))[2] = '_company'
      and app.has_role(
        app.try_uuid((storage.foldername(name))[1]),
        array['employee', 'manager', 'bookkeeper']::app_role[]
      )
    )
    -- An employee's own file, or one belonging to someone they manage.
    or app.try_uuid((storage.foldername(name))[2]) in (
      select app.my_employee_ids()
    )
    or app.manages_employee(app.try_uuid((storage.foldername(name))[2]))
  )
);

-- Write and delete stay with the bookkeeper, mirroring documents_write_bookkeeper
-- on the table so the object and its row cannot drift apart in who may change them.
drop policy if exists "documents_write" on storage.objects;
create policy "documents_write" on storage.objects for insert to authenticated
with check (
  bucket_id = 'documents'
  and app.has_role(
    app.try_uuid((storage.foldername(name))[1]),
    array['bookkeeper']::app_role[]
  )
);

drop policy if exists "documents_update" on storage.objects;
create policy "documents_update" on storage.objects for update to authenticated
using (
  bucket_id = 'documents'
  and app.has_role(
    app.try_uuid((storage.foldername(name))[1]),
    array['bookkeeper']::app_role[]
  )
);

drop policy if exists "documents_delete" on storage.objects;
create policy "documents_delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'documents'
  and app.has_role(
    app.try_uuid((storage.foldername(name))[1]),
    array['bookkeeper']::app_role[]
  )
);
