import { getDynamicCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient, createUserClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'
import { unauthorizedResponse } from '../_shared/auth.ts'

const log = createLogger('admin-delete-user')

Deno.serve(async (req) => {
  const corsHeaders = getDynamicCorsHeaders(req)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return unauthorizedResponse(corsHeaders)
    }

    // Create user-scoped client to verify super_admin
    const userClient = createUserClient(req)

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await userClient.auth.getUser(token)

    if (userError || !userData?.user) {
      return unauthorizedResponse(corsHeaders)
    }

    // Check if user is super admin
    const { data: roleData, error: roleError } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'super_admin')
      .maybeSingle()

    if (roleError || !roleData) {
      return errorResponse(corsHeaders, 'Forbidden: Super admin required', 403)
    }

    // Parse request body
    const body = await req.json()
    const { user_id } = body

    if (!user_id) {
      return errorResponse(corsHeaders, 'User ID is required', 400)
    }

    // Prevent self-deletion
    if (user_id === userData.user.id) {
      return errorResponse(corsHeaders, 'Cannot delete your own account', 400)
    }

    // Create admin client with service role
    const adminClient = createServiceClient()

    // Cascade delete from public tables before auth.users.
    // R88: Supabase JS does NOT throw on RLS/CHECK errors — must check {error} explicitly.
    // Each step logs a structured warning on failure but continues — auth.deleteUser is the
    // final source of truth; partial cascade leaves orphan rows that can be reconciled later.
    const cascade = [
      { table: 'user_instance_access', col: 'user_id' as const },
      { table: 'inbox_users',          col: 'user_id' as const },
      { table: 'department_members',   col: 'user_id' as const },
      { table: 'user_roles',           col: 'user_id' as const },
      { table: 'user_profiles',        col: 'id' as const },
    ]

    for (const { table, col } of cascade) {
      // deno-lint-ignore no-explicit-any
      const { error: stepError } = await (adminClient as any).from(table).delete().eq(col, user_id)
      if (stepError) {
        log.warn('Cascade delete failed', { table, user_id, error: stepError.message })
      }
    }

    // Delete auth user (this is the source of truth — if it succeeds, the user is gone)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id)

    if (deleteError) {
      return errorResponse(corsHeaders, deleteError.message, 400)
    }

    // Audit log (non-blocking)
    try {
      await adminClient.rpc('log_admin_action', {
        p_user_id: userData.user.id,
        p_action: 'delete_user',
        p_target_table: 'auth.users',
        p_target_id: user_id,
        p_details: {},
      })
    } catch { /* audit log is non-blocking */ }

    log.info('User deleted', { user_id, deleted_by: userData.user.id })

    return successResponse(corsHeaders, { success: true })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'unknown'
    log.error('Unhandled error', { error: errorMessage })
    return errorResponse(corsHeaders, 'Internal server error', 500)
  }
})
