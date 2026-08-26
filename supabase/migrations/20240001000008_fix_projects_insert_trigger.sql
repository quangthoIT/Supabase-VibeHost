-- ============================================================
-- Migration: 20240001000008_fix_projects_insert_trigger.sql
-- Purpose: Bulletproof projects INSERT RLS and created_by assignment.
--
-- Root cause of RLS violation on projects INSERT:
-- If client sends created_by = 'user_id_A' but the active browser JWT session
-- belongs to another user (or token mismatch), `created_by = auth.uid()` fails.
--
-- Solution:
-- 1. BEFORE INSERT trigger automatically sets created_by = auth.uid()
-- 2. INSERT RLS policy checks `auth.uid() IS NOT NULL`
-- 3. Grants permissions to authenticated role
-- ============================================================

-- --------------------------------------------------------
-- Step 1: Trigger to auto-assign created_by to auth.uid()
-- --------------------------------------------------------
create or replace function public.handle_project_created_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Always enforce created_by to be the authenticated user making the request
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_project_created_by on public.projects;

create trigger set_project_created_by
  before insert on public.projects
  for each row execute function public.handle_project_created_by();

-- --------------------------------------------------------
-- Step 2: Simplify projects INSERT policy
-- --------------------------------------------------------
drop policy if exists "authenticated users can create projects" on public.projects;

create policy "authenticated users can create projects"
  on public.projects for insert to authenticated
  with check (auth.uid() is not null);

-- --------------------------------------------------------
-- Step 3: Ensure project_members bootstrap insert policy works seamlessly
-- --------------------------------------------------------
drop policy if exists "owners can add members" on public.project_members;

create policy "owners can add members"
  on public.project_members for insert to authenticated
  with check (
    -- Case (a): Adding yourself as member to a project created by you
    (
      user_id = auth.uid()
      and exists (
        select 1 from public.projects p
        where p.id = project_members.project_id
          and p.created_by = auth.uid()
      )
    )
    or
    -- Case (b): Existing owner adding another member
    private.user_project_role(project_id, auth.uid()) = 'owner'
  );

-- --------------------------------------------------------
-- Step 4: Ensure permissions are granted
-- --------------------------------------------------------
grant all on public.projects to authenticated;
grant all on public.project_members to authenticated;
