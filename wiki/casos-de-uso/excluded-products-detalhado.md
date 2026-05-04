---
title: Produtos NÃO Vendidos (D28) — Detalhado
tags: [excluded-products, ai-agent, qualificacao, handoff, fallback, ui-admin]
sources: [supabase/functions/_shared/excludedProducts.ts, src/components/admin/ai-agent/ExcludedProductsConfig.tsx, supabase/migrations/20260430000001_*]
updated: 2026-05-04
---

# Produtos NÃO Vendidos (D28)

> Cadastre produtos/serviços que sua loja **não trabalha**. A IA responde educadamente sem chamar vendedor.

---

## 1. O que é (didático)

Loja de material de construção recebe perguntas tipo "Vocês têm caixa de correio?", "Vendem geladeira?", "Trabalham com móveis planejados?". Sem essa feature, a IA transbordava pra vendedor humano — desperdiçando tempo com perguntas fora do portfólio.

**Com D28**, o admin cadastra a lista de produtos que NÃO vende. A IA detecta automaticamente e responde *"Não trabalhamos com caixa de correio, posso te ajudar com outro produto?"* sem incomodar vendedor — e sem contar no limite de mensagens do lead.

---

## 2. Como funciona (didático)

### Fluxo do cliente

1. Cliente manda mensagem (ex: "Tem geladeira?")
2. IA verifica internamente se a palavra está na lista de produtos não vendidos
3. **Se sim** → responde polidamente + sugere outro produto. Não chama vendedor.
4. **Se não** → fluxo normal (qualifica, busca catálogo, etc.)

### Fluxo do admin

1. `/dashboard/ai-agent` → seleciona agente → tab **Qualificação**
2. Rola até **"Produtos que NÃO vendemos"** (abaixo de "Categorias de atendimento")
3. Clica **"Adicionar produto excluído"** e preenche:
   - **Identificador** — auto-gerado (ex: `caixa_correio`)
   - **Palavras-chave** — separadas por vírgula (ex: `caixa de correio, correio, mailbox`)
   - **Resposta da IA** — opcional. Vazio → fallback automático.

### Cenários reais

| Cliente pergunta | IA responde | Conta no contador |
|---|---|---|
| "Tem caixa de correio?" | "Não trabalhamos com caixa de correio, posso te ajudar com outro produto?" | NÃO |
| "Vendem geladeira inox?" | "Não trabalhamos com geladeira, posso te ajudar com outro produto?" | NÃO |
| "Quero comprar tinta branca" | (fluxo normal — qualifica e busca) | sim |
| "Vou aos correios pegar" | (fluxo normal — `correios` plural não casa `correio` singular) | sim |

---

## 3. Camada técnica

### Schema

Coluna `ai_agents.excluded_products JSONB DEFAULT '[]'`:

```json
[
  {
    "id": "caixa_correio",
    "keywords": ["caixa de correio", "correio", "caixa correio", "mailbox"],
    "message": "",
    "suggested_categories": ["fechaduras"]
  },
  {
    "id": "eletrodomesticos",
    "keywords": ["geladeira", "freezer", "microondas", "airfryer"],
    "message": "Não fazemos eletrodomésticos. Mas temos cabos, disjuntores e tomadas."
  }
]
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | sim | Identificador único, slug-format |
| `keywords` | string[] | sim (≥1) | Palavras-chave que disparam o match |
| `message` | string | não | Resposta customizada. Vazio → fallback genérico |
| `suggested_categories` | string[] | não | (futuro) categorias sugeridas pra UI |

### Helper `_shared/excludedProducts.ts`

```typescript
matchExcludedProduct(text: string, excluded: ExcludedProduct[])
  : { product, matchedKeyword, message } | null
