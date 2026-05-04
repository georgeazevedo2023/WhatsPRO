import { getDynamicCorsHeaders } from '../_shared/cors.ts'
import { createServiceClient, createUserClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'
import { unauthorizedResponse } from '../_shared/auth.ts'

const log = createLogger('admin-create-user')

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
    const { email, password, full_name, role } = body
    const validRoles = ['super_admin', 'gerente', 'user']
    const userRole = validRoles.includes(role) ? role : 'user'

    if (!email || !password) {
      return errorResponse(corsHeaders, 'Email and password are required', 400)
    }

    const adminClient = createServiceClient()

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (createError) {
      return errorResponse(corsHeaders, createError.message, 400)
    }

    // Insert the assigned role (replaces the default 'user' inserted by the trigger).
    // R88: Supabase JS does NOT throw on RLS/CHECK violations — must check {error} explicitly.
    if (newUser.user) {
      const { error: delRoleError } = await adminClient
        .from('user_roles')
        .delete()
        .eq('user_id', newUser.user.id)

      if (delRoleError) {
        // Default role removal failed; log but don't rollback (trigger may not have inserted yet).
        log.warn('Failed to remove default role', { user_id: newUser.user.id, error: delRoleError.message })
      }

      const { error: insRoleError } = await adminClient
        .from('user_roles')
        .insert({ user_id: newUser.user.id, role: userRole })

      if (insRoleError) {
        // Role assignment failed — auth user exists but has no role. Rollback to avoid orphan.
        log.error('Role insert failed — rolling back auth user', {
          user_id: newUser.user.id,
          email,
          requested_role: userRole,
          error: insRoleError.message,
        })
        await adminClient.auth.admin.deleteUser(newUser.user.id).catch((rollbackErr) => {
          log.error('Rollback failed — orphan auth user', { user_id: newUser.user.id, error: String(rollbackErr) })
        })
        return errorResponse(corsHeaders, 'Failed to assign role', 500)
      }
    }

    // Audit log: record admin action (non-blocking)
    if (newUser.user) {
      try {
        await adminClient.rpc('log_admin_action', {
          p_user_id: userData.user.id,
          p_action: 'create_user',
          p_target_table: 'auth.users',
          p_target_id: newUser.user.id,
          p_details: { email, role: userRole, full_name: full_name || null },
        })
      } catch { /* audit log is non-blocking */ }
    }

    log.info('User created', { email, role: userRole, created_by: userData.user.id })

    return successResponse(corsHeaders, {
      success: true,
      user: {
        id: newUser.user?.id,
        email: newUser.user?.email
      }
    })

  } catch (error: unknown) {
    // Don't leak internal error messages to the client (defense in depth).
    const errorMessage = error instanceof Error ? error.message : 'unknown'
    log.error('Unhandled error', { error: errorMessage })
    return errorResponse(corsHeaders, 'Internal server error', 500)
  }
})
