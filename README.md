# supabase-vibe-host-fixture

> **Fixture A** — Supabase capability regression test for Vibe Host compatibility.

---

## Purpose

This repository is a **regression fixture** for testing Supabase compatibility when importing and hosting applications on **Vibe Host**.

It is deliberately designed to:
- Exercise every major Supabase capability with real API calls (no mocks).
- Provide clear evidence of which capabilities work after import.
- Distinguish between capabilities running **natively on Vibe Host** vs. those still calling **Supabase hosted services**.
- Detect false-positive database provisioning (see Fixture B).

This is **not** a migration fixture. It is a compatibility test.

---

## Capabilities Tested

| Capability | Supabase Feature | Evidence Path |
|---|---|---|
| Auth | `supabase.auth.signUp/signIn/signOut/getUser` | `/login` page |
| PostgREST SELECT | `supabase.from('projects').select()` | `/projects` page |
| PostgREST INSERT | `supabase.from('tasks').insert()` | Project board |
| PostgREST UPDATE | `supabase.from('tasks').update()` | Task complete toggle |
| RLS (positive) | auth.uid() policies, member SELECT | `/diagnostics` |
| RLS (negative) | Non-member blocked | `/diagnostics` + 2-user test |
| RPC simple | `supabase.rpc('get_project_stats', ...)` | Project board stats |
| SECURITY DEFINER | `private.can_edit_project()` + wrapper | Migration + `/diagnostics` |
| Storage upload | `supabase.storage.from('task-files').upload()` | Task file upload |
| Storage read | `supabase.storage.from('task-files').list()` | `/diagnostics` |
| Realtime | `supabase.channel().on('postgres_changes', ...)` | Project board |
| Edge Function | `supabase.functions.invoke('send-task-notification')` | Project board |

---

## Technology Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **@supabase/supabase-js** v2
- **@supabase/ssr** (server-side session handling)
- **Vanilla CSS** (no Tailwind)
- No ORM (no Prisma, no Drizzle) in Fixture A

---

## Setup

### Prerequisites

