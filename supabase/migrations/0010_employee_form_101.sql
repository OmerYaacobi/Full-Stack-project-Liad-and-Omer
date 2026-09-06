-- Employees may file their own Form 101 (filled in the app or uploaded).
-- Other document kinds stay bookkeeper-only.

drop policy if exists "documents_insert_own_form_101" on public.documents;
create policy "documents_insert_own_form_101" on public.documents
  for insert to authenticated
  with check (
    kind = 'form_101'
    and employee_id in (select app.my_employee_ids())
    and uploaded_by = (select auth.uid())
  );

drop policy if exists "documents_write_own_form_101" on storage.objects;
create policy "documents_write_own_form_101" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[3] = 'form_101'
    and app.try_uuid((storage.foldername(name))[2]) in (select app.my_employee_ids())
  );
