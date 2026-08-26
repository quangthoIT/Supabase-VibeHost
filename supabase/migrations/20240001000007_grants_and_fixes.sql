-- ============================================================
-- Migration: 20240001000007_grants_and_fixes.sql
-- Purpose: Grant explicit permissions on schemas, tables, and functions
--          to anon, authenticated, and service_role roles.
--          Fixes 403 Forbidden errors on PostgREST RPC and table access.
-- ============================================================

-- --------------------------------------------------------
-- 1. Schema Grants
-- --------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema private to anon, authenticated, service_role;

-- --------------------------------------------------------
-- 2. Table Grants
-- --------------------------------------------------------
grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;

-- --------------------------------------------------------
-- 3. Function / Routine Grants
-- --------------------------------------------------------
grant execute on all functions in schema public to anon, authenticated, service_role;
grant execute on all functions in schema private to anon, authenticated, service_role;

-- --------------------------------------------------------
-- 4. Set Default Privileges for future objects
-- --------------------------------------------------------
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

alter default privileges in schema private grant all on functions to anon, authenticated, service_role;
