import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { STATUS_IA } from '../_shared/constants.ts'

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;
    const { chatid, phone, instanceId } = await req.json();

    if (!chatid || !phone) {
      return new Response(
        JSON.stringify({ error: "chatid and phone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has access to the instance (if provided)
    if (instanceId) {
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

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
          return new Response(
            JSON.stringify({ error: 'Access denied to this instance' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
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
    console.log("activate-ia response:", webhookResponse.status, responseText.substring(0, 200));

    return new Response(
      JSON.stringify({ success: true, status: webhookResponse.status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("activate-ia error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