```

- **Word boundary** (`\b...\b`) — `correio` NÃO casa `correios` (plural)
- **Case-insensitive** — `GELADEIRA` casa `geladeira`
- **Acentos ignorados** via NFD normalize
- **Primeiro match vence** — ordem da lista importa
- **Fallback automático** — se `message` vazio, gera `"Não trabalhamos com {matchedKeyword}, posso te ajudar com outro produto?"` preservando case/acento da keyword

### Integração no edge function

Em `ai-agent/index.ts:504` (região `5.55 Excluded products check`):

```typescript
if (conversation.status_ia !== STATUS_IA.SHADOW) {
  const matched = matchExcludedProduct(incomingText, agent.excluded_products)
  if (matched) {
    await sendTextMsg(matched.message)
    await supabase.from('conversation_messages').insert({...})
    await supabase.from('ai_agent_logs').insert({
      event: 'excluded_product_match',
      metadata: { excluded_id, matched_keyword, ... }
    })
    return Response  // early return — NÃO incrementa lead_msg_count
  }
}
```

O check roda **antes** de: counter increment (`lead_msg_count`), handoff triggers, carregamento de labels/history/knowledge, qualquer LLM call. Resultado: zero custo OpenAI quando o lead pergunta sobre produto excluído + não polui contadores.

### Componente UI

`src/components/admin/ai-agent/ExcludedProductsConfig.tsx`:

- Sub-componente `KeywordsInput` com `useState` local pra texto raw — resolve bug do espaço (R89)
- Slugify automático no campo ID
- Validação inline: ID duplicado, keywords vazias
- Preview dinâmico do fallback abaixo do textarea

### Telemetria

```sql
SELECT created_at, latency_ms, metadata
FROM ai_agent_logs
WHERE event = 'excluded_product_match'
  AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

Metadata: `{ excluded_id, matched_keyword, incoming_text }`.

---

## 4. Por que não usar `blocked_topics` ou Knowledge Base?

| Solução | Semântica | Comportamento | Manutenção |
|---|---|---|---|
| **Excluded Products** (D28) | Produto fora do portfólio — IA discute educadamente | "Não trabalhamos com X, posso ajudar?" | Lista enxuta, lookup O(N×K) word-boundary |
| `blocked_topics` (Guardrails) | Tema tabu — IA nunca discute (concorrentes, política) | Mensagem genérica seca | Lista pequena, pra tabus reais |
| FAQ (Knowledge Base) | Pergunta frequente com resposta | LLM injeta no prompt e responde | Cresce sem limite |
| `service_categories` | Lista positiva (o que VENDE) | Qualifica via stages + score | Estruturado, complexo |

D28 é semanticamente diferente — não confundir.

---

## 5. Bugs encontrados durante a implementação

- **R88** — `chk_ai_agent_logs_event` faltava `excluded_product_match` na whitelist → INSERT falhava silenciosamente. Fix: migration `20260430000001_excluded_product_match_event.sql`. Lição: Supabase JS retorna `{error}` em vez de throw — sempre conferir CHECK constraints + try/catch em telemetria.
- **R89** — UI controlled input com `value={array.join(', ')}` + `.trim()` em onChange impede digitar espaço. Fix: sub-componente `KeywordsInput` com `useState` local, sync externa só por `itemId`.

---

## 6. Validação real em prod (2026-04-30)

Lead George (`558193856099`) testou via WhatsApp:

| Hora | Quem | Mensagem | Counter | Status |
|---|---|---|---|---|
| 07:47 | Lead | "Bom dia" | 1 | greeting |
| 07:51 | Lead | "George" | 2 | LLM responde |
| 07:51 | Lead | "Tem caixa de correio?" | **2 ← não subiu!** | excluded match |
| 07:52 | IA | "Não trabalhamos com caixa de correio, posso te ajudar com outro produto?" | — | OK |

**Confirmações via SQL:** `lead_msg_count = 2` (excluded msg não conta), `status_ia = 'ligada'` (não virou shadow), tags limpas, sem evento de handoff.

---

## 7. Testes

- **27 unit tests** em `supabase/functions/_shared/__tests__/excludedProducts.test.ts` (matcher, validator, fallback, case/acento, word boundary)
- **20 runtime tests** em `scripts/test-excluded-products-runtime.mjs` (busca DB real → matcher idêntico ao deployed → response final)

```bash
SUPABASE_ACCESS_TOKEN=sbp_... node scripts/test-excluded-products-runtime.mjs
```

---

## Links

- [[wiki/ai-agent]] — visão geral do AI Agent (com seção Excluded Products)
- [[wiki/decisoes-chave]] — D28 (decisão completa) + R85-R89 (regras correlatas)
- [[wiki/erros-e-licoes]] — R87, R88, R89
- [[wiki/casos-de-uso/ai-agent-detalhado]] — outras features do AI Agent
- `supabase/functions/_shared/excludedProducts.ts` — código do helper
- `src/components/admin/ai-agent/ExcludedProductsConfig.tsx` — UI admin
- `supabase/migrations/20260430000001_excluded_product_match_event.sql` — fix R88

---

*Rev 2 (2026-05-04): Condensado de 211 para <=200 linhas (regra 14).*
