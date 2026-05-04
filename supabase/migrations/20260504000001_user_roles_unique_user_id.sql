-- 2026-05-04 — R90: confirmRoleChange in UsersTab.tsx uses
-- supabase.from('user_roles').upsert({...}, { onConflict: 'user_id' })
-- which returned 400 because user_roles had no UNIQUE constraint on user_id.
--
-- Step 1: dedupe by role hierarchy (super_admin > gerente > user) before
-- adding the UNIQUE constraint. Detected in prod (2026-05-04):
-- george.azevedo2023 had super_admin (2026-02) + user (2026-03 from
-- handle_new_user trigger duplicate).
WITH ranked AS (
  SELECT id, user_id, role,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY CASE role::text
        WHEN 'super_admin' THEN 1
        WHEN 'gerente' THEN 2
        WHEN 'user' THEN 3
        ELSE 4
      END,
      created_at ASC
    ) AS rn
  FROM public.user_roles
)
DELETE FROM public.user_roles
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: add UNIQUE constraint so upsert(onConflict: user_id) can resolve.
-- This also prevents the trigger handle_new_user from creating duplicate
-- rows when an admin already inserted a non-default role.
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

COMMENT ON CONSTRAINT user_roles_user_id_key ON public.user_roles IS
  'R90 (2026-05-04): one role per user. Required by confirmRoleChange upsert in UsersTab.tsx and admin-create-user role override.';
