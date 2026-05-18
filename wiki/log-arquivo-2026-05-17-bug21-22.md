---
title: Log arquivado — 2026-05-17 (noite-inicio) Bug 21+22 v7.37.6
type: log-arquivo
archived_from: log.md
archived_at: 2026-05-18
---

# 2026-05-17 (noite-inicio) — Bug 21+22 fix: validator BLOCK ignorava outside_hours + transbordo prematuro (v7.37.6)

User mandou print: lead "boa tarde" → "george" → "voces tem trena?" → IA respondeu *"Perfeito! Vou conectar você com nosso consultor de vendas para finalizar seu pedido. Em instantes você terá retorno."* — duas falhas:

**Bug 21:** transbordo prematuro. Categoria `ferramentas_manuais` tem 2 fields obrigatórios (`tipo_ferramenta`, `uso_ferramenta`). Auto-extract pegou só `trena` (tipo). Faltava `uso_ferramenta` (profissional/doméstico). Mesmo assim handoff disparou. Vendedor recebe lead sem qualif → perde tempo perguntando o óbvio.

**Bug 22:** msg REGULAR enviada em vez de `_outside_hours` (domingo, Eletropiso fechada) — regressão do que Bug 16 v7.37.3 fixou. Root cause: NÃO foi pelo handoff_to_human tool (sem log de event=handoff). Foi pelo **validator BLOCK path** (linha 3344 antiga). Esse path usava `agent.handoff_message` direto, sem checar `outside_hours` — 4º caminho que escapou do Bug 16 fix.

**Fix v7.37.6 — validator BLOCK reescrito:**
1. **Bug 22:** `pickHandoffMessage({agent,profileData,funnelData,outsideHours})` helper agora aplicado no validator BLOCK path. Adiciona também log `event='handoff', reason='validator_block'` (antes invisível).
2. **Bug 21:** se `qualificationContext` contém "PRÓXIMA PERGUNTA OBRIGATÓRIA" (ou seja, qualif ainda incompleta), validator BLOCK NÃO transborda — em vez disso envia a "FRASE EXATA SUGERIDA" extraída do qualif context. Lead continua sendo qualificado. Log `event='response_sent', metadata.source='validator_block_qualif_fallback'`.

**Validação E2E (mesmo cenário do user — Sandbox UAZAPI → Eletropiso prod, domingo fechado):**
- T1 "oi" → greeting padrão
- T2 "sou o Joao" → "Joao, em que posso te ajudar hoje?" (Bug 19 ✅ sem chutar produto)
- T3 "voces tem trena?" → **"Pra te ajudar, uso? (profissional ou doméstico)"** — PERGUNTA o uso ✅ (era esse o bug)
- T4 "profissional" → IA pergunta comprimento (LLM improvisou — bug paralelo backlog: LLM inventa fields fora do schema)
- T5 "5 metros, fechar" → IA pergunta tipo de trabalho (enrichment, search_fail:1 — trena não cadastrada)
- T6 "quero falar com vendedor agora" → IA enviou EXATAMENTE `handoff_message_outside_hours` ("...assim que estivermos disponíveis...") + `status_ia=shadow` + `ia:shadow` tag ✅

**Regra preventiva:** TODO path que decide transbordo (`handoff_to_human` tool, auto-handoff, deferred trigger, **validator BLOCK**, futuros) DEVE consultar `pickHandoffMessage` para escolher regular vs outside_hours. Centralizar em helper compartilhado evita 5º caminho escapar. Buscar grep `agent.handoff_message ||` periodicamente — qualquer uso direto sem o helper é red flag.

Arquivos: `ai-agent/index.ts` (~60 linhas no validator BLOCK path: guard qualif + helper). tsc=77 (igual ao pre-fix, sem regressão). Deploy ai-agent. Screenshots: `wiki/validacoes/bug21_22_validado.png`.

**Backlog Bug 23 (achado nesta sessão):** LLM em enrichment improvisa pergunta sobre field NÃO cadastrado (ex: "comprimento" pra trena). Resultado: pergunta off-script, dado coletado vira `tipo_ferramenta:trena_5m` em vez de field próprio. Investigar: 2026-05-18 — *"limitar improvisação LLM em enrichment / schema dinâmico"*.
