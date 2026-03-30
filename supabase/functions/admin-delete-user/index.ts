import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { createServiceClient, createUserClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'
import { unauthorizedResponse } from '../_shared/auth.ts'

const log = createLogger('admin-delete-user')

Deno.serve(async (req) => {
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

    // Delete user instance access first
    await adminClient
      .from('user_instance_access')
      .delete()
      .eq('user_id', user_id)

    // Delete user roles
    await adminClient
      .from('user_roles')
      .delete()
      .eq('user_id', user_id)

    // Delete user profile
    await adminClient
      .from('user_profiles')
      .delete()
      .eq('id', user_id)

    // Delete auth user
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
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    log.error('Error', { error: errorMessage })
    return errorResponse(corsHeaders, errorMessage, 500)
  }
})
