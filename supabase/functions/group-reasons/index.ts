import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { browserCorsHeaders as corsHeaders } from '../_shared/cors.ts'
import { verifyAuth, unauthorizedResponse } from '../_shared/auth.ts'
import { fetchWithTimeout } from '../_shared/fetchWithTimeout.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'
import { createLogger } from '../_shared/logger.ts'

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

const log = createLogger('group-reasons')

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require authenticated user
  const auth = await verifyAuth(req)
  if (!auth) return unauthorizedResponse(corsHeaders)

  try {
    const { reasons } = await req.json();

    if (!reasons || !Array.isArray(reasons) || reasons.length === 0) {
      return successResponse(corsHeaders, { grouped: [] })
    }

    // If few reasons, no need for AI grouping
    if (reasons.length <= 3) {
      return successResponse(corsHeaders, { grouped: reasons })
    }

    const reasonsList = reasons.map((r: any) => `- "${r.reason}" (${r.count}x)`).join("\n");

    const systemPrompt = `Você é um analista de atendimento ao cliente especializado em categorização detalhada de motivos de contato.

Regras:
- Agrupe motivos que são realmente o MESMO tema (ex: "problema login" e "não consigo entrar" = mesmo tema)
- NÃO agrupe motivos vagamente similares. Seja ESPECÍFICO e DETALHADO nos nomes das categorias
- Nomes de categoria devem ser descritivos e específicos (ex: "Erro ao Gerar Boleto", "Dúvida sobre Prazo de Entrega", "Alteração de Dados Cadastrais")
- NUNCA use categorias genéricas como "Informações Gerais", "Solicitações de Informações", "Compartilhamento de Informações" ou "Outros"
- Se um motivo não se encaixa em nenhum grupo, mantenha-o com seu nome original
- Some as contagens dos motivos agrupados
- Retorne no máximo 10 categorias, ordenadas por contagem decrescente
- Responda APENAS com JSON válido, sem markdown

Formato de resposta:
[{"category": "Nome Específico da Categoria", "count": 10, "original_reasons": ["motivo1", "motivo2"]}]`;

    const aiResponse = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Motivos de contato:\n${reasonsList}` },
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      log.error('AI error', { status: aiResponse.status })
      return successResponse(corsHeaders, { grouped: reasons })
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const grouped = JSON.parse(cleaned);
      return successResponse(corsHeaders, { grouped })
    } catch {
      log.error('Failed to parse AI response', { raw: rawContent.substring(0, 200) })
      return successResponse(corsHeaders, { grouped: reasons })
    }
  } catch (err) {
    log.error('Error', { error: (err as Error).message })
    return errorResponse(corsHeaders, err instanceof Error ? err.message : "Unknown error", 500)
  }
});
