import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { checkRateLimit, rateLimitHeaders } from '../_shared/rateLimit.ts'

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

const serviceSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userSupabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await userSupabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Forbidden: super admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { inbox_id, period_days = 30 } = body;

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
      console.error("[analyze-summaries] Error fetching conversations:", convError);
      return new Response(JSON.stringify({ error: "Failed to fetch conversations" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalConversations = conversations?.length || 0;

    if (totalConversations === 0) {
      return new Response(
        JSON.stringify({
          total_analyzed: 0,
          total_available: totalAvailable || 0,
          top_reasons: [],
          top_products: [],
          top_objections: [],
          sentiment: { positive: 0, neutral: 0, negative: 0 },
          key_insights: "",
          conversations_detail: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
        const s = conv.ai_summary as any;
        const reason = (s.reason || "N/A").substring(0, 500);
        const summary = (s.summary || "N/A").substring(0, 500);
        const resolution = (s.resolution || "N/A").substring(0, 500);
        return `--- Conversa ${idx + 1} (${conv.status}) ---\nMotivo: ${reason}\nResumo: ${summary}\nResolução: ${resolution}`;
      })
      .join("\n\n");

    console.log(`[analyze-summaries] Analyzing ${totalConversations} conversations with AI...`);

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
        console.log(`[analyze-summaries] Attempt ${attempt}/3 with llama-3.3-70b-versatile`);
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
        console.error(`[analyze-summaries] Attempt ${attempt} failed: ${resp.status} ${errBody}`);

        if (attempt < 3) {
          const delay = attempt * 2000;
          console.log(`[analyze-summaries] Waiting ${delay}ms before retry...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }

      console.log(`[analyze-summaries] Trying fallback model: ${fallback}`);
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
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errBody = await aiResponse.text();
      console.error("[analyze-summaries] All attempts failed:", aiResponse.status, errBody);
      return new Response(JSON.stringify({ error: "Erro ao processar análise de IA após múltiplas tentativas" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    let analysis: Record<string, any>;
    try {
      const cleaned = rawContent
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      analysis = JSON.parse(cleaned);
    } catch (e) {
      console.error("[analyze-summaries] Failed to parse AI response:", rawContent);
      return new Response(JSON.stringify({ error: "Falha ao processar resposta da IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      analysis.top_reasons = analysis.top_reasons.map((r: any) => ({
        ...r,
        conversation_ids: indicesToIds(r.conversation_indices || []),
      }));
    }

    // Enrich top_products with conversation_ids
    if (Array.isArray(analysis.top_products)) {
      analysis.top_products = analysis.top_products.map((p: any) => ({
        ...p,
        conversation_ids: indicesToIds(p.conversation_indices || []),
      }));
    }

    // Enrich top_objections with conversation_ids
    if (Array.isArray(analysis.top_objections)) {
      analysis.top_objections = analysis.top_objections.map((o: any) => ({
        ...o,
        conversation_ids: indicesToIds(o.conversation_indices || []),
      }));
    }

    // Enrich sentiment with conversation_ids
    if (analysis.sentiment) {
      analysis.sentiment.positive_ids = indicesToIds(analysis.sentiment.positive_indices || []);
      analysis.sentiment.neutral_ids = indicesToIds(analysis.sentiment.neutral_indices || []);
      analysis.sentiment.negative_ids = indicesToIds(analysis.sentiment.negative_indices || []);
    }

    // Build conversations_detail array
    const conversationsDetail = conversations!.map(conv => {
      const contact = contactMap.get(conv.contact_id);
      const s = conv.ai_summary as any;
      return {
        id: conv.id,
        contact_name: contact?.name || null,
        contact_phone: contact?.phone || null,
        created_at: conv.created_at,
        summary: s?.summary || s?.reason || "Sem resumo disponível",
      };
    });

    analysis.conversations_detail = conversationsDetail;

    console.log(`[analyze-summaries] Analysis complete for ${totalConversations} conversations`);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[analyze-summaries] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
