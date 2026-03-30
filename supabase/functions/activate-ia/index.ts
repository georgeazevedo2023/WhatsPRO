import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { STATUS_IA } from '../_shared/constants.ts'
import { createServiceClient, createUserClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'
import { unauthorizedResponse } from '../_shared/auth.ts'

const log = createLogger('activate-ia')

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication using user-scoped client
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return unauthorizedResponse(corsHeaders)
    }

    const userClient = createUserClient(req)
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !userData?.user) {
      return unauthorizedResponse(corsHeaders)
    }

    const userId = userData.user.id;
    const { chatid, phone, instanceId } = await req.json();

    if (!chatid || !phone) {
      return errorResponse(corsHeaders, 'chatid and phone are required', 400)
    }

    // Verify user has access to the instance (if provided)
    if (instanceId) {
      const serviceClient = createServiceClient()

      const { data: roles } = await serviceClient
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'super_admin')
        .maybeSingle();

      if (!roles) {
        // Not super_admin, check explicit instance access
        const { data: access } = await serviceClient
          .from('user_instance_access')
          .select('id')
          .eq('user_id', userId)
          .eq('instance_id', instanceId)
          .maybeSingle();

        if (!access) {
          return errorResponse(corsHeaders, 'Access denied to this instance', 403)
        }
      }
    }

    const webhookResponse = await fetchWithTimeout(
      "https://fluxwebhook.wsmart.com.br/webhook/receb_out_neo",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status_ia: STATUS_IA.LIGADA,
          chatid,
          phone,
          instanceId,
        }),
      }
    );

    const responseText = await webhookResponse.text();
    log.info('activate-ia response', { status: webhookResponse.status, body: responseText.substring(0, 200) })

    return successResponse(corsHeaders, { success: true, status: webhookResponse.status })
  } catch (err) {
    log.error('activate-ia error', { error: (err as Error).message })
    return errorResponse(corsHeaders, (err as Error).message || 'Internal error', 500)
  }
});
