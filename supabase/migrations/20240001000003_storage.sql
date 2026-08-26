-- ============================================================
-- Migration: 20240001000003_storage.sql
-- Purpose: Create Storage bucket and policies
-- ============================================================

-- --------------------------------------------------------
-- Create Storage bucket: task-files
-- --------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-files',
  'task-files',
  false,                          -- private bucket, requires auth
  52428800,                       -- 50 MB limit
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain', 'text/csv',
        'application/zip', 'application/octet-stream']
);

-- --------------------------------------------------------
-- Storage Policies
-- --------------------------------------------------------

-- Authenticated users can upload files
-- Path convention: {project_id}/{task_id}/{filename}
create policy "authenticated users can upload task files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'task-files'
    and auth.uid() is not null
  );

-- Authenticated users can view/download files
create policy "authenticated users can view task files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'task-files'
    and auth.uid() is not null
  );

-- Authenticated users can update their own uploads
create policy "users can update own task files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'task-files'
    and owner = auth.uid()
  )
  with check (
    bucket_id = 'task-files'
    and owner = auth.uid()
  );

-- Authenticated users can delete their own uploads
create policy "users can delete own task files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'task-files'
    and owner = auth.uid()
  );
