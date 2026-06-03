import { getDynamicCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'
import { verifySuperAdmin } from '../_shared/auth.ts'

const log = createLogger('admin-create-user')

// Visibilidade padrão do vínculo de CAIXA por papel — espelha
// ROLE_DEFAULT_VISIBILITY do UsersTab.tsx. Na criação o vínculo de caixa nasce
// sempre como 'agente' (restrito a "Minhas"); o papel Gerente/Admin vive em
// user_roles, NÃO no inbox_users. Admin amplia depois pelos toggles da UI.
const AGENTE_INBOX_DEFAULTS = {
  role: 'agente',
  can_view_unassigned: false,
  can_view_all_in_dept: false,
  can_view_all: false,
} as const

Deno.serve(async (req) => {
  const corsHeaders = getDynamicCorsHeaders(req)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify caller is super_admin (M9 — DRY using shared helper).
    const auth = await verifySuperAdmin(req)
    if (!auth) return errorResponse(corsHeaders, 'Forbidden: Super admin required', 403)
    const callerId = auth.userId

    // Parse request body
    const body = await req.json()
    const { email, password, full_name, role } = body
    const validRoles = ['super_admin', 'gerente', 'user']
    const userRole = validRoles.includes(role) ? role : 'user'

    // Vínculos (opcionais) — criar membro JÁ vinculado, server-side e atômico.
    // Antes esses 3 inserts eram feitos pelo FRONTEND após a criação; numa
    // oscilação de rede o Promise.all pendurava "Criando..." pra sempre E
    // deixava o usuário órfão (auth criado, sem vínculos). Movendo pra cá tudo
    // acontece numa única requisição: ou volta resposta, ou (no pior caso) o
    // cliente expira mas o servidor já completou — um refresh mostra o membro
    // inteiro, sem órfão.
    const instanceId: string | null = typeof body.instance_id === 'string' && body.instance_id ? body.instance_id : null
    const inboxId: string | null = typeof body.inbox_id === 'string' && body.inbox_id ? body.inbox_id : null
    const departmentIds: string[] = Array.isArray(body.department_ids)
      ? body.department_ids.filter((d: unknown): d is string => typeof d === 'string' && d.length > 0)
      : []

    if (!email || !password) {
      return errorResponse(corsHeaders, 'Email and password are required', 400)
    }

    const adminClient = createServiceClient()

    // ── 1. Cria o usuário (ou recupera, se o e-mail já existir) ────────────────
    let userId: string | undefined
    let existed = false

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (createError) {
      const msg = (createError.message || '').toLowerCase()
      const isDuplicate = msg.includes('already') || msg.includes('exist') || msg.includes('registered')
      if (!isDuplicate) {
        return errorResponse(corsHeaders, createError.message, 400)
      }
      // E-mail já cadastrado → recupera o usuário e completa os vínculos que
      // faltam (cura de cadastro interrompido no meio). NÃO altera senha nem
      // papel: a conta já existe e a troca de papel é feita por outra tela.
      const { data: foundId, error: findError } = await adminClient
        .rpc('admin_find_auth_user_by_email', { p_email: email })
      if (findError || !foundId) {
        log.error('Duplicate email but lookup failed', { email, error: findError?.message })
        return errorResponse(corsHeaders, 'Já existe um usuário com este e-mail.', 409)
      }
      userId = foundId as string
      existed = true
    } else {
      userId = newUser.user?.id
    }

    if (!userId) {
      return errorResponse(corsHeaders, 'User creation returned no id', 500)
    }

    // ── 2. Papel (somente para usuário NOVO) ──────────────────────────────────
    // Substitui o 'user' default que o trigger insere. R88: Supabase JS NÃO
    // lança em violação de RLS/CHECK — checar {error} explicitamente.
    if (!existed) {
      const { error: delRoleError } = await adminClient
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
      if (delRoleError) {
        log.warn('Failed to remove default role', { user_id: userId, error: delRoleError.message })
      }

      const { error: insRoleError } = await adminClient
        .from('user_roles')
        .insert({ user_id: userId, role: userRole })
      if (insRoleError) {
        // Papel falhou — auth user existe mas sem papel. Rollback p/ não orfanar.
        log.error('Role insert failed — rolling back auth user', {
          user_id: userId, email, requested_role: userRole, error: insRoleError.message,
        })
        await adminClient.auth.admin.deleteUser(userId).catch((rollbackErr) => {
          log.error('Rollback failed — orphan auth user', { user_id: userId, error: String(rollbackErr) })
        })
        return errorResponse(corsHeaders, 'Failed to assign role', 500)
      }
    }

    // ── 3. Vínculos (instância / caixa / departamentos), idempotentes ─────────
    // "insere se ainda não existe" → seguro em retry e na cura de meio-criados.
    // Não há UNIQUE nessas tabelas, então check-then-insert (não upsert).
    const linkErrors: string[] = []

    if (instanceId) {
      const { data: ex, error: selErr } = await adminClient
        .from('user_instance_access').select('id')
        .eq('user_id', userId).eq('instance_id', instanceId).limit(1)
      if (selErr) linkErrors.push(`user_instance_access(sel): ${selErr.message}`)
      else if (!ex || ex.length === 0) {
        const { error } = await adminClient.from('user_instance_access')
          .insert({ user_id: userId, instance_id: instanceId })
        if (error) linkErrors.push(`user_instance_access: ${error.message}`)
      }
    }

    if (inboxId) {
      const { data: ex, error: selErr } = await adminClient
        .from('inbox_users').select('id')
        .eq('user_id', userId).eq('inbox_id', inboxId).limit(1)
      if (selErr) linkErrors.push(`inbox_users(sel): ${selErr.message}`)
      else if (!ex || ex.length === 0) {
        const { error } = await adminClient.from('inbox_users')
          .insert({ user_id: userId, inbox_id: inboxId, ...AGENTE_INBOX_DEFAULTS })
        if (error) linkErrors.push(`inbox_users: ${error.message}`)
      }
    }

    for (const deptId of departmentIds) {
      const { data: ex, error: selErr } = await adminClient
        .from('department_members').select('id')
        .eq('user_id', userId).eq('department_id', deptId).limit(1)
      if (selErr) linkErrors.push(`department_members(sel): ${selErr.message}`)
      else if (!ex || ex.length === 0) {
        const { error } = await adminClient.from('department_members')
          .insert({ user_id: userId, department_id: deptId })
        if (error) linkErrors.push(`department_members: ${error.message}`)
      }
    }

    if (linkErrors.length > 0) {
      log.warn('Some membership links failed (member still valid)', { user_id: userId, errors: linkErrors })
    }

    // ── 4. Audit log (fire-and-forget via waitUntil; não bloqueia a resposta) ─
    if (!existed) {
      const auditPromise = adminClient.rpc('log_admin_action', {
        p_user_id: callerId,
        p_action: 'create_user',
        p_target_table: 'auth.users',
        p_target_id: userId,
        p_details: { email, role: userRole, full_name: full_name || null },
      }).then(() => {}, () => { /* audit log is non-blocking */ })
      if (typeof (globalThis as any).EdgeRuntime?.waitUntil === 'function') {
        ;(globalThis as any).EdgeRuntime.waitUntil(auditPromise)
      }
    }

    log.info(existed ? 'User existed — memberships completed' : 'User created', {
      email, role: userRole, created_by: callerId, links_failed: linkErrors.length,
    })

    return successResponse(corsHeaders, {
      success: true,
      existed,
      link_errors: linkErrors,
      user: {
        id: userId,
        email: newUser?.user?.email ?? email,
      },
    })

  } catch (error: unknown) {
    // Don't leak internal error messages to the client (defense in depth).
    const errorMessage = error instanceof Error ? error.message : 'unknown'
    log.error('Unhandled error', { error: errorMessage })
    return errorResponse(corsHeaders, 'Internal server error', 500)
  }
})
