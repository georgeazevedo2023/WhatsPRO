import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { verifyCronOrService } from '../_shared/auth.ts'
import { createServiceClient, createUserClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'

const serviceSupabase = createServiceClient()
const log = createLogger('send-shift-report')

const UAZAPI_URL = Deno.env.get("UAZAPI_SERVER_URL") || "https://wsmart.uazapi.com";

async function formatReportWithAI(
  inboxName: string,
  date: string,
  totalConvs: number,
  resolvedConvs: number,
  openConvs: number,
  topReasons: { reason: string; count: number }[],
  topAgent: { name: string; count: number } | null
): Promise<string> {
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

  const reasonsList = topReasons
    .slice(0, 5)
    .map((r, i) => `${i + 1}. ${r.reason} (${r.count})`)
    .join("\n");

  const systemPrompt = `Você é um assistente que formata relatórios de atendimento para WhatsApp de forma profissional e clara.
Use emojis com moderação, negrito com asteriscos (*texto*), itálico com underscores (_texto_).
Seja conciso e direto. Máximo de 20 linhas. Responda APENAS com o texto do relatório, sem explicações.`;

  const userPrompt = `Gere um relatório de turno de WhatsApp com estes dados:
- Caixa de atendimento: ${inboxName}
- Data: ${date}
- Total de conversas: ${totalConvs}
- Conversas resolvidas: ${resolvedConvs}
- Conversas em aberto: ${openConvs}
- Taxa de resolução: ${totalConvs > 0 ? Math.round((resolvedConvs / totalConvs) * 100) : 0}%
${topAgent ? `- Atendente destaque: ${topAgent.name} (${topAgent.count} conversa${topAgent.count !== 1 ? "s" : ""})` : ""}
${topReasons.length > 0 ? `- Principais assuntos:\n${reasonsList}` : ""}

Inclua um cabeçalho com data e nome da caixa, os KPIs principais${topAgent ? `, o atendente destaque com ícone 🏆` : ""}, os assuntos se disponíveis, e um rodapé indicando que foi gerado automaticamente pelo WsmartQR.`;

  try {
    const aiResponse = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
      }),
    });

    if (!aiResponse.ok) {
      log.error("AI error", { status: aiResponse.status });
      // Fallback to template
      return buildFallbackReport(inboxName, date, totalConvs, resolvedConvs, openConvs, topReasons, topAgent);
    }

    const aiData = await aiResponse.json();
    return aiData.choices?.[0]?.message?.content || buildFallbackReport(inboxName, date, totalConvs, resolvedConvs, openConvs, topReasons, topAgent);
  } catch (e) {
    log.error("AI call failed", { error: e instanceof Error ? e.message : String(e) });
    return buildFallbackReport(inboxName, date, totalConvs, resolvedConvs, openConvs, topReasons, topAgent);
  }
}

function buildFallbackReport(
  inboxName: string,
  date: string,
  totalConvs: number,
  resolvedConvs: number,
  openConvs: number,
  topReasons: { reason: string; count: number }[],
  topAgent: { name: string; count: number } | null
): string {
  const resolutionRate = totalConvs > 0 ? Math.round((resolvedConvs / totalConvs) * 100) : 0;
  const reasonsList = topReasons
    .slice(0, 5)
    .map((r, i) => `${i + 1}. ${r.reason} (${r.count})`)
    .join("\n");

  return `📊 *Relatório de Turno — ${date}*

🏷️ *Caixa:* ${inboxName}

📞 *Atendimentos do dia:* ${totalConvs} conversa${totalConvs !== 1 ? "s" : ""}
✅ Resolvidas: ${resolvedConvs} (${resolutionRate}%)
🔄 Em aberto: ${openConvs}
${topAgent ? `\n🏆 *Atendente destaque:* ${topAgent.name} (${topAgent.count} conversa${topAgent.count !== 1 ? "s" : ""})` : ""}
${topReasons.length > 0 ? `\n🔝 *Principais assuntos:*\n${reasonsList}` : ""}

⏱️ _Relatório gerado automaticamente pelo WsmartQR_`;
}

