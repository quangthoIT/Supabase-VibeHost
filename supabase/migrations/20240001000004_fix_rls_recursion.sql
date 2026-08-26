-- ============================================================
-- Migration: 20240001000004_fix_rls_recursion.sql
-- Purpose: Fix infinite recursion in project_members RLS policies
--
-- Root cause:
--   Policies on project_members were querying project_members
--   from within themselves, causing infinite recursion.
--   PostgreSQL cannot resolve: "can I see row X?" requires checking
--   "am I a member?" which requires seeing row X...
--
-- Fix:
--   Introduce private.user_project_role() — a SECURITY DEFINER
--   function that bypasses RLS when checking membership.
--   Policies call this function instead of querying the table directly.
-- ============================================================

-- --------------------------------------------------------
-- Step 1: SECURITY DEFINER helper — bypasses RLS on project_members
-- Used by all project_members policies to avoid self-reference recursion
-- --------------------------------------------------------
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

comment on function private.user_project_role(uuid, uuid) is
  'SECURITY DEFINER: returns the role of p_user_id in p_project_id. '
  'Bypasses RLS to avoid infinite recursion in project_members policies.';

-- --------------------------------------------------------
-- Step 2: Drop old recursive policies on project_members
-- --------------------------------------------------------
drop policy if exists "members can view project members"  on public.project_members;
drop policy if exists "owners can add members"            on public.project_members;
drop policy if exists "owners can remove members"         on public.project_members;

-- --------------------------------------------------------
-- Step 3: Re-create non-recursive policies
-- --------------------------------------------------------

-- SELECT: user can see membership rows if they are themselves a member
create policy "members can view project members"
  on public.project_members
  for select
  to authenticated
  using (
    -- Use SECURITY DEFINER function — no recursion
    private.user_project_role(project_id, auth.uid()) is not null
  );

-- INSERT: two allowed cases —
--   (a) Creator bootstrapping their own owner row for a project they just created
--   (b) An existing owner adding another member
create policy "owners can add members"
  on public.project_members
  for insert
  to authenticated
  with check (
    -- Case (a): adding yourself as owner of a project you created
    (
      user_id = auth.uid()
      and exists (
        select 1
        from public.projects p
        where p.id = project_members.project_id
          and p.created_by = auth.uid()
      )
    )
    or
    -- Case (b): you are already an owner
    private.user_project_role(project_id, auth.uid()) = 'owner'
  );

-- DELETE: users can remove themselves; owners can remove anyone
create policy "owners can remove members"
  on public.project_members
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    or private.user_project_role(project_id, auth.uid()) = 'owner'
  );