- Node.js 18+
- A **non-production** Supabase project
  - Create at: [supabase.com/dashboard](https://supabase.com/dashboard)
  - Do NOT use production credentials
- Supabase CLI (for migrations + Edge Function deploy)
  - Install: `npm install -g supabase`

### 1. Clone & install

```bash
git clone <this-repo>
cd supabase-vibe-host-fixture
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

Get these from: **Supabase Dashboard > Project Settings > API**

> ⚠️ Never commit `.env.local`. Never use production credentials.

### 3. Apply database migrations

```bash
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

This applies all migrations in `supabase/migrations/`:
1. `20240001000000_schema.sql` — Tables + triggers
2. `20240001000001_rls.sql` — RLS policies
3. `20240001000002_rpc.sql` — RPC + SECURITY DEFINER
4. `20240001000003_storage.sql` — Storage bucket

Alternatively, apply them manually via Supabase Dashboard > SQL Editor.

> **Important**: After applying migrations, disable email confirmation in Supabase Dashboard > Auth > Settings > "Enable email confirmations" (set to OFF) for easier local testing.

### 4. Deploy the Edge Function

```bash
supabase functions deploy send-task-notification
```

### 5. Create test users

In Supabase Dashboard > Authentication > Users, create two test accounts:

| User | Email | Role in fixture |
|------|-------|-----------------|
| User A | test-a@example.com | Owner (creates project) |
| User B | test-b@example.com | Used for RLS negative test |

> These are test accounts only. Use throwaway emails.

### 6. Seed test data (optional)

Edit `supabase/seed.sql`, fill in the user UUIDs from step 5, then run via SQL Editor.

### 7. Run locally

```bash
npm run dev
```

Open: http://localhost:3000

---

## Baseline Test (run before Vibe Host import)

### Automated checks

```bash
npm run typecheck      # TypeScript — no errors
npm run build          # Next.js build — must succeed
npm run verify:fixture # Static marker checks — all PASS
```

### Manual capability checklist

Sign in as User A, then run through these tests:

| Test | Expected | Notes |
|------|----------|-------|
| Build Next.js | PASS | `npm run build` |
| Sign Up | PASS | New user created in Supabase Auth |
| Sign In | PASS | Session established |
| Session after reload | PASS | Still logged in after F5 |
| Create project | PASS | Project appears in list |
| PostgREST SELECT | PASS | Projects visible at /projects |
| Create task | PASS | Task appears in project board |
| Complete task | PASS | Task marked done via UPDATE |
| RPC get_project_stats | PASS | Stats update in project board |
| SECURITY DEFINER RPC | PASS | check_can_edit_project returns true for owner |
| Storage upload | PASS | File attached to task |
| Storage list | PASS | File appears in /diagnostics |
| Realtime | PASS | Open 2 tabs, create task in tab 1, see it in tab 2 without refresh |
| Edge Function | PASS | Invoke button shows accepted:true |

### RLS negative test (requires 2 users)

1. Sign in as **User A**, create a project — note the Project ID.
2. **Do NOT add User B** to the project.
3. Sign in as **User B** in another browser.
4. Go to `/projects` — User B must see **0 projects**.
5. Try to navigate to `/projects/<Project-A-ID>` — must show "not found" or empty.
6. At `/diagnostics`, run diagnostics as User B — `RLS positive` must FAIL (0 rows), which confirms User B is blocked.
7. Now add User B as **viewer** (as User A, use the Members panel in the project board).
8. Sign back in as User B — project should now be visible.
9. As User B (viewer), try to create a task — must fail (RLS blocks INSERT).
10. As User B (viewer), try to check the task checkbox — must fail (RLS blocks UPDATE).

> ✅ Only when both positive AND negative cases are confirmed should you record `RLS: PASS`.

---

## Vibe Host Import Test

After baseline passes, import this repo to Vibe Host and record results.

| Test | Baseline | Vibe Host | Classification | Evidence |
|------|----------|-----------|---------------|---------|
| Repo import | PASS | PASS | `PASS` | Import Git URL `@ 65a3835f` |
| Dependency detection | PASS | PASS | `PASS` | Framework `next` (Port 3000) detected |
| Build | PASS | PASS | `PASS` | Nixpacks `npm run build` clean in 8.1s |
| Startup | PASS | PASS | `PASS` | Live at `app-b2jigz.cmc-1.vibenode.matbao.ai` |
| Login (Auth) | PASS | PASS | `PASS_EXTERNAL` | `vaolwhzfsfdkecmoidrs.supabase.co` |
| Session after reload | PASS | PASS | `PASS_EXTERNAL` | Cookie session active |
| PostgREST SELECT | PASS | PASS | `PASS_EXTERNAL` | Projects & tasks loaded |
| PostgREST INSERT | PASS | PASS | `PASS_EXTERNAL` | Created projects & tasks |
| RLS allowed | PASS | PASS | `PASS_EXTERNAL` | Member CRUD permitted |
| RLS denied | PASS | PASS | `PASS_EXTERNAL` | Non-member blocked |
| RPC simple | PASS | PASS | `PASS_EXTERNAL` | `get_project_stats()` returned stats |
| SECURITY DEFINER flow | PASS | PASS | `PASS_EXTERNAL` | `private.can_edit_project()` elevated |
| Storage upload | PASS | PASS | `PASS_EXTERNAL` | Uploaded DOCX / images to bucket |
| Storage read | PASS | PASS | `PASS_EXTERNAL` | Listed files in `task-files` bucket |
| Realtime | PASS | PASS | `PASS_EXTERNAL` | WebSocket connected |
| Edge Function invoke | PASS | PASS | `PASS_EXTERNAL` | `send-task-notification` invoked |
| Database auto-provision | N/A | YES | `FALSE_PROVISION` | Vibe Host created `app-b2jigz-db` |
| DATABASE_URL injected | N/A | YES | `FALSE_INJECT` | Vibe Host injected 22 DB env vars |

### Classification codes

| Code | Meaning |
|------|---------|
| `PASS_NATIVE` | Vibe Host handles this natively |
| `PASS_EXTERNAL` | App on Vibe Host, capability calls `*.supabase.co` |
| `FAIL_IMPORT` | Vibe Host could not import the repo |
| `FAIL_BUILD` | Import OK, build failed |
| `FAIL_RUNTIME` | Build OK, capability fails at runtime |
| `FAIL_AUTHORIZATION` | Function runs but security behavior is wrong |
| `UNKNOWN` | Insufficient evidence |
| `NOT_TESTED` | Not yet tested |

### What to check on Vibe Host deploy

1. **Environment variables**: Did Vibe Host correctly pass `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`?
2. **DATABASE_URL**: Did Vibe Host inject a `DATABASE_URL` or `POSTGRES_URL`? If yes, what value? Does it point to Supabase's database or a provisioned one?
3. **Extra services**: Did Vibe Host provision a managed PostgreSQL?
4. **Build logs**: Any errors related to database detection or migration auto-run?
5. **Runtime host**: At `/diagnostics`, check the `Supabase API Host` field — does it show `*.supabase.co`?

---

## Fixture B — False PostgreSQL Provisioning Test

> See branch: `supabase-plus-prisma`

Fixture B adds Prisma (or `pg` / `DATABASE_URL`) as a deliberate signal to test whether Vibe Host incorrectly:

- Detects the app as requiring a managed PostgreSQL
- Provisions a PostgreSQL database automatically
- Injects `DATABASE_URL` pointing to a Vibe Host database instead of Supabase
- Changes the app's data behavior without explicit configuration

**Important**: Fixture B does NOT change business logic. All CRUD still goes through Supabase PostgREST.

---

## Interpretation

> Running successfully on Vibe Host while all `/diagnostics` checks show `PASS` and the API host is `*.supabase.co` proves that **Vibe Host can host a Supabase-dependent application**.
>
> It does **NOT** prove that Supabase was replaced, migrated, or made redundant. Every capability that shows `PASS_EXTERNAL` is still depending on the external Supabase hosted service.

### What "PASS" actually means

- **PASS_EXTERNAL**: App functions correctly on Vibe Host, but Supabase Auth, PostgREST, Storage, Realtime, and Edge Functions all continue to be served from `*.supabase.co`.
- **PASS_NATIVE**: Vibe Host itself handles the capability without calling back to Supabase. This is expected to be rare in Fixture A.

### What would constitute "Supabase replaced"

For a capability to be classified as `PASS_NATIVE`, there must be evidence that:
1. The network call does NOT go to `*.supabase.co`
2. The capability is handled by Vibe Host infrastructure
3. Removing Supabase credentials would not break the capability

---

## Security

- Never commit `.env.local`
- Never commit `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, or `DATABASE_URL` with real credentials
- The `.env.example` file contains only placeholder variable names
- This fixture uses a non-production Supabase project only
- Test user credentials must be throwaway accounts
- Do not include customer data or production data in seed files

---

## Project Structure

```
supabase-vibe-host-fixture/
├── app/
│   ├── auth/callback/        # Auth email confirmation handler
│   ├── diagnostics/          # ← Primary capability test dashboard
│   ├── login/                # Auth: signUp + signIn
│   └── projects/
│       ├── page.tsx          # Project list (SELECT + INSERT)
│       ├── CreateProjectForm.tsx
│       └── [id]/
│           ├── page.tsx      # Server shell (initial data load)
│           └── ProjectBoard.tsx  # ← All capabilities: Realtime, Storage, RPC, Edge Fn
├── components/
│   └── AppHeader.tsx
├── lib/supabase/
│   ├── client.ts             # Browser client
│   ├── server.ts             # Server client
│   └── middleware.ts         # Session refresh
├── middleware.ts             # Route protection
├── scripts/
│   └── verify-fixture.mjs   # Static marker verification
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 20240001000000_schema.sql  # Tables
│   │   ├── 20240001000001_rls.sql     # RLS + policies
│   │   ├── 20240001000002_rpc.sql     # RPC + SECURITY DEFINER
│   │   └── 20240001000003_storage.sql # Storage bucket
│   ├── functions/
│   │   └── send-task-notification/index.ts
│   └── seed.sql
├── .env.example
└── README.md
```

---

## Scripts

```bash
npm run dev            # Start dev server at localhost:3000
npm run build          # Production build (baseline verification)
npm run typecheck      # TypeScript type check (no emit)
npm run lint           # ESLint
npm run verify:fixture # Static presence check of all capability markers
```
