import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { checkRateLimit, rateLimitHeaders } from '../_shared/rateLimit.ts'
import { createServiceClient, createUserClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'

const serviceSupabase = createServiceClient()
const log = createLogger('summarize-conversation')

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(corsHeaders, "Unauthorized", 401);
    }

    const supabase = createUserClient(req)

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return errorResponse(corsHeaders, "Unauthorized", 401);
    }

    const userId = authData.user.id;

    // Rate limit: max 10 summarizations per user per minute
    const rl = await checkRateLimit(userId, 'summarize-conversation', 10, 60);
    if (rl.limited) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, ...rateLimitHeaders(rl), "Content-Type": "application/json" },
      });
    }

    const { conversation_id, force_refresh } = await req.json();

    if (!conversation_id) {
      return errorResponse(corsHeaders, "conversation_id is required", 400);
    }

    // Fetch conversation to validate access
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id, inbox_id, ai_summary")
      .eq("id", conversation_id)
      .single();

    if (convError || !conversation) {
      return errorResponse(corsHeaders, "Conversation not found", 404);
    }

    // Verify access via has_inbox_access
    const { data: hasAccess } = await supabase.rpc("has_inbox_access", {
      _inbox_id: conversation.inbox_id,
      _user_id: userId,
    });

    // Also allow super admins
    const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", {
      _user_id: userId,
    });

    if (!hasAccess && !isSuperAdmin) {
      return errorResponse(corsHeaders, "Forbidden", 403);
    }

    // Return cached summary if exists and not forcing refresh
    if (conversation.ai_summary && !force_refresh) {
      return successResponse(corsHeaders, { summary: conversation.ai_summary });
    }

    // Fetch all messages
    const { data: messages, error: msgError } = await supabase
      .from("conversation_messages")
      .select("direction, content, media_type, created_at, transcription")
      .eq("conversation_id", conversation_id)
      .neq("direction", "private_note")
      .order("created_at", { ascending: true });

    if (msgError) {
      log.error("Error fetching messages", { error: msgError.message });
      return errorResponse(corsHeaders, "Failed to fetch messages");
    }

    if (!messages || messages.length === 0) {
      return errorResponse(corsHeaders, "No messages to summarize", 400);
    }

    // Format conversation history as text
    const conversationText = messages
      .map((msg) => {
        const role = msg.direction === "incoming" ? "[Cliente]" : "[Atendente]";
        let text = "";
        if (msg.content) {
          text = msg.content;
        } else if (msg.transcription) {
          text = `[Áudio transcrito]: ${msg.transcription}`;
        } else if (msg.media_type === "image") {
          text = "[Imagem]";
        } else if (msg.media_type === "video") {
          text = "[Vídeo]";
        } else if (msg.media_type === "audio") {
          text = "[Áudio]";
        } else if (msg.media_type === "document") {
          text = "[Documento]";
        } else if (msg.media_type === "contact") {
          text = "[Contato compartilhado]";
        } else {
          text = "[Mídia]";
        }
        return `${role}: ${text}`;
      })
      .join("\n");

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      return errorResponse(corsHeaders, "AI not configured");
    }

    const systemPrompt = `Você é um assistente de atendimento ao cliente. Analise esta conversa de WhatsApp e gere um resumo estruturado.

Responda APENAS com um JSON válido, sem markdown, sem blocos de código, sem texto extra. O JSON deve ter exatamente estas chaves:
- "reason": motivo principal do contato em 1 frase curta
- "summary": resumo da conversa em 2-3 frases
- "resolution": como foi resolvido ou qual o próximo passo (ou "Em aberto" se não resolvido)`;

    const userPrompt = `Conversa:\n${conversationText}`;

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
        temperature: 0.3,
      }),
    }, 30000);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      log.error("AI gateway error", { status: aiResponse.status, body: errorText });

      if (aiResponse.status === 429) {
        return errorResponse(corsHeaders, "Limite de IA atingido. Tente novamente em alguns instantes.", 429);
      }
      if (aiResponse.status === 402) {
        return errorResponse(corsHeaders, "Créditos de IA insuficientes.", 402);
      }

      return errorResponse(corsHeaders, "Falha ao gerar resumo");
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response (strip any accidental markdown fences)
    let parsedSummary: Record<string, string>;
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsedSummary = JSON.parse(cleaned);
    } catch {
      log.error("Failed to parse AI response", { raw: rawContent });
      return errorResponse(corsHeaders, "Resposta da IA inválida");
    }

    const summaryData = {
      ...parsedSummary,
      generated_at: new Date().toISOString(),
      message_count: messages.length,
    };

    // Persist to DB using service role for update
    // Save summary with 60-day expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    const { error: updateError } = await serviceSupabase
      .from("conversations")
      .update({
        ai_summary: summaryData,
        ai_summary_expires_at: expiresAt.toISOString(),
      })
      .eq("id", conversation_id);

    if (updateError) {
      log.error("Failed to save summary", { error: updateError.message });
      // Still return the summary even if save failed
    }

    return successResponse(corsHeaders, { summary: summaryData });
  } catch (err) {
    log.error("Unexpected error", { error: err instanceof Error ? err.message : "Unknown error" });
    return errorResponse(corsHeaders, err instanceof Error ? err.message : "Unknown error");
  }
});
