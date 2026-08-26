-- ============================================================
-- Migration: 20240001000009_fix_project_select_rls_and_auto_member.sql
-- Purpose: Fix PostgREST .insert().select() 403 Forbidden error on projects.
--
-- Root Cause:
-- When client does .insert({ name: ... }).select("id"):
-- PostgREST executes INSERT then SELECT on the new row.
-- The SELECT policy required user to be in `project_members`, but
-- the member row wasn't created yet when SELECT ran!
--
-- Solution:
-- 1. Update projects SELECT policy to allow `created_by = auth.uid()`
--    OR being a member.
-- 2. Add AFTER INSERT trigger on projects to automatically create the
--    owner row in project_members immediately.
-- ============================================================

-- --------------------------------------------------------
-- Step 1: Update SELECT policy on projects
-- --------------------------------------------------------
drop policy if exists "members can view projects" on public.projects;

create policy "members can view projects"
  on public.projects for select to authenticated
  using (
    created_by = auth.uid()
    or private.user_project_role(id, auth.uid()) is not null
  );

-- --------------------------------------------------------
-- Step 2: AFTER INSERT trigger to auto-create owner in project_members
-- --------------------------------------------------------
create or replace function public.handle_project_created_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    insert into public.project_members (project_id, user_id, role)
    values (new.id, auth.uid(), 'owner')
    on conflict (project_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_project_created_add_owner on public.projects;

create trigger on_project_created_add_owner
  after insert on public.projects
  for each row execute function public.handle_project_created_members();
