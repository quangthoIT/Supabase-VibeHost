-- ============================================================
-- Seed: seed.sql
-- Purpose: Development seed data for supabase-vibe-host-fixture
-- ============================================================
-- NOTE: This seed file requires auth.users to already exist.
-- Create two test users via the Supabase Dashboard or Auth API first,
-- then uncomment and fill in the UUIDs below.
--
-- Test User A (owner/editor): test-user-a@example.com
-- Test User B (viewer → negative test): test-user-b@example.com
--
-- These credentials must NOT be production credentials.
-- ============================================================

-- Step 1: After creating users via Auth, run this manually with real UUIDs:
do $$
declare
  user_a_id uuid := '143b1dab-1e06-4853-809c-5822c7286fe5';
  user_b_id uuid := 'a97bcd3d-e3b0-4d88-8095-c42519a69412';
  proj_id   uuid;
begin

  -- Create a test project
  insert into public.projects (id, name, description, created_by)
  values (
    gen_random_uuid(),
    'Fixture Test Project',
    'Used for baseline and Vibe Host import testing',
    user_a_id
  )
  returning id into proj_id;

  -- Add User A as owner
  insert into public.project_members (project_id, user_id, role)
  values (proj_id, user_a_id, 'owner');

  -- Add a sample task
  insert into public.tasks (project_id, title, created_by)
  values
    (proj_id, 'Test task 1 — verify PostgREST SELECT', user_a_id),
    (proj_id, 'Test task 2 — verify Realtime', user_a_id),
    (proj_id, 'Test task 3 — mark complete to test UPDATE', user_a_id);

  -- NOTE: Do NOT add user_b to the project yet.
  -- This is required for the RLS negative test:
  -- User B should be blocked from seeing these tasks.
  -- After negative test, add User B as viewer to test positive case:
  --   insert into public.project_members (project_id, user_id, role)
  --   values (proj_id, user_b_id, 'viewer');

  raise notice 'Seed complete. Project ID: %', proj_id;
end $$;
