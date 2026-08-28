# Báo cáo Đánh giá Tương thích Supabase trên Vibe Host (Fixture A)

> **Mã Commit kiểm thử:** `65a3835f`  
> **Tên miền Deploy:** `https://app-b2jigz.cmc-1.vibenode.matbao.ai`  
> **Thời gian thực hiện:** 28/08/2026

---

## 1. Tóm tắt Kết quả (Executive Summary)

| Hạng mục | Kết quả | Ghi chú |
|---|---|---|
| **Import Git Repo** | ✅ PASS | Vibe Host tự động nhận diện framework **Next.js** (Port 3000) |
| **Nixpacks Build** | ✅ PASS | Node 22, `npm ci`, `npm run build` hoàn tất trong 8.1s |
| **Reverse Proxy & SSL** | ✅ PASS | Live thành công tại tên miền Vibe Host |
| **Chạy ứng dụng (Runtime)** | ✅ PASS | Ứng dụng hoạt động trơn tru, hiển thị dữ liệu từ Supabase |
| **Ghi dữ liệu (CRUD)** | ✅ PASS | Dữ liệu thêm mới trên Vibe Host xuất hiện ngay trên Supabase |
| **Supabase Classification** | 🟢 **PASS_EXTERNAL** | Tất cả 14 capability đều kết nối đến `*.supabase.co` |
| **Nhận diện sai Database** | ⚠️ **CẢNH BÁO** | Vibe Host **tự động provision 1 PostgreSQL thừa** & tiêm 22 biến env |

---

## 2. Nhật ký Build & Deploy trên Vibe Host (Build Output Analysis)

### Các Stage thực thi thành công:
1. **Stage 1 - 3 (Source Validation & Detect):** 
   - Nhận diện framework: `next`
   - Cấu hình Port: `3000`
2. **Stage 4 - 6 (Nixpacks Build & Containerization):**
   - Environment: `nodejs_22`, `npm-9_x`
   - Lệnh install: `npm ci`
   - Lệnh build: `npm run build` (Turbopack compile thành công)
   - Lệnh start: `next start -H 0.0.0.0 -p 3000`
3. **Stage 7 - 11 (Health Check & SSL):**
   - Reverse Proxy Traefikpromote live thành công sau 0.1s.

---

## 3. Bảng Phân loại Capability Supabase (Capability Matrix)

| Capability | Supabase Feature | Baseline (Local) | Vibe Host | Classification | Evidence / Ghi chú |
|---|---|---|---|---|---|
| **Auth** | `signUp` / `signIn` | PASS | PASS | `PASS_EXTERNAL` | Tạo session qua `vaolwhzfsfdkecmoidrs.supabase.co` |
| **PostgREST SELECT** | `supabase.from('projects').select()` | PASS | PASS | `PASS_EXTERNAL` | Đọc danh sách project từ Supabase Cloud |
| **PostgREST INSERT** | `supabase.from('tasks').insert()` | PASS | PASS | `PASS_EXTERNAL` | Thêm project/task hiển thị ngay trên Supabase |
| **PostgREST UPDATE** | `supabase.from('tasks').update()` | PASS | PASS | `PASS_EXTERNAL` | Đánh dấu completed cập nhật realtime |
| **RLS Positive** | `auth.uid()` member query | PASS | PASS | `PASS_EXTERNAL` | RLS cho phép member đọc/ghi dữ liệu |
| **RLS Negative** | Non-member blocked | PASS | PASS | `PASS_EXTERNAL` | RLS chặn user B không có quyền |
| **RPC Simple** | `get_project_stats()` | PASS | PASS | `PASS_EXTERNAL` | Gọi RPC function trên Supabase DB |
| **SECURITY DEFINER** | `private.can_edit_project()` | PASS | PASS | `PASS_EXTERNAL` | Chạy quyền elevated trên Supabase Postgres |
| **Storage Upload** | `storage.from('task-files').upload()` | PASS | PASS | `PASS_EXTERNAL` | Tải tệp (DOCX, PNG, PDF...) lên Supabase Storage |
| **Storage Read** | `storage.from('task-files').list()` | PASS | PASS | `PASS_EXTERNAL` | Liệt kê danh sách tệp storage |
| **Realtime** | `postgres_changes` websocket | PASS | PASS | `PASS_EXTERNAL` | Kết nối WebSocket tới Supabase Realtime |
| **Edge Function** | `functions.invoke()` | PASS | PASS | `PASS_EXTERNAL` | Gọi Deno Edge Function trên Supabase |

