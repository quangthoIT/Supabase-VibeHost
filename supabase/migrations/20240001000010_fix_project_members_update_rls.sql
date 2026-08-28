-- ============================================================
-- Migration: 20240001000010_fix_project_members_update_rls.sql
-- Purpose: Add UPDATE policy on project_members table.
--          Fixes PostgREST 403 Forbidden error on upsert operations.
-- ============================================================

-- --------------------------------------------------------
-- Add UPDATE policy on project_members
-- Allows users to update their own member row or owners to update members
-- --------------------------------------------------------
drop policy if exists "owners can update project members" on public.project_members;

create policy "owners can update project members"
  on public.project_members for update to authenticated
  using (
    user_id = auth.uid()
    or private.user_project_role(project_id, auth.uid()) = 'owner'
  )
  with check (
    user_id = auth.uid()
    or private.user_project_role(project_id, auth.uid()) = 'owner'
  );

-- Grant privileges
grant all on public.project_members to authenticated;
