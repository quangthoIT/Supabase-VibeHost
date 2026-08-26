-- ============================================================
-- Migration: 20240001000002_rpc.sql
-- Purpose: Create RPC functions including SECURITY DEFINER
-- ============================================================

-- --------------------------------------------------------
-- Private schema (not exposed via PostgREST by default)
-- --------------------------------------------------------
create schema if not exists private;

-- ============================================================
-- SECURITY DEFINER: private.can_edit_project
-- Checks whether the calling user has edit permissions on a project.
-- Runs as the function owner, not the calling user, for elevated access.
-- set search_path = '' prevents search_path injection attacks.
-- ============================================================
create or replace function private.can_edit_project(target_project uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members
    where project_id = target_project
      and user_id = auth.uid()
      and role in ('owner', 'editor')
  );
$$;

comment on function private.can_edit_project(uuid) is
  'SECURITY DEFINER: checks if calling user can edit the given project. '
  'Runs elevated to bypass RLS on project_members for this specific check.';

-- ============================================================
-- PUBLIC WRAPPER: public.check_can_edit_project
-- Exposes the security-definer function via PostgREST RPC.
-- This wrapper itself does NOT have SECURITY DEFINER.
-- The evidence for SECURITY DEFINER is in private.can_edit_project above.
-- ============================================================
create or replace function public.check_can_edit_project(target_project uuid)
returns boolean
language sql
stable
as $$
  select private.can_edit_project(target_project);
$$;

comment on function public.check_can_edit_project(uuid) is
  'Public RPC wrapper for private.can_edit_project (SECURITY DEFINER). '
  'Use this to check if the current user can edit a project.';

-- ============================================================
-- Simple RPC: public.get_project_stats
-- Returns task statistics for a project.
-- Caller must be a member (RLS on tasks enforces this).
-- ============================================================
create or replace function public.get_project_stats(target_project uuid)
returns json
language sql
stable
as $$
  select json_build_object(
    'total',      count(*),
    'done',       count(*) filter (where completed),
    'todo',       count(*) filter (where not completed),
    'project_id', target_project
  )
  from public.tasks
  where project_id = target_project;
$$;

comment on function public.get_project_stats(uuid) is
  'Simple RPC (no SECURITY DEFINER): returns task count statistics for a project. '
  'Subject to RLS on tasks — non-members will see zeros.';
