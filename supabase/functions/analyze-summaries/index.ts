import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { checkRateLimit, rateLimitHeaders } from '../_shared/rateLimit.ts'
import { createServiceClient, createUserClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'

const serviceSupabase = createServiceClient()
const log = createLogger('analyze-summaries')

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(corsHeaders, "Unauthorized", 401);
    }

    const userSupabase = createUserClient(req)
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await userSupabase.auth.getUser(token);
    if (userError || !user) {
      return errorResponse(corsHeaders, "Unauthorized", 401);
    }

    const userId = user.id;

    // Rate limit: max 5 analyses per user per minute
    const rl = await checkRateLimit(userId, 'analyze-summaries', 5, 60);
    if (rl.limited) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, ...rateLimitHeaders(rl), "Content-Type": "application/json" },
      });
    }

    // Check if super admin
    const { data: roleData } = await serviceSupabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .single();

    if (!roleData) {
      return errorResponse(corsHeaders, "Forbidden: super admin only", 403);
    }

    const body = await req.json();
    const { inbox_id, period_days = 30 } = body;

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

    // Calculate date range
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - period_days);

    // Count total available conversations with ai_summary in period
    let countQuery = serviceSupabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .not("ai_summary", "is", null)
      .gte("created_at", sinceDate.toISOString());

    if (inbox_id) {
      countQuery = countQuery.eq("inbox_id", inbox_id);
    }

    const { count: totalAvailable } = await countQuery;

    // Fetch conversations with ai_summary within the period (max 200)
    let query = serviceSupabase
      .from("conversations")
      .select("id, ai_summary, status, created_at, inbox_id, contact_id")
      .not("ai_summary", "is", null)
      .gte("created_at", sinceDate.toISOString())
      .limit(200);

    if (inbox_id) {
      query = query.eq("inbox_id", inbox_id);
    }

    const { data: conversations, error: convError } = await query;

    if (convError) {
      log.error("Error fetching conversations", { error: convError.message });
      return errorResponse(corsHeaders, "Failed to fetch conversations");
    }

    const totalConversations = conversations?.length || 0;

    if (totalConversations === 0) {
      return successResponse(corsHeaders, {
        total_analyzed: 0,
        total_available: totalAvailable || 0,
        top_reasons: [],
        top_products: [],
        top_objections: [],
        sentiment: { positive: 0, neutral: 0, negative: 0 },
        key_insights: "",
        conversations_detail: [],
      });
    }

    // Fetch contact data for all conversations
    const contactIds = [...new Set(conversations!.map(c => c.contact_id))];
    const { data: contacts } = await serviceSupabase
      .from("contacts")
      .select("id, name, phone")
      .in("id", contactIds);

    const contactMap = new Map<string, { name: string | null; phone: string }>();
    (contacts || []).forEach(c => contactMap.set(c.id, { name: c.name, phone: c.phone }));

    // Build text from all summaries (truncate each to 500 chars)
    const summariesText = conversations!
      .map((conv, idx) => {
        const s = conv.ai_summary as Record<string, string>;
        const reason = (s.reason || "N/A").substring(0, 500);
        const summary = (s.summary || "N/A").substring(0, 500);
        const resolution = (s.resolution || "N/A").substring(0, 500);
        return `--- Conversa ${idx + 1} (${conv.status}) ---\nMotivo: ${reason}\nResumo: ${summary}\nResolução: ${resolution}`;
      })
      .join("\n\n");

    log.info("Analyzing conversations with AI", { count: totalConversations });

    const systemPrompt = `Você é um analista de negócios especializado em atendimento ao cliente via WhatsApp.
Analise os resumos de ${totalConversations} conversas e retorne APENAS um JSON válido, sem markdown, sem blocos de código, sem texto extra.

O JSON deve ter EXATAMENTE estas chaves:
- "top_reasons": array de até 5 objetos {reason: string, count: number, conversation_indices: number[]} com os motivos de contato mais frequentes, ordenado por count decrescente. conversation_indices são os números das conversas (1-indexed) que se encaixam neste motivo.
- "top_products": array de até 5 objetos {product: string, count: number, conversation_indices: number[]} com produtos/serviços mais mencionados, ordenado por count decrescente. conversation_indices são os números das conversas que mencionam este produto.
- "top_objections": array de até 5 objetos {objection: string, count: number, conversation_indices: number[]} com as principais objeções/dificuldades dos clientes, ordenado por count decrescente. conversation_indices são os números das conversas com esta objeção.
- "sentiment": objeto com {positive: number, neutral: number, negative: number, positive_indices: number[], neutral_indices: number[], negative_indices: number[]} onde cada valor numérico é uma PORCENTAGEM inteira que some 100. Os arrays *_indices contêm os números das conversas classificadas naquele sentimento.
- "key_insights": string com 2-3 frases dos insights mais estratégicos para o negócio
- "total_analyzed": número inteiro de conversas analisadas

Regras:
- Se não houver produtos mencionados, retorne top_products como array vazio []
- Se não houver objeções claras, retorne top_objections como array vazio []
- Sempre retorne top_reasons com pelo menos 1 item se houver dados
- sentiment deve sempre somar 100
- Seja específico nos motivos, não genérico
- conversation_indices devem ser números de 1 a ${totalConversations} referentes à posição da conversa na lista`;

    // Retry helper with backoff and fallback
    async function callAIWithRetry(): Promise<Response> {
      const models = ["llama-3.3-70b-versatile"];
      const fallback = "llama-3.1-8b-instant";
      const payload = {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Resumos das conversas:\n\n${summariesText}` },
        ],
      };

      for (let attempt = 1; attempt <= 3; attempt++) {
        log.info("AI attempt", { attempt, model: models[0] });
        const resp = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: models[0], ...payload }),
        });

        if (resp.ok) return resp;
        if (resp.status === 429 || resp.status === 402) return resp;

        const errBody = await resp.text();
        log.error("AI attempt failed", { attempt, status: resp.status, body: errBody });

        if (attempt < 3) {
          const delayMs = attempt * 2000;
          log.info("Waiting before retry", { delay_ms: delayMs });
          await new Promise(r => setTimeout(r, delayMs));
        }
      }

      log.info("Trying fallback model", { model: fallback });
      return await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: fallback, ...payload }),
      });
    }

    const aiResponse = await callAIWithRetry();

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return errorResponse(corsHeaders, "Rate limit excedido. Tente novamente em alguns minutos.", 429);
      }
      if (aiResponse.status === 402) {
        return errorResponse(corsHeaders, "Créditos de IA insuficientes. Adicione créditos ao workspace.", 402);
      }
      const errBody = await aiResponse.text();
      log.error("All attempts failed", { status: aiResponse.status, body: errBody });
      return errorResponse(corsHeaders, "Erro ao processar análise de IA após múltiplas tentativas");
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    let analysis: Record<string, unknown>;
    try {
      const cleaned = rawContent
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      analysis = JSON.parse(cleaned);
    } catch {
      log.error("Failed to parse AI response", { raw: rawContent });
      return errorResponse(corsHeaders, "Falha ao processar resposta da IA");
    }

    // Ensure total_analyzed and total_available are accurate
    analysis.total_analyzed = totalConversations;
    analysis.total_available = totalAvailable || totalConversations;

    // Helper to map indices to conversation IDs
    function indicesToIds(indices: number[]): string[] {
      if (!Array.isArray(indices)) return [];
      return indices
        .filter(i => i >= 1 && i <= totalConversations)
        .map(i => conversations![i - 1].id);
    }

    // Enrich top_reasons with conversation_ids
    if (Array.isArray(analysis.top_reasons)) {
      analysis.top_reasons = (analysis.top_reasons as Array<Record<string, unknown>>).map((r) => ({
        ...r,
        conversation_ids: indicesToIds((r.conversation_indices as number[]) || []),
      }));
    }

    // Enrich top_products with conversation_ids
    if (Array.isArray(analysis.top_products)) {
      analysis.top_products = (analysis.top_products as Array<Record<string, unknown>>).map((p) => ({
        ...p,
        conversation_ids: indicesToIds((p.conversation_indices as number[]) || []),
      }));
    }

    // Enrich top_objections with conversation_ids
    if (Array.isArray(analysis.top_objections)) {
      analysis.top_objections = (analysis.top_objections as Array<Record<string, unknown>>).map((o) => ({
        ...o,
        conversation_ids: indicesToIds((o.conversation_indices as number[]) || []),
      }));
    }

    // Enrich sentiment with conversation_ids
    if (analysis.sentiment) {
      const sentiment = analysis.sentiment as Record<string, unknown>;
      sentiment.positive_ids = indicesToIds((sentiment.positive_indices as number[]) || []);
      sentiment.neutral_ids = indicesToIds((sentiment.neutral_indices as number[]) || []);
      sentiment.negative_ids = indicesToIds((sentiment.negative_indices as number[]) || []);
    }

    // Build conversations_detail array
    const conversationsDetail = conversations!.map(conv => {
      const contact = contactMap.get(conv.contact_id);
      const s = conv.ai_summary as Record<string, string>;
      return {
        id: conv.id,
        contact_name: contact?.name || null,
        contact_phone: contact?.phone || null,
        created_at: conv.created_at,
        summary: s?.summary || s?.reason || "Sem resumo disponível",
      };
    });

    analysis.conversations_detail = conversationsDetail;

    log.info("Analysis complete", { count: totalConversations });

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    log.error("Unexpected error", { error: err instanceof Error ? err.message : "Unknown error" });
    return errorResponse(corsHeaders, err instanceof Error ? err.message : "Unknown error");
  }
});
