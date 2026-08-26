-- ============================================================
-- Migration: 20240001000000_schema.sql
-- Purpose: Create core tables for supabase-vibe-host-fixture
-- ============================================================

-- --------------------------------------------------------
-- profiles
-- Mirrors auth.users, extended profile data
-- --------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Extended user profile data mirroring auth.users';

-- --------------------------------------------------------
-- projects
-- --------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

comment on table public.projects is 'Project entities for team task management';

-- --------------------------------------------------------
-- project_members
-- Links users to projects with a role
-- --------------------------------------------------------
create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

comment on table public.project_members is 'Project membership with role-based access';

-- --------------------------------------------------------
-- tasks
-- --------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  completed boolean not null default false,
  file_path text,         -- Storage path for attached file
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tasks is 'Individual tasks within a project';

-- --------------------------------------------------------
-- Trigger: auto-update updated_at on tasks
-- --------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.handle_updated_at();

-- --------------------------------------------------------
-- Trigger: auto-create profile on new auth.user
-- --------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
