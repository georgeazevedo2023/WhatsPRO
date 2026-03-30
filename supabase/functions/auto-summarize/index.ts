import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { verifyAuth, verifyCronOrService, verifySuperAdmin, unauthorizedResponse } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/supabaseClient.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'

const serviceSupabase = createServiceClient()
const log = createLogger('auto-summarize')

async function summarizeConversation(conversationId: string): Promise<boolean> {
  // Fetch messages
  const { data: messages, error: msgError } = await serviceSupabase
    .from("conversation_messages")
    .select("direction, content, media_type, created_at, transcription")
    .eq("conversation_id", conversationId)
    .neq("direction", "private_note")
    .order("created_at", { ascending: true });

  if (msgError || !messages || messages.length < 3) {
    log.info('Skipping conversation: not enough messages', { conversationId, count: messages?.length ?? 0 });
    return false;
  }

  // Format conversation history
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

  const systemPrompt = `Você é um assistente de atendimento ao cliente. Analise esta conversa de WhatsApp e gere um resumo estruturado.

Responda APENAS com um JSON válido, sem markdown, sem blocos de código, sem texto extra. O JSON deve ter exatamente estas chaves:
- "reason": motivo principal do contato em 1 frase curta
- "summary": resumo da conversa em 2-3 frases
- "resolution": como foi resolvido ou qual o próximo passo (ou "Em aberto" se não resolvido)`;

  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

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
        { role: "user", content: `Conversa:\n${conversationText}` },
      ],
      temperature: 0.3,
    }),
  });

  if (!aiResponse.ok) {
    log.error('AI error for conversation', { conversationId, status: aiResponse.status });
    return false;
  }

  const aiData = await aiResponse.json();
  const rawContent = aiData.choices?.[0]?.message?.content || "";

  let parsedSummary: Record<string, string>;
  try {
    const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsedSummary = JSON.parse(cleaned);
  } catch {
    log.error('Failed to parse AI response', { conversationId, raw: rawContent });
    return false;
  }

  const summaryData = {
    ...parsedSummary,
    generated_at: new Date().toISOString(),
    message_count: messages.length,
  };

  // Save summary with 60-day expiry
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 60);

  const { error: updateError } = await serviceSupabase
    .from("conversations")
    .update({
      ai_summary: summaryData,
      ai_summary_expires_at: expiresAt.toISOString(),
    })
    .eq("id", conversationId);

  if (updateError) {
    log.error('Failed to save summary', { conversationId, error: updateError.message });
    return false;
  }

  log.info('Summary saved', { conversationId });
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { conversation_id, mode, limit } = body;

    // Mode: single conversation (triggered by status change trigger or manual call)
    if (conversation_id) {
      // Single conversation can be called by cron trigger (no auth) or authenticated user
      // The trigger calls with anon key, so we accept cron/service OR authenticated user
      if (!verifyCronOrService(req)) {
        const auth = await verifyAuth(req)
        if (!auth) return unauthorizedResponse(corsHeaders)
      }
      const { data: conv } = await serviceSupabase
        .from("conversations")
        .select("id, ai_summary, ai_summary_expires_at")
        .eq("id", conversation_id)
        .single();

      if (!conv) {
        return errorResponse(corsHeaders, "Conversation not found", 404);
      }

      // Skip if fresh summary exists (less than 5 min old)
      if (conv.ai_summary) {
        const summary = conv.ai_summary as Record<string, unknown>;
        if (summary.generated_at) {
          const generatedAt = new Date(summary.generated_at as string);
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
          if (generatedAt > fiveMinAgo) {
            log.info('Skipping: fresh summary exists', { conversationId: conversation_id });
            return successResponse(corsHeaders, { skipped: true });
          }
        }
      }

      const success = await summarizeConversation(conversation_id);

      return successResponse(corsHeaders, { success });
    }

    // Mode: backfill — requires cron/service or super_admin
    if (mode === "backfill") {
      if (!verifyCronOrService(req)) {
        const admin = await verifySuperAdmin(req)
        if (!admin) return unauthorizedResponse(corsHeaders)
      }
      const batchLimit = Math.min(limit || 20, 50); // max 50 per call
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      // We fetch candidates and filter by message count in JS (no subquery in REST API)
      const { data: candidates, error } = await serviceSupabase
        .from("conversations")
        .select("id, last_message_at")
        .is("ai_summary", null)
        .lt("last_message_at", oneHourAgo)
        .order("last_message_at", { ascending: false })
        .limit(batchLimit * 3); // fetch more to account for those with <3 messages

      if (error) {
        log.error('Error fetching backfill candidates', { error: error.message });
        return errorResponse(corsHeaders, "Failed to fetch conversations");
      }

      if (!candidates || candidates.length === 0) {
        log.info('Backfill: no candidates found');
        return successResponse(corsHeaders, { processed: 0, total_candidates: 0 });
      }

      log.info('Backfill: processing candidates', { limit: batchLimit, candidates: candidates.length });

      let processed = 0;
      let skipped = 0;

      for (const conv of candidates) {
        if (processed >= batchLimit) break;

        try {
          const success = await summarizeConversation(conv.id);
          if (success) {
            processed++;
          } else {
            skipped++;
          }
          // Small delay to avoid AI rate limits
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
          log.error('Backfill error processing conversation', { convId: conv.id, error: err instanceof Error ? err.message : String(err) });
          skipped++;
        }
      }

      log.info('Backfill complete', { processed, skipped });
      return successResponse(corsHeaders, { processed, skipped, total_candidates: candidates.length });
    }

    // Mode: inactive conversations — requires cron/service or super_admin
    if (mode === "inactive") {
      if (!verifyCronOrService(req)) {
        const admin = await verifySuperAdmin(req)
        if (!admin) return unauthorizedResponse(corsHeaders)
      }
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const batchLimit = limit || 20;

      const { data: inactiveConvs, error } = await serviceSupabase
        .from("conversations")
        .select("id")
        .lt("last_message_at", oneHourAgo)
        .is("ai_summary", null)
        .order("last_message_at", { ascending: false })
        .limit(batchLimit * 3); // fetch extra to account for those with <3 messages

      if (error) {
        log.error('Error fetching inactive conversations', { error: error.message });
        return errorResponse(corsHeaders, "Failed to fetch conversations");
      }

      if (!inactiveConvs || inactiveConvs.length === 0) {
        log.info('No inactive conversations to summarize');
        return successResponse(corsHeaders, { processed: 0 });
      }

      log.info('Processing inactive conversation candidates', { count: inactiveConvs.length });

      let processed = 0;
      for (const conv of inactiveConvs) {
        if (processed >= batchLimit) break;
        try {
          const success = await summarizeConversation(conv.id);
          if (success) processed++;
          // Small delay to avoid AI rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          log.error('Error processing inactive conversation', { convId: conv.id, error: err instanceof Error ? err.message : String(err) });
        }
      }

      return successResponse(corsHeaders, { processed });
    }

    return errorResponse(corsHeaders, "Invalid request: provide conversation_id, mode=backfill, or mode=inactive", 400);
  } catch (err) {
    log.error('Unexpected error', { error: err instanceof Error ? err.message : String(err) });
    return errorResponse(corsHeaders, err instanceof Error ? err.message : "Unknown error");
  }
});
