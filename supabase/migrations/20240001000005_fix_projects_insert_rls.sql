-- ============================================================
-- Migration: 20240001000005_fix_projects_insert_rls.sql
-- Purpose: Fix INSERT RLS on projects table
--
-- Root cause analysis:
--   The "authenticated users can create projects" policy uses:
--     with check (created_by = auth.uid())
--   This should work but can fail if:
--   (a) The policy was not evaluated correctly (edge case in Supabase)
--   (b) The profiles trigger failed silently for existing users created
--       before the trigger existed
--   (c) Policy interaction with other policies causes unexpected deny
--
-- Fix:
--   1. Drop and recreate the projects INSERT policy more explicitly
--   2. Backfill profiles for users that were created before the trigger
--   3. Fix tasks INSERT/UPDATE policies to use SECURITY DEFINER helper
--      (avoid re-checking project_members with RLS active, which can
--      be slow and occasionally return wrong results in edge cases)
-- ============================================================

-- --------------------------------------------------------
-- Step 1: Add a SECURITY DEFINER helper for tasks policies
-- (avoids nested RLS checks inside tasks policies)
-- --------------------------------------------------------
create or replace function private.user_project_role_for_tasks(
  p_project_id uuid,
  p_user_id    uuid
)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select role
  from public.project_members
  where project_id = p_project_id
    and user_id    = p_user_id
  limit 1;
$$;

-- --------------------------------------------------------
-- Step 2: Drop and recreate projects INSERT policy
-- Use a cleaner, more explicit check
-- --------------------------------------------------------
drop policy if exists "authenticated users can create projects" on public.projects;

create policy "authenticated users can create projects"
  on public.projects
  for insert
  to authenticated
  with check (
    -- The inserting user must be the declared creator
    auth.uid() is not null
    and created_by = auth.uid()
  );

-- --------------------------------------------------------
-- Step 3: Fix projects SELECT policy to also use SECURITY DEFINER
-- (avoids nested RLS on project_members during projects SELECT)
-- --------------------------------------------------------
drop policy if exists "members can view projects" on public.projects;

create policy "members can view projects"
  on public.projects
  for select
  to authenticated
  using (
    private.user_project_role(id, auth.uid()) is not null
  );

-- --------------------------------------------------------
-- Step 4: Fix projects UPDATE/DELETE policies similarly
-- --------------------------------------------------------
drop policy if exists "owners can update projects" on public.projects;
drop policy if exists "owners can delete projects" on public.projects;

create policy "owners can update projects"
  on public.projects
  for update
  to authenticated
  using (
    private.user_project_role(id, auth.uid()) = 'owner'
  );

create policy "owners can delete projects"
  on public.projects
  for delete
  to authenticated
  using (
    private.user_project_role(id, auth.uid()) = 'owner'
  );

-- --------------------------------------------------------
-- Step 5: Fix tasks policies to use SECURITY DEFINER helper
-- --------------------------------------------------------
drop policy if exists "members can view tasks"              on public.tasks;
drop policy if exists "owners and editors can create tasks" on public.tasks;
drop policy if exists "owners and editors can update tasks" on public.tasks;
drop policy if exists "owners can delete tasks"             on public.tasks;

create policy "members can view tasks"
  on public.tasks
  for select
  to authenticated
  using (
    private.user_project_role_for_tasks(project_id, auth.uid()) is not null
  );

create policy "owners and editors can create tasks"
  on public.tasks
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and private.user_project_role_for_tasks(project_id, auth.uid()) in ('owner', 'editor')
  );

create policy "owners and editors can update tasks"
  on public.tasks
  for update
  to authenticated
  using (
    private.user_project_role_for_tasks(project_id, auth.uid()) in ('owner', 'editor')
  );

create policy "owners can delete tasks"
  on public.tasks
  for delete
  to authenticated
  using (
    private.user_project_role_for_tasks(project_id, auth.uid()) = 'owner'
  );

-- --------------------------------------------------------
-- Step 6: Backfill profiles for users created before trigger
-- Safe to run multiple times (ON CONFLICT DO NOTHING)
-- --------------------------------------------------------
insert into public.profiles (id, display_name)
select
  id,
  coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;