> **Phân loại `PASS_EXTERNAL`:** Ứng dụng chạy thành công trên Vibe Host nhưng toàn bộ logic backend (Auth, DB, Storage, Realtime, Functions) vẫn phụ thuộc và gọi trực tiếp tới hạ tầng **Supabase Hosted (`*.supabase.co`)**. Vibe Host không xử lý native các dịch vụ này.

---

## 4. Phân tích Hiện tượng Tự động Provision PostgreSQL (False Provisioning Detection)

Khi dán Git URL, Vibe Host tự động nhận diện dự án cần Database và thực hiện:
1. Tạo 1 database managed PostgreSQL tên **`app-b2jigz-db`** (`vays-db-53d66d24-postgresql-5432`).
2. Tự động tiêm (inject) **22 biến môi trường** liên quan đến PostgreSQL vào container:

### 📋 Danh sách 22 biến môi trường do Vibe Host tự tiêm:

```env
# Database Connections
DATABASE_CONNECTION=... (Vibe Host tự sinh)
DATABASE_URL=... (Vibe Host tự sinh)
DB_URI=... (Vibe Host tự sinh)
DB_URL=... (Vibe Host tự sinh)

# Database Host & Config
DB_HOST=vays-db-53d66d24-postgresql-5432
DB_NAME=app_b2jigz_db
DB_PASSWORD=... (Vibe Host tự sinh)
DB_PORT=5432
DB_USER=user_219802b39400

# Postgres Standard Variables
PGDATABASE=app_b2jigz_db
PGHOST=vays-db-53d66d24-postgresql-5432
PGPASSWORD=... (Vibe Host tự sinh)
PGPORT=5432
PGUSER=user_219802b39400

# Postgres & Prisma Injected Variables
POSTGRES_DATABASE=app_b2jigz_db
POSTGRES_HOST=vays-db-53d66d24-postgresql-5432
POSTGRES_PASSWORD=... (Vibe Host tự sinh)
POSTGRES_PORT=5432
POSTGRES_PRISMA_URL=... (Vibe Host tự sinh)
POSTGRES_URL=... (Vibe Host tự sinh)
POSTGRES_URL_NON_POOLING=... (Vibe Host tự sinh)
POSTGRES_USER=user_219802b39400
```

### Biến môi trường do người dùng khai báo thủ công:
```env
NEXT_PUBLIC_SUPABASE_URL=https://vaolwhzfsfdkecmoidrs.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 5. Kết luận Kiểm chứng cho Vibe Host Engine

1. **Khả năng Host Ứng dụng phụ thuộc Supabase:**
   - **ĐẠT (PASS):** Vibe Host import, build Nixpacks, cấp SSL và chạy Next.js App Router 16+ rất mượt mà.
   - Các API `@supabase/ssr` và `@supabase/supabase-js` hoạt động hoàn hảo từ môi trường Vibe Host.

2. **Tác động của việc tiêm `DATABASE_URL` thừa:**
   - Ứng dụng Fixture A **không bị ảnh hưởng hay gãy** vì ứng dụng dùng SDK Supabase kết nối qua HTTP PostgREST `NEXT_PUBLIC_SUPABASE_URL`.
   - Việc Vibe Host tự động tạo PostgreSQL `app-b2jigz-db` làm tiêu tốn tài nguyên thừa (provisioning không cần thiết) cho các ứng dụng thuần Supabase.

3. **Bản chất Host:**
   - **Vibe Host đóng vai trò Application Server (Web Host).**
   - Toàn bộ dữ liệu, Auth, RLS, Storage, Realtime vẫn do Supabase Cloud đảm nhận (`PASS_EXTERNAL`).

---

*Báo cáo được lập tự động dựa trên Log kiểm thử thực tế Vibe Host Deployment — 28/08/2026*