async function sendWhatsAppMessage(instanceToken: string, recipientJid: string, message: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${UAZAPI_URL}/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: instanceToken,
      },
      body: JSON.stringify({
        number: recipientJid,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error("UAZAPI send error", { status: response.status, body: errorText });
      return false;
    }

    log.info("Message sent successfully", { recipientJid });
    return true;
  } catch (e) {
    log.error("Failed to send WhatsApp message", { error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

function normalizePhoneToJid(phone: string): string {
  // Remove all non-numeric characters
  const digits = phone.replace(/\D/g, "");
  // If it already has @, return as is
  if (phone.includes("@")) return phone;
  // Add @s.whatsapp.net for individual contacts
  return `${digits}@s.whatsapp.net`;
}

async function processShiftReport(config: Record<string, unknown>, testMode = false): Promise<{ success: boolean; report?: string; error?: string }> {
  log.info("Processing shift report config", { configId: config.id, inboxId: config.inbox_id });

  // Get inbox name
  const { data: inbox } = await serviceSupabase
    .from("inboxes")
    .select("name")
    .eq("id", config.inbox_id)
    .single();

  const inboxName = inbox?.name || "Atendimento";

  // Get instance token
  const { data: instance } = await serviceSupabase
    .from("instances")
    .select("token, status")
    .eq("id", config.instance_id)
    .single();

  if (!instance?.token) {
    return { success: false, error: "Instance token not found" };
  }

  if (instance.status !== "connected") {
    return { success: false, error: `Instance is not connected (status: ${instance.status})` };
  }

  // Calculate today's date range in São Paulo timezone (handles DST automatically)
  const now = new Date();
  const spDateStr = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD
  // Compute UTC offset for São Paulo dynamically (handles DST)
  const spNowStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  const spNow = new Date(spNowStr);
  const offsetMs = now.getTime() - spNow.getTime();
  const todayStart = new Date(`${spDateStr}T00:00:00.000Z`);
  todayStart.setTime(todayStart.getTime() + offsetMs);
  const todayEnd = new Date(`${spDateStr}T23:59:59.999Z`);
  todayEnd.setTime(todayEnd.getTime() + offsetMs);

  // Get today's conversations for this inbox
  const { data: todayConvs, error: convError } = await serviceSupabase
    .from("conversations")
    .select("id, status, ai_summary, assigned_to")
    .eq("inbox_id", config.inbox_id)
    .gte("created_at", todayStart.toISOString())
    .lte("created_at", todayEnd.toISOString());

  if (convError) {
    log.error("Error fetching conversations", { error: convError.message });
    return { success: false, error: "Failed to fetch conversations" };
  }

  const conversations = todayConvs || [];
  const totalConvs = conversations.length;
  const resolvedConvs = conversations.filter((c) => c.status === "resolvida").length;
  const openConvs = conversations.filter((c) => c.status !== "resolvida").length;

  // Extract top reasons from ai_summaries
  const reasonMap: Record<string, number> = {};
  for (const conv of conversations) {
    if (conv.ai_summary) {
      const summary = conv.ai_summary as Record<string, string>;
      if (summary.reason) {
        const reason = summary.reason.trim();
        reasonMap[reason] = (reasonMap[reason] || 0) + 1;
      }
    }
  }

  const topReasons = Object.entries(reasonMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Find top agent (most assigned conversations)
  const agentMap: Record<string, number> = {};
  for (const conv of conversations) {
    if (conv.assigned_to) {
      agentMap[conv.assigned_to] = (agentMap[conv.assigned_to] || 0) + 1;
    }
  }

  let topAgent: { name: string; count: number } | null = null;
  const topAgentEntry = Object.entries(agentMap).sort((a, b) => b[1] - a[1])[0];
  if (topAgentEntry) {
    const [topAgentId, topAgentCount] = topAgentEntry;
    const { data: agentProfile } = await serviceSupabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", topAgentId)
      .single();
    topAgent = {
      name: agentProfile?.full_name || "—",
      count: topAgentCount,
    };
    log.info("Top agent", { name: topAgent.name, count: topAgent.count });
  }

  // Format date in Brazilian Portuguese
  const dateStr = now.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });

  // Generate report with AI
  const reportMessage = await formatReportWithAI(
    inboxName,
    dateStr,
    totalConvs,
    resolvedConvs,
    openConvs,
    topReasons,
    topAgent
  );

  if (testMode) {
    return { success: true, report: reportMessage };
  }

  // Send via WhatsApp
  const recipientJid = normalizePhoneToJid(config.recipient_number as string);
  const sent = await sendWhatsAppMessage(instance.token, recipientJid, reportMessage);

  // Log the report
  await serviceSupabase.from("shift_report_logs").insert({
    config_id: config.id,
    status: sent ? "sent" : "failed",
    conversations_total: totalConvs,
    conversations_resolved: resolvedConvs,
    error_message: sent ? null : "Failed to send WhatsApp message",
    report_content: reportMessage,
  });

  // Update last_sent_at
  if (sent) {
    await serviceSupabase
      .from("shift_report_configs")
      .update({ last_sent_at: now.toISOString() })
      .eq("id", config.id);
  }

  return { success: sent, report: reportMessage, error: sent ? undefined : "Failed to send WhatsApp message" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { config_id, test_mode } = body;

    // Cron path (no config_id) — requires cron/service auth
    if (!config_id && !verifyCronOrService(req)) {
      return errorResponse(corsHeaders, 'Unauthorized', 401);
    }

    // Manual trigger (from UI) — requires user auth
    if (config_id) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return errorResponse(corsHeaders, "Unauthorized", 401);
      }

      const userSupabase = createUserClient(req)
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await userSupabase.auth.getUser(token);
      if (userError || !userData?.user) {
        return errorResponse(corsHeaders, "Unauthorized", 401);
      }

      // Check super admin
      const userId = userData.user.id;
      const { data: roleData } = await serviceSupabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "super_admin")
        .single();

      if (!roleData) {
        return errorResponse(corsHeaders, "Forbidden", 403);
      }

      const { data: config } = await serviceSupabase
        .from("shift_report_configs")
        .select("*")
        .eq("id", config_id)
        .single();

      if (!config) {
        return errorResponse(corsHeaders, "Config not found", 404);
      }

      const result = await processShiftReport(config, test_mode === true);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cron mode — find configs where send_hour matches current hour (São Paulo time)
    const now = new Date();
    const spHour = parseInt(
      now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" })
    );

    log.info("Cron triggered", { spHour });

    const { data: configs, error: configError } = await serviceSupabase
      .from("shift_report_configs")
      .select("*")
      .eq("enabled", true)
      .eq("send_hour", spHour);

    if (configError) {
      log.error("Error fetching configs", { error: configError.message });
      return errorResponse(corsHeaders, "Failed to fetch configs");
    }

    if (!configs || configs.length === 0) {
      log.info("No configs to process at this hour", { spHour });
      return successResponse(corsHeaders, { processed: 0, hour: spHour });
    }

    log.info("Processing configs", { count: configs.length, spHour });

    let processed = 0;
    let failed = 0;

    for (const config of configs) {
      const result = await processShiftReport(config);
      if (result.success) {
        processed++;
      } else {
        failed++;
        log.error("Failed config", { configId: config.id, error: result.error });
      }
    }

    return successResponse(corsHeaders, { processed, failed, hour: spHour });
  } catch (err) {
    log.error("Unexpected error", { error: err instanceof Error ? err.message : "Unknown error" });
    return errorResponse(corsHeaders, err instanceof Error ? err.message : "Unknown error");
  }
});
