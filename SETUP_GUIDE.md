# Hướng dẫn Setup & Chạy — supabase-vibe-host-fixture

> Hướng dẫn đầy đủ, chi tiết, từng bước, kèm lệnh cho từng môi trường.  
> Đọc từ đầu đến cuối trước khi chạy lệnh đầu tiên.

---

## Mục lục

1. [Tổng quan luồng công việc](#1-tổng-quan-luồng-công-việc)
2. [Chuẩn bị môi trường local (Windows)](#2-chuẩn-bị-môi-trường-local-windows)
3. [Tạo Supabase Project](#3-tạo-supabase-project)
4. [Cài đặt Supabase CLI](#4-cài-đặt-supabase-cli)
5. [Cấu hình Environment Variables](#5-cấu-hình-environment-variables)
6. [Apply Database Migrations](#6-apply-database-migrations)
7. [Tạo Storage Bucket](#7-tạo-storage-bucket)
8. [Deploy Edge Function](#8-deploy-edge-function)
9. [Tạo Test Users](#9-tạo-test-users)
10. [Chạy App Local](#10-chạy-app-local)
11. [Chạy Automated Checks](#11-chạy-automated-checks)
12. [Baseline Test — Danh sách kiểm tra thủ công](#12-baseline-test--danh-sách-kiểm-tra-thủ-công)
13. [RLS Negative Test (bắt buộc — cần 2 user)](#13-rls-negative-test-bắt-buộc--cần-2-user)
14. [Import vào Vibe Host](#14-import-vào-vibe-host)
15. [Sau khi import — Test trên Vibe Host](#15-sau-khi-import--test-trên-vibe-host)
16. [Fixture B — Tạo branch supabase-plus-prisma](#16-fixture-b--tạo-branch-supabase-plus-prisma)
17. [Xử lý lỗi thường gặp](#17-xử-lý-lỗi-thường-gặp)
18. [Chú ý bảo mật](#18-chú-ý-bảo-mật)

---

## 1. Tổng quan luồng công việc

```
[Local]                        [Supabase Cloud]              [Vibe Host]
   |                                  |                           |
   | 1. npm install                   |                           |
   | 2. Tạo .env.local               |                           |
   | 3. supabase db push ────────────>| (apply migrations)        |
   | 4. supabase functions deploy ───>| (upload Edge Function)    |
   | 5. Tạo test users ──────────────>| (Auth users)              |
   | 6. npm run dev                   |                           |
   | 7. Baseline test (thủ công)      |                           |
   |                                  |                           |
   | 8. git push ─────────────────────────────────────────────>   |
   | 9. Import repo vào Vibe Host ────────────────────────────>   |
   |10. Set env vars trên Vibe Host ──────────────────────────>   |
   |11. Test /diagnostics trên Vibe Host ─────────────────────>   |
```

---

## 2. Chuẩn bị môi trường local (Windows)

### 2.1 Kiểm tra Node.js

Mở **PowerShell** hoặc **Windows Terminal**:

```powershell
node --version
# Cần >= 18.x
# Nếu chưa có: tải từ https://nodejs.org (LTS version)
```

```powershell
npm --version
# Cần >= 9.x
```

### 2.2 Kiểm tra Git

```powershell
git --version
# Nếu chưa có: https://git-scm.com/download/win
```

### 2.3 Clone repo (nếu chưa có)

> ⚠️ Nếu bạn đã có code tại `d:\test-supabase` (đã tạo ở bước trước), **bỏ qua bước này**.

```powershell
git clone <URL-của-repo> d:\test-supabase
cd d:\test-supabase
```

### 2.4 Install dependencies

```powershell
cd d:\test-supabase
npm install
```

**Output mong đợi:**
```
added 357 packages, and audited 357 packages in Xs
found 0 vulnerabilities
```

---

## 3. Tạo Supabase Project

> ⚠️ **QUAN TRỌNG**: Dùng project **không phải production**. Tạo mới hoàn toàn.

### Bước 3.1 — Đăng nhập Supabase Dashboard

Truy cập: **https://supabase.com/dashboard**

### Bước 3.2 — Tạo project mới

1. Nhấn **"New project"**
2. Chọn Organization (hoặc tạo mới)
3. Điền thông tin:
   - **Name**: `vibe-host-fixture-test` (hoặc tên tùy ý)
   - **Database Password**: đặt password mạnh, **lưu lại vào chỗ an toàn** (cần cho bước migration)
   - **Region**: chọn gần nhất (ví dụ: Southeast Asia)
4. Nhấn **"Create new project"**
5. Chờ ~1-2 phút để project được provisioned

### Bước 3.3 — Lấy thông tin kết nối

Sau khi project tạo xong, vào:
**Project Settings → API**

Ghi lại (copy):

| Thông tin | Tên field | Ví dụ |
|-----------|-----------|-------|
| Project URL | `Project URL` | `https://abcdefgh.supabase.co` |
| Anon/Public key | `anon public` | `eyJhbGci...` (dài ~200 ký tự) |
| Project Reference ID | Trên URL dashboard | `abcdefgh` (phần sau `project/`) |

> ⚠️ **KHÔNG** copy **service_role** key vào bất kỳ file nào trong repo.

### Bước 3.4 — Tắt email confirmation (cho dễ test)

Vào: **Authentication → Providers → Email**

- Tắt toggle **"Confirm email"** → **Save**

Làm vậy để test user không cần xác nhận email.

---

## 4. Cài đặt Supabase CLI

### Phương án A — Dùng npm (khuyên dùng trên Windows)

```powershell
npm install -g supabase
```

Kiểm tra:

```powershell
supabase --version
# Cần >= 1.x
```

### Phương án B — Dùng Scoop (Windows package manager)

```powershell
scoop install supabase
```

### Phương án C — Tải binary trực tiếp

Tải từ: https://github.com/supabase/cli/releases  
Giải nén → thêm vào PATH

### Đăng nhập CLI

```powershell
supabase login
```

Lệnh này sẽ mở browser để authenticate với Supabase account của bạn.  
Sau khi đăng nhập xong, terminal sẽ hiện: `Finished supabase login.`

---

## 5. Cấu hình Environment Variables

### Bước 5.1 — Tạo file .env.local

```powershell
cd d:\test-supabase
Copy-Item .env.example .env.local
```

### Bước 5.2 — Chỉnh sửa .env.local

Mở file `.env.local` (dùng Notepad, VS Code, hoặc bất kỳ editor nào):

```powershell
# Mở bằng VS Code
code .env.local

# Hoặc mở bằng Notepad
notepad .env.local
```

Điền vào 2 dòng sau (lấy từ Bước 3.3):

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...
```

**Lưu file lại.**

### Bước 5.3 — Kiểm tra file không bị commit

```powershell
git status
```

File `.env.local` **KHÔNG được** xuất hiện trong `git status`. Nếu xuất hiện, kiểm tra lại `.gitignore`.

---

## 6. Apply Database Migrations

Có 2 cách: dùng **Supabase CLI** (khuyên dùng) hoặc **SQL Editor thủ công**.

---

### Cách 1 — Dùng Supabase CLI (khuyên dùng)

#### Bước 6.1 — Link project

```powershell
cd d:\test-supabase
supabase link --project-ref abcdefgh
```

Thay `abcdefgh` bằng Project Reference ID lấy từ Bước 3.3.

Khi hỏi database password, nhập password đã tạo ở Bước 3.2.

**Output mong đợi:**
```
Finished supabase link.
```

#### Bước 6.2 — Push migrations

```powershell
supabase db push
```

**Output mong đợi:**
```
Applying migration 20240001000000_schema.sql...
Applying migration 20240001000001_rls.sql...
Applying migration 20240001000002_rpc.sql...
Applying migration 20240001000003_storage.sql...
Finished supabase db push.
```

#### Bước 6.3 — Kiểm tra migrations đã apply

Vào Supabase Dashboard → **Table Editor**:

Bạn phải thấy 4 bảng:
- `profiles`
- `projects`
- `project_members`
- `tasks`

---

### Cách 2 — SQL Editor thủ công (dùng khi CLI không hoạt động)

Vào Supabase Dashboard → **SQL Editor** → chạy lần lượt từng file:

**File 1:** Copy toàn bộ nội dung file `supabase/migrations/20240001000000_schema.sql` → Paste → **Run**

**File 2:** Copy toàn bộ nội dung file `supabase/migrations/20240001000001_rls.sql` → Paste → **Run**

**File 3:** Copy toàn bộ nội dung file `supabase/migrations/20240001000002_rpc.sql` → Paste → **Run**

**File 4:** Copy toàn bộ nội dung file `supabase/migrations/20240001000003_storage.sql` → Paste → **Run**

> ⚠️ **Thứ tự quan trọng**: Phải chạy theo đúng thứ tự 0 → 1 → 2 → 3 vì có foreign key dependencies.

---

## 7. Tạo Storage Bucket

Storage bucket `task-files` được tạo bởi migration file 4 (`20240001000003_storage.sql`).

### Kiểm tra bucket đã được tạo

Vào Supabase Dashboard → **Storage**:

Bạn phải thấy bucket tên `task-files` (private).

### Nếu bucket chưa có — tạo thủ công

1. Vào **Storage → New bucket**
2. **Name**: `task-files`
3. **Public bucket**: **TẮT** (private)
4. **File size limit**: `50MB`
5. **Allowed MIME types**: để trống (hoặc thêm `image/*,application/pdf,text/plain`)
6. **Save**

Sau đó vào **SQL Editor** → chạy các policy:

```sql
-- Policy: authenticated users upload
create policy "authenticated users can upload task files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'task-files'
    and auth.uid() is not null
  );

-- Policy: authenticated users download
create policy "authenticated users can view task files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'task-files'
    and auth.uid() is not null
  );
```

---

## 8. Deploy Edge Function

### Bước 8.1 — Kiểm tra CLI đã link project

```powershell
supabase status
```

Nếu chưa link, chạy lại:
```powershell
supabase link --project-ref abcdefgh
```

### Bước 8.2 — Deploy function

```powershell
cd d:\test-supabase
supabase functions deploy send-task-notification
```

**Output mong đợi:**
```
Deploying Function send-task-notification (Script size: X KB)
Done: send-task-notification
```

### Bước 8.3 — Kiểm tra function đã deploy

Vào Supabase Dashboard → **Edge Functions**:

Bạn phải thấy function `send-task-notification` với status **Active**.

### Bước 8.4 — Test function thủ công (tùy chọn)

```powershell
# Lấy JWT token sau khi đăng nhập vào app
# Sau đó test bằng curl (cần có curl trên Windows)
curl -L -X POST https://abcdefgh.supabase.co/functions/v1/send-task-notification `
  -H "Authorization: Bearer YOUR_JWT_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"taskId":"test-uuid-here"}'
```

---

## 9. Tạo Test Users

### Bước 9.1 — Tạo User A (Owner)

Vào Supabase Dashboard → **Authentication → Users → Invite user**

- **Email**: `test-user-a@example.com` (hoặc email thật bạn kiểm soát)
- **Password**: đặt password mạnh

Hoặc dùng Sign Up form trên app (sau khi chạy `npm run dev`).

### Bước 9.2 — Tạo User B (Viewer / Negative test)

Tương tự, tạo thêm:
- **Email**: `test-user-b@example.com`

### Bước 9.3 — Ghi lại UUID của cả 2 user

Vào **Authentication → Users** → click vào từng user → copy **User UID** (dạng UUID).

```
User A UID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
User B UID: yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
```

Lưu lại, cần cho bước seed.

### Bước 9.4 — Seed dữ liệu test (tùy chọn nhưng tiết kiệm thời gian)

Mở file `supabase/seed.sql`, tìm và thay:
- `REPLACE_WITH_USER_A_UUID` → UUID của User A
- `REPLACE_WITH_USER_B_UUID` → UUID của User B

Sau đó bỏ comment (`/* ... */`) phần do $$:

```sql
do $$
declare
  user_a_id uuid := 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';  -- User A UUID
  user_b_id uuid := 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy';  -- User B UUID
  proj_id   uuid;
begin
  insert into public.projects (id, name, description, created_by)
  values (
    gen_random_uuid(),
    'Fixture Test Project',
    'Used for baseline and Vibe Host import testing',
    user_a_id
  )
  returning id into proj_id;

  insert into public.project_members (project_id, user_id, role)
  values (proj_id, user_a_id, 'owner');

  insert into public.tasks (project_id, title, created_by)
  values
    (proj_id, 'Test task 1 — verify PostgREST SELECT', user_a_id),
    (proj_id, 'Test task 2 — verify Realtime', user_a_id),
    (proj_id, 'Test task 3 — mark complete to test UPDATE', user_a_id);

  raise notice 'Seed complete. Project ID: %', proj_id;
end $$;
```

Chạy trong **SQL Editor** trên Supabase Dashboard.

---

## 10. Chạy App Local

```powershell
cd d:\test-supabase
npm run dev
```

**Output mong đợi:**
```
▲ Next.js 16.x.x
- Local:        http://localhost:3000
- Ready in Xms
```

Mở browser: **http://localhost:3000**

Sẽ redirect tự động đến `/login`.

---

## 11. Chạy Automated Checks

Mở **PowerShell mới** (giữ nguyên terminal đang chạy `npm run dev`):

```powershell
cd d:\test-supabase

# 1. TypeScript — không có lỗi type
npm run typecheck

# 2. Build production — phải thành công
npm run build

# 3. Static marker verification — 28/28 PASS
npm run verify:fixture

# 4. ESLint
npm run lint
```

**Kết quả mong đợi cho verify:fixture:**
```
🔍 supabase-vibe-host-fixture — Static Verification

   Scanning 20 files...

  ✅ Package: @supabase/supabase-js
  ✅ Auth: supabase.auth.signUp
  ... (tất cả 28 dòng ✅)

  Results: 28 passed, 0 failed

✅ All fixture markers verified — static checks passed.
```

---

## 12. Baseline Test — Danh sách kiểm tra thủ công

**Đăng nhập bằng User A** → chạy qua từng test dưới đây.

### 12.1 Auth

| Test | Cách test | Kết quả mong đợi |
|------|-----------|------------------|
| Sign Up | Vào `/login` → tab "Sign Up" → điền email/pass → Submit | Tài khoản tạo thành công, redirect đến `/projects` |
| Sign In | Vào `/login` → tab "Sign In" → điền email/pass | Redirect đến `/projects` |
| Sign Out | Nhấn "Sign Out" ở header | Redirect về `/login` |
| Session sau reload | Đăng nhập → F5 trang | Vẫn ở trang `/projects`, không bị logout |

### 12.2 PostgREST

| Test | Cách test | Kết quả mong đợi |
|------|-----------|------------------|
| SELECT | Vào `/projects` | Hiện danh sách project (hoặc empty nếu chưa có) |
| INSERT project | Điền tên project → "Create Project" | Project xuất hiện trong danh sách |
| INSERT task | Vào project → điền task title → "Add Task" | Task xuất hiện ngay lập tức |
| UPDATE task | Check checkbox bên cạnh task | Task có gạch ngang (completed = true) |

### 12.3 RPC

| Test | Cách test | Kết quả mong đợi |
|------|-----------|------------------|
| get_project_stats | Vào project detail | Hiện số Total/Done/Todo tasks |
| check_can_edit_project | Vào project detail → xem "SECURITY DEFINER" card | Hiện "YES" |

### 12.4 Storage

| Test | Cách test | Kết quả mong đợi |
|------|-----------|------------------|
| Upload file | Vào project → nhấn "↑ File" bên cạnh task → chọn file | Hiện "Uploaded: ..." |
| Đọc file | Vào `/diagnostics` → Run diagnostics | "Storage — read/list: PASS" |

### 12.5 Realtime

**Cần 2 tab browser:**

1. Mở **Tab 1**: vào project detail
2. Mở **Tab 2**: vào **cùng project**
3. Ở Tab 1: tạo task mới
4. Kết quả mong đợi ở **Tab 2**: task mới xuất hiện **không cần F5**
5. Ở Tab 2: xem phần "Realtime: SUBSCRIBED" và log events

### 12.6 Edge Function

| Test | Cách test | Kết quả mong đợi |
|------|-----------|------------------|
| Invoke | Vào project → nhấn "⚡ Notify" bên cạnh task | Hiện JSON response với `"accepted": true` |

### 12.7 /diagnostics — chạy tất cả

1. Mở http://localhost:3000/diagnostics
2. (Tùy chọn) Paste Project UUID vào ô input
3. Nhấn **"▶ Run All Diagnostics"**
4. Chờ ~15-20 giây
5. Kết quả mong đợi: **tất cả 14 checks PASS**

---

## 13. RLS Negative Test (bắt buộc — cần 2 user)

> Đây là acceptance test bắt buộc. Không ghi PASS cho RLS nếu chưa test negative case.

### Chuẩn bị

- **Browser 1** (hoặc Incognito): đăng nhập **User A**
- **Browser 2** (hoặc Profile khác): đăng nhập **User B**

### Test Case 1 — Non-member không thấy project

```
1. [User A - Browser 1]
   - Tạo project "Secret Project"
   - Ghi lại Project ID (hiển thị trong URL hoặc trên trang detail)

2. [User B - Browser 2]
   - Vào http://localhost:3000/projects
   - Expected: KHÔNG thấy "Secret Project"
   - Hiện: "No projects yet"

3. [User B - Browser 2]
   - Vào http://localhost:3000/projects/<Project-ID-của-User-A>
   - Expected: "not found" hoặc redirect về /projects
```

**Nếu User B thấy project → RLS bị lỗi. DỪNG LẠI và kiểm tra migrations.**

### Test Case 2 — /diagnostics từ góc độ User B

```
1. [User B - Browser 2]
   - Vào http://localhost:3000/diagnostics
   - Nhấn "Run All Diagnostics"
   - PostgREST SELECT: PASS (0 projects — đúng, vì không phải member)
   - RLS negative: PASS (fake project trả 0 rows)
```

### Test Case 3 — Add User B làm Viewer

```
1. [User A - Browser 1]
   - Vào project "Secret Project"
   - Phần "Members" → nhập UUID của User B → chọn "viewer" → "Add Member"

2. [User B - Browser 2]
   - F5 trang /projects
   - Expected: thấy "Secret Project" xuất hiện

3. [User B - Browser 2, Viewer]
   - Vào project → thử tạo task
   - Expected: lỗi "INSERT error" (RLS blocks INSERT for viewer)

4. [User B - Browser 2, Viewer]
   - Thử check task checkbox
   - Expected: checkbox không thay đổi (RLS blocks UPDATE for viewer)
```

### Ghi lại kết quả

| Test | Kết quả |
|------|---------|
| Non-member không thấy project | PASS / FAIL |
| Non-member không đọc được task | PASS / FAIL |
| Add viewer → thấy project | PASS / FAIL |
| Viewer không INSERT được | PASS / FAIL |
| Viewer không UPDATE được | PASS / FAIL |

**Chỉ sau khi tất cả 5 test trên PASS mới ghi "RLS: PASS" vào báo cáo.**

---

## 14. Import vào Vibe Host

> ⚠️ **Điều kiện tiên quyết**: Tất cả baseline tests phải PASS trước khi import.

### Bước 14.1 — Push code lên GitHub/GitLab

```powershell
cd d:\test-supabase

# Nếu chưa có remote
git remote add origin https://github.com/your-username/supabase-vibe-host-fixture.git

# Commit tất cả code
git add .
git commit -m "feat: supabase vibe host fixture - all capabilities implemented"

# Push
git push -u origin main
```

**Kiểm tra trước khi push:**
```powershell
# Đảm bảo .env.local KHÔNG có trong git
git status
# .env.local KHÔNG được xuất hiện trong output
```

### Bước 14.2 — Import vào Vibe Host

1. Đăng nhập Vibe Host
2. **Import từ Git repo**
3. Chọn repo `supabase-vibe-host-fixture`
4. **Ghi lại mọi thứ Vibe Host detect và hiển thị** (screenshot nếu có thể):
   - Vibe Host detect framework gì?
   - Vibe Host suggest provision database nào?
   - Có tự động thêm `DATABASE_URL` không?

### Bước 14.3 — Set Environment Variables trên Vibe Host

Tìm phần **Environment Variables** trong Vibe Host settings:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abcdefgh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGci...` (anon key) |

> ⚠️ **KHÔNG** set `DATABASE_URL` trỏ vào Supabase database. Nếu Vibe Host tự inject `DATABASE_URL`, ghi lại giá trị đó (sanitized — không paste vào report nếu chứa password).

### Bước 14.4 — Deploy và ghi log

1. Trigger build/deploy
2. **Copy toàn bộ build log** → lưu vào file `vibe-host-build-log.txt`
3. Chú ý các dòng:
   - Có auto-detect PostgreSQL không?
   - Có chạy `prisma migrate` hoặc `db push` không?
   - Có fail với lỗi missing `DATABASE_URL` không?

---

## 15. Sau khi import — Test trên Vibe Host

### Bước 15.1 — Mở URL của Vibe Host app

URL dạng: `https://your-app.vibehost.io` (hoặc tương tự)

### Bước 15.2 — Mở /diagnostics

Truy cập: `https://your-app.vibehost.io/diagnostics`

Nhấn **"▶ Run All Diagnostics"** và ghi lại kết quả.

**Đặc biệt chú ý:**
- **Supabase API Host** hiển thị gì? → phải là `abcdefgh.supabase.co`
- Nếu hiển thị IP local hoặc địa chỉ Vibe Host → cần điều tra

### Bước 15.3 — Điền test matrix

Ghi kết quả vào bảng sau (dùng [README.md](./README.md) section "Vibe Host Import Test"):

| Test | Baseline | Vibe Host | Classification | Evidence |
|------|----------|-----------|----------------|---------|
| Repo import | PASS | ? | | Screenshot |
| Build | PASS | ? | | Build log |
| Login (Auth) | PASS | ? | | Screenshot hoặc response |
| Session reload | PASS | ? | | |
| PostgREST SELECT | PASS | ? | | /diagnostics screenshot |
| PostgREST INSERT | PASS | ? | | |
| RLS allowed | PASS | ? | | |
| RLS denied | PASS | ? | | |
| RPC simple | PASS | ? | | |
| SECURITY DEFINER flow | PASS | ? | | |
| Storage upload | PASS | ? | | |
| Storage read | PASS | ? | | |
| Realtime | PASS | ? | | |
| Edge Function | PASS | ? | | |
| DATABASE_URL injected | N/A | ? | | Kiểm tra env vars trên Vibe Host |
| PostgreSQL provisioned | N/A | ? | | Vibe Host resource panel |

**Phân loại (Classification):** Dùng các code sau:
- `PASS_NATIVE` — Vibe Host xử lý native
- `PASS_EXTERNAL` — App trên Vibe Host, vẫn gọi `*.supabase.co`
- `FAIL_IMPORT` — Vibe Host không import được
- `FAIL_BUILD` — Import OK, build fail
- `FAIL_RUNTIME` — Build OK, capability fail khi chạy
- `FAIL_AUTHORIZATION` — Function chạy nhưng security sai
- `UNKNOWN` — Không đủ evidence
- `NOT_TESTED` — Chưa test

---

## 16. Fixture B — Tạo branch supabase-plus-prisma

> Chỉ thực hiện sau khi **Fixture A baseline đã xanh hoàn toàn**.

### Mục đích

Test xem Vibe Host có bị nhầm khi thấy Prisma/`pg`/`DATABASE_URL` mà tự provision PostgreSQL không.

### Bước 16.1 — Tạo branch mới

```powershell
cd d:\test-supabase
git checkout -b supabase-plus-prisma
```

### Bước 16.2 — Thêm Prisma (chỉ dependency, không dùng cho CRUD)

```powershell
npm install prisma @prisma/client
npx prisma init
```

Lệnh `prisma init` tạo file `prisma/schema.prisma` và thêm `DATABASE_URL` vào `.env`.

**KHÔNG** migrate hoặc generate Prisma client.  
**KHÔNG** thay CRUD code sang Prisma.  
Chỉ cần dependency tồn tại trong `package.json`.

### Bước 16.3 — Thêm DATABASE_URL placeholder vào .env.example

```env
# Fixture B only — used to test Vibe Host false provisioning detection
# This app does NOT use this URL for business logic (all CRUD via Supabase PostgREST)
DATABASE_URL=
```

### Bước 16.4 — Commit

```powershell
git add .
git commit -m "fixture-b: add prisma signal to test Vibe Host false PostgreSQL provisioning"
git push -u origin supabase-plus-prisma
```

### Bước 16.5 — Import branch `supabase-plus-prisma` vào Vibe Host

Quan sát và ghi lại:

| Câu hỏi | Quan sát |
|---------|---------|
| Vibe Host có detect "cần PostgreSQL" không? | ? |
| Có provision PostgreSQL mới không? | ? |
| Có inject `DATABASE_URL` trỏ vào PostgreSQL mới không? | ? |
| Giá trị `DATABASE_URL` đó trỏ đến đâu? (Supabase hay Vibe Host?) | ? |
| App CRUD vẫn dùng Supabase không? (/diagnostics PASS?) | ? |
| Có phát sinh thêm chi phí/resource không? | ? |

---

## 17. Xử lý lỗi thường gặp

### Lỗi: "Cannot find module '@supabase/ssr'"

```powershell
npm install @supabase/ssr @supabase/supabase-js
```

### Lỗi: "supabase: command not found"

```powershell
# Nếu dùng npm global
npm install -g supabase

# Kiểm tra PATH
where supabase
```

### Lỗi: "supabase db push" — authentication failed

```powershell
supabase logout
supabase login
supabase link --project-ref abcdefgh
```

### Lỗi: "Error applying migration" — relation already exists

Các bảng đã được tạo trước. Reset và apply lại:

Vào Supabase Dashboard → **SQL Editor** → chạy:

```sql
-- CẢNH BÁO: XÓA TOÀN BỘ DỮ LIỆU — chỉ dùng trên non-production
drop table if exists public.tasks cascade;
drop table if exists public.project_members cascade;
drop table if exists public.projects cascade;
drop table if exists public.profiles cascade;
drop function if exists public.handle_updated_at cascade;
drop function if exists public.handle_new_user cascade;
drop function if exists public.get_project_stats cascade;
drop function if exists public.check_can_edit_project cascade;
drop schema if exists private cascade;
```

Sau đó chạy lại `supabase db push`.

### Lỗi: Build fail — "prerender error"

Kiểm tra `app/diagnostics/page.tsx` có dòng:

```typescript
export const dynamic = "force-dynamic";
```

Nếu thiếu, thêm vào sau import statements.

### Lỗi: Edge Function trả về 401

Edge Function yêu cầu JWT token. Kiểm tra:
1. Bạn đã đăng nhập vào app chưa?
2. Token có đang còn hạn không? (thử sign out và sign in lại)

### Lỗi: Storage upload 403

Policy chưa được apply. Vào **SQL Editor** → chạy lại file `20240001000003_storage.sql`.

### Lỗi: Realtime không hoạt động

1. Kiểm tra migration `20240001000001_rls.sql` có dòng:
   ```sql
   alter publication supabase_realtime add table public.tasks;
   ```
2. Chạy lại dòng đó nếu thiếu.
3. Kiểm tra Supabase Dashboard → **Database → Publications** → `supabase_realtime` → phải có table `tasks`.

### Lỗi: "middleware" deprecated trên Next.js 16

Đã được fix bằng `proxy.ts`. Nếu thấy warning:

```powershell
# Chỉ cần đảm bảo file proxy.ts tồn tại và export đúng
Get-Content proxy.ts
# Phải thấy: "export async function proxy"
```

### Lỗi: Vibe Host inject DATABASE_URL sai

Ghi lại evidence:
1. Vào Vibe Host → Environment Variables → xem giá trị `DATABASE_URL`
2. Nếu nó trỏ đến Vibe Host PostgreSQL (không phải Supabase) → classify `FAIL_RUNTIME` cho các capability liên quan
3. Ghi rõ trong báo cáo: "Vibe Host đã override DATABASE_URL"

---

## 18. Chú ý bảo mật

### Tuyệt đối KHÔNG commit

```
.env.local
.env
SUPABASE_SERVICE_ROLE_KEY (bất kỳ file nào)
DATABASE_URL (nếu chứa password thật)
Bất kỳ JWT token nào
```

### Kiểm tra trước mỗi lần push

```powershell
# Liệt kê files sẽ được commit
git diff --staged --name-only

# Tìm kiếm secret có thể bị commit nhầm
git grep -r "supabase.co" --staged
git grep -r "eyJhbGci" --staged
```

### Files an toàn để commit

```
.env.example          ← CHỈ chứa tên biến, không có giá trị
supabase/migrations/  ← SQL không chứa credential
supabase/functions/   ← Deno code không chứa secret
supabase/config.toml  ← Không chứa secret
README.md, *.md       ← Không chứa secret
```

### Test accounts

- Dùng email throwaway (không phải email thật)
- Password test account không dùng lại ở nơi khác
- Sau khi test xong, xóa test accounts khỏi Supabase Dashboard

---

## Tóm tắt các lệnh quan trọng

```powershell
# === SETUP ===
cd d:\test-supabase
npm install
Copy-Item .env.example .env.local
# (điền SUPABASE_URL và SUPABASE_PUBLISHABLE_KEY vào .env.local)

# === SUPABASE CLI ===
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy send-task-notification

# === VERIFY ===
npm run typecheck
npm run build
npm run verify:fixture

# === RUN ===
npm run dev
# Mở http://localhost:3000

# === GIT ===
git status              # kiểm tra .env.local không bị track
git add .
git commit -m "..."
git push origin main

# === FIXTURE B ===
git checkout -b supabase-plus-prisma
npm install prisma @prisma/client
npx prisma init
git add .
git commit -m "fixture-b: add prisma signal"
git push -u origin supabase-plus-prisma
```

---

*Tạo bởi Antigravity — supabase-vibe-host-fixture v1.0*
