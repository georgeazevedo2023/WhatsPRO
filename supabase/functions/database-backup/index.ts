import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { createServiceClient, createUserClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'
import { unauthorizedResponse } from '../_shared/auth.ts'

const log = createLogger('database-backup')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return unauthorizedResponse(corsHeaders)
    }

    // Verify user is super_admin using user-scoped client
    const userClient = createUserClient(req)
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return unauthorizedResponse(corsHeaders)
    }

    const adminClient = createServiceClient()

    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .maybeSingle()

    if (!roleData) {
      return errorResponse(corsHeaders, 'Forbidden: Super Admin only', 403)
    }

    const { action, table_name } = await req.json()

    log.info('Backup action', { action, table_name, user_id: user.id })

    let result: any = null

    // Users-list uses admin API directly
    if (action === 'users-list') {
      const { data: { users: authUsers }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
      if (error) throw error
      result = (authUsers || []).map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed_at: u.email_confirmed_at,
        phone: u.phone,
        role: u.role,
        user_metadata: u.user_metadata,
      }))
    } else {
      // All other actions use the safe backup_query function
      const { data, error } = await adminClient.rpc('backup_query', {
        _action: action,
        _table_name: table_name || null,
      })
      if (error) throw error
      result = data
    }

    return successResponse(corsHeaders, { data: result })
  } catch (error: any) {
    log.error('Backup error', { error: error.message })
    return errorResponse(corsHeaders, error.message, 500)
  }
})
