import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { createServiceClient, createUserClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'
import { unauthorizedResponse } from '../_shared/auth.ts'

const log = createLogger('admin-update-user')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return unauthorizedResponse(corsHeaders)
    }

    const userClient = createUserClient(req)

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await userClient.auth.getUser(token)

    if (userError || !userData?.user) {
      return unauthorizedResponse(corsHeaders)
    }

    const { data: roleData, error: roleError } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'super_admin')
      .maybeSingle()

    if (roleError || !roleData) {
      return errorResponse(corsHeaders, 'Forbidden: Super admin required', 403)
    }

    const body = await req.json()
    const { user_id, email, password, full_name } = body

    if (!user_id) {
      return errorResponse(corsHeaders, 'user_id is required', 400)
    }

    if (!email?.trim()) {
      return errorResponse(corsHeaders, 'Email is required', 400)
    }

    if (password && password.length < 6) {
      return errorResponse(corsHeaders, 'Password must be at least 6 characters', 400)
    }

    const adminClient = createServiceClient()

    // Update auth user (email and/or password)
    const authUpdate: Record<string, string> = { email: email.trim() }
    if (password) {
      authUpdate.password = password
    }

    const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(user_id, authUpdate)
    if (updateAuthError) {
      return errorResponse(corsHeaders, updateAuthError.message, 400)
    }

    // Update user_profiles
    const profileUpdate: Record<string, string> = { email: email.trim() }
    if (full_name !== undefined) {
      profileUpdate.full_name = full_name
    }

    const { error: profileError } = await adminClient
      .from('user_profiles')
      .update(profileUpdate)
      .eq('id', user_id)

    if (profileError) {
      log.warn('Profile update error', { error: profileError.message, user_id })
    }

    // Audit log (non-blocking)
    try {
      await adminClient.rpc('log_admin_action', {
        p_user_id: userData.user.id,
        p_action: 'update_user',
        p_target_table: 'auth.users',
        p_target_id: user_id,
        p_details: { email, full_name, password_changed: !!password },
      })
    } catch { /* audit log is non-blocking */ }

    log.info('User updated', { user_id, email, updated_by: userData.user.id })

    return successResponse(corsHeaders, { success: true })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    log.error('Error', { error: errorMessage })
    return errorResponse(corsHeaders, errorMessage, 500)
  }
})
