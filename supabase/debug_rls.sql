-- ============================================================
-- DIAGNOSTIC: Chạy từng block này trong SQL Editor để debug
-- ============================================================

-- 1. Xem tất cả policies hiện tại trên bảng projects
select policyname, cmd, roles, qual, with_check
from pg_policies
where tablename = 'projects'
order by cmd;

-- ============================================================

-- 2. Xem tất cả policies trên project_members
select policyname, cmd, roles, qual, with_check
from pg_policies
where tablename = 'project_members'
order by cmd;

-- ============================================================

-- 3. Thử INSERT trực tiếp với service_role (bypass RLS)
-- Thay YOUR_USER_UUID bằng UUID thật của user A
-- Nếu lệnh này chạy được → vấn đề là RLS
-- Nếu lệnh này cũng fail → vấn đề là schema/column
insert into public.projects (name, description, created_by)
values ('Debug Test', 'Test via SQL Editor', 'YOUR_USER_UUID')
returning id, name, created_by;

-- ============================================================

-- 4. Kiểm tra xem hàm private.user_project_role tồn tại không
select routine_schema, routine_name, security_type
from information_schema.routines
where routine_schema = 'private'
order by routine_name;
