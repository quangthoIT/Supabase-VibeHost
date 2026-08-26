-- ============================================================
-- Migration: 20240001000006_rls_nuclear_reset.sql
-- Purpose: Complete RLS reset — remove all policies and recreate
--          from scratch with the simplest possible approach.
--
-- Previous migrations may have left conflicting/duplicate policies.
-- This migration:
--   1. Drops ALL policies on all 4 tables
--   2. Recreates them cleanly using SECURITY DEFINER helpers
--   3. Verifies helper functions exist
-- ============================================================

-- --------------------------------------------------------
-- Step 1: Drop ALL existing policies (nuclear reset)
-- --------------------------------------------------------

-- profiles
drop policy if exists "users can view own profile"         on public.profiles;
drop policy if exists "users can update own profile"       on public.profiles;
drop policy if exists "service role can insert profiles"   on public.profiles;

-- projects
drop policy if exists "members can view projects"                   on public.projects;
drop policy if exists "authenticated users can create projects"     on public.projects;
drop policy if exists "owners can update projects"                  on public.projects;
drop policy if exists "owners can delete projects"                  on public.projects;

-- project_members (migration 001 originals)
drop policy if exists "members can view project members"    on public.project_members;
drop policy if exists "owners can add members"              on public.project_members;
drop policy if exists "owners can remove members"           on public.project_members;

-- tasks
drop policy if exists "members can view tasks"              on public.tasks;
drop policy if exists "owners and editors can create tasks" on public.tasks;
drop policy if exists "owners and editors can update tasks" on public.tasks;
drop policy if exists "owners can delete tasks"             on public.tasks;

-- --------------------------------------------------------
-- Step 2: Ensure SECURITY DEFINER helpers exist
-- --------------------------------------------------------

create schema if not exists private;

-- Helper: get role of a user in a project (bypasses RLS)
create or replace function private.user_project_role(
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
-- Step 3: Recreate all policies — clean slate
-- --------------------------------------------------------

-- ── PROFILES ──────────────────────────────────────────────

create policy "users can view own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "users can update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "users can insert own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- ── PROJECTS ──────────────────────────────────────────────

-- SELECT: only projects where user is a member
create policy "members can view projects"
  on public.projects for select to authenticated
  using (
    private.user_project_role(id, auth.uid()) is not null
  );

-- INSERT: any authenticated user can create a project
--   (they must set created_by = their own uid)
create policy "authenticated users can create projects"
  on public.projects for insert to authenticated
  with check (created_by = auth.uid());

-- UPDATE/DELETE: only owners
create policy "owners can update projects"
  on public.projects for update to authenticated
  using (private.user_project_role(id, auth.uid()) = 'owner');

create policy "owners can delete projects"
  on public.projects for delete to authenticated
  using (private.user_project_role(id, auth.uid()) = 'owner');

-- ── PROJECT_MEMBERS ────────────────────────────────────────

-- SELECT: if you are already a member, you can see all members
create policy "members can view project members"
  on public.project_members for select to authenticated
  using (
    private.user_project_role(project_id, auth.uid()) is not null
  );

-- INSERT — two cases:
--   (a) Bootstrap: inserting your own owner row for a project you created
--   (b) Owner adding another member
create policy "owners can add members"
  on public.project_members for insert to authenticated
  with check (
    -- Bootstrap case: user adds themselves as owner of their own new project
    (
      user_id = auth.uid()
      and exists (
        select 1 from public.projects p
        where p.id = project_members.project_id
          and p.created_by = auth.uid()
      )
    )
    or
    -- Normal case: existing owner adds another member
    private.user_project_role(project_id, auth.uid()) = 'owner'
  );

-- DELETE: members can remove themselves; owners can remove anyone
create policy "owners can remove members"
  on public.project_members for delete to authenticated
  using (
    user_id = auth.uid()
    or private.user_project_role(project_id, auth.uid()) = 'owner'
  );

-- ── TASKS ──────────────────────────────────────────────────

-- SELECT: any project member can view tasks
create policy "members can view tasks"
  on public.tasks for select to authenticated
  using (
    private.user_project_role(project_id, auth.uid()) is not null
  );

-- INSERT: owner or editor only
create policy "owners and editors can create tasks"
  on public.tasks for insert to authenticated
  with check (
    created_by = auth.uid()
    and private.user_project_role(project_id, auth.uid()) in ('owner', 'editor')
  );

-- UPDATE: owner or editor only
create policy "owners and editors can update tasks"
  on public.tasks for update to authenticated
  using (
    private.user_project_role(project_id, auth.uid()) in ('owner', 'editor')
  );

-- DELETE: owner only
create policy "owners can delete tasks"
  on public.tasks for delete to authenticated
  using (
    private.user_project_role(project_id, auth.uid()) = 'owner'
  );

-- --------------------------------------------------------
-- Step 4: Backfill profiles (safe to run multiple times)
-- --------------------------------------------------------
insert into public.profiles (id, display_name)
select
  id,
  coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- --------------------------------------------------------
-- Step 5: Verify — should show all policies
-- --------------------------------------------------------
select tablename, policyname, cmd
from pg_policies
where tablename in ('profiles', 'projects', 'project_members', 'tasks')
order by tablename, cmd;
