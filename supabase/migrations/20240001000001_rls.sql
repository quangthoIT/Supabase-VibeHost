-- ============================================================
-- Migration: 20240001000001_rls.sql
-- Purpose: Enable Row Level Security and create policies
-- All policies use auth.uid() as required
-- ============================================================

-- --------------------------------------------------------
-- Enable RLS
-- --------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;

-- ============================================================
-- PROFILES policies
-- ============================================================

-- Users can read their own profile
create policy "users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- Users can update their own profile
create policy "users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Profile is created via trigger (handle_new_user), not directly by user
-- But we allow insert from the trigger (security definer context)
create policy "service role can insert profiles"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

-- ============================================================
-- PROJECTS policies
-- ============================================================

-- Users can view projects they are a member of
create policy "members can view projects"
  on public.projects
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.project_members pm
      where pm.project_id = projects.id
        and pm.user_id = auth.uid()
    )
  );

-- Authenticated users can create projects
create policy "authenticated users can create projects"
  on public.projects
  for insert
  to authenticated
  with check (created_by = auth.uid());

-- Only project owners can update their projects
create policy "owners can update projects"
  on public.projects
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.project_members pm
      where pm.project_id = projects.id
        and pm.user_id = auth.uid()
        and pm.role = 'owner'
    )
  );

-- Only project owners can delete their projects
create policy "owners can delete projects"
  on public.projects
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.project_members pm
      where pm.project_id = projects.id
        and pm.user_id = auth.uid()
        and pm.role = 'owner'
    )
  );

-- ============================================================
-- PROJECT_MEMBERS policies
-- ============================================================

-- Members can see who else is in their projects
create policy "members can view project members"
  on public.project_members
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_members.project_id
        and pm.user_id = auth.uid()
    )
  );

-- Only owners can add members
create policy "owners can add members"
  on public.project_members
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_members.project_id
        and pm.user_id = auth.uid()
        and pm.role = 'owner'
    )
    -- Allow the project creator to insert their own membership (bootstrapping)
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.projects p
        where p.id = project_members.project_id
          and p.created_by = auth.uid()
      )
    )
  );

-- Only owners can remove members
create policy "owners can remove members"
  on public.project_members
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_members.project_id
        and pm.user_id = auth.uid()
        and pm.role = 'owner'
    )
  );

-- ============================================================
-- TASKS policies
-- ============================================================

-- Members can view tasks of their projects
create policy "members can view tasks"
  on public.tasks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.project_members pm
      where pm.project_id = tasks.project_id
        and pm.user_id = auth.uid()
    )
  );

-- Owners and editors can create tasks
create policy "owners and editors can create tasks"
  on public.tasks
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.project_members pm
      where pm.project_id = tasks.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'editor')
    )
  );

-- Owners and editors can update tasks (e.g., mark complete)
create policy "owners and editors can update tasks"
  on public.tasks
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.project_members pm
      where pm.project_id = tasks.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'editor')
    )
  );

-- Owners can delete tasks
create policy "owners can delete tasks"
  on public.tasks
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.project_members pm
      where pm.project_id = tasks.project_id
        and pm.user_id = auth.uid()
        and pm.role = 'owner'
    )
  );

-- ============================================================
-- Enable Realtime for tasks table
-- ============================================================
-- This allows supabase.channel().on('postgres_changes', ...) to work
alter publication supabase_realtime add table public.tasks;
