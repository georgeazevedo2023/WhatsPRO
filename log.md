---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

---

## 2026-05-28 — Helpdesk: mensagens visíveis + console limpo (v7.57.1)

**Trigger:** dono pediu auditar projeto e documentação porque mensagens não apareciam no Helpdesk e queria zerar erros de console.

**Auditoria:** o contrato documentado em `docs/CONTEXTO_PROJETO.md` já citava "stale fetch guard" para impedir mensagens de uma conversa aparecerem em outra, mas `ChatPanel.tsx` ainda não tinha `fetchIdRef`. Também havia uma janela de crash: ao trocar/limpar seleção, `messages` podia manter linhas da conversa anterior enquanto `conversation` virava `null`; o memo de divisores acessava `conversation!.is_read` e podia quebrar renderização. Em paralelo, `ContactAvatar.tsx` disparava `triggerRefresh()` durante render, efeito colateral que pode gerar warnings/ruído no console.

**Fix:** `ChatPanel.tsx` agora incrementa `fetchIdRef` por carga, ignora respostas stale, limpa mensagens/erro/loading quando não há conversa e calcula unread com `conversation?.is_read ?? true`. `ContactAvatar.tsx` move a reidratação lazy para `useEffect`.

**Validação:** `npx tsc --noEmit` 0 erros; `npm run build` OK; Vitest focado em helpdesk 17/17; Playwright Helpdesk 11/11 após refazer login pelo setup; checagem Playwright dedicada abriu conversa real (`?conv=e7131d35-167e-446e-97b5-23db59053546`) e retornou `consoleErrors: []` + `pageErrors: []`. `npm run test` completo ainda falha fora deste changeset (`excludedProducts`, `useForms`, `FormBuilder` e loaders ESM `https:` em testes Deno). Browser interno não abriu por falha de sandbox do Windows (`spawn setup refresh`), então a validação visual foi feita via Playwright headless.

---

## 2026-05-28 — Humanização do atendimento E2E 13 cenários (v7.57.0)

**Trigger:** dono pediu E2E real nas instâncias de teste com iteração até nota 10 em humanização (lead não pode perceber que é IA), estilo cordial profissional. Pediu cobertura ampla: com/sem saudação, com/sem nome, intenção direta/indireta, 1 item / multi-item, orçamento, foto, carrossel, contagem+transbordo, qualif progressiva, msg transbordo com contexto. **Durante a sessão**, dono mandou 2 screenshots de PROD (Moyses pedindo PVC + serviços de instalação) — IA prometia "mão de obra"/"indicação de instalador" que a loja NÃO oferece. Pediu pra ajustar.

**Setup operacional:** Sandbox Agent `9c71f43e` (estava DISABLED + monolith) reconfigurado pra `enabled=true, routing_mode=router, model=gpt-4.1-mini`, config humanização-relevante clonada do EletropisoV2 PROD. 13 contatos+conversas com JIDs 5511910000001..013 pré-criados. Helper E2E: POST direto pro `ai-agent` (verify_jwt=false, publishable key via `apikey + Authorization Bearer`) em paralelo via PowerShell jobs; incoming INSERT batchado por tier de turno via SQL.

**3 iterações:**
- **Baseline (16 problemas catalogados):** "😊 Com quem eu falo?" (emoji isolado, sem espelhar saudação), "Vou seguir coletando o restante das informações", `handoff_to_human(reason: "...")` vazado no texto, "Vou resumir para o vendedor: cliente Bruno deseja..." na msg do lead, "(interno ou externo)" formulário, repetir produto+preço após mídia, "Infelizmente não trabalhamos com pneu", handoff sem personalização nome+item, S13 prometendo "mão de obra".
- **Deploy 1 (fixes batch):** ai-agent/index.ts (greeting dinâmico espelha saudação + captura nome inline + skip se quer vendedor direto), greetingSpecialist/qualificationSpecialist/productSpecialist (diretrizes humanização + regra absoluta "só vende material"), excludedProducts ("Esse não é o nosso forte aqui"), dispatchResponse (stripLeakedToolCalls cobre `NOME(key: "val")` sem braces).
- **Deploy 2 (refinamentos):** nameCapture estendido (`sou João` sem o/a, `Boa tarde, João`), index.ts skip-greeting protege contra `try_insert_greeting` vazio, productSpecialist reforça "NÃO repetir nome+preço pós-mídia".

**Resultado nota humanização (6 dimensões: detectabilidade-IA / cordialidade / naturalidade / objetividade / aderência ao fluxo / coerência):** baseline **5.2** → DEPOIS **9.2**.

**Cenário crítico S13 (Moyses PVC):** ANTES (PROD real) IA dizia *"Oferecemos os materiais em PVC, mas a montagem/instalação normalmente é feita por parceiros"* + *"vou te passar o orçamento completo… com todos os acessórios e MÃO DE OBRA em Garanhuns"*. DEPOIS (sandbox) IA diz: *"Aqui a gente vende só o material mesmo, sem montagem ou instalação. Posso montar um orçamento dos materiais em PVC para você nesses 71 metros?"*. Bug crítico de PROD fechado.

**Custo + restauração:** ~80 LLM calls (~R$ 1,50 OpenAI), sandbox restaurada ao estado original (disabled, monolith, gpt-5-mini, 13 contatos+conversas de teste apagados, instance disabled=true). 0 conversas reais afetadas. EletropisoV2 PROD recebe os mesmos fixes pela edge function ai-agent compartilhada.

**Achados de backlog menor:** (a) personalizeHandoffMessage no path "wantsHumanFirstTurn" (S12) — nome inline não persistido a tempo; (b) extractLeadName trunca "João"→"Jo" ocasional; (c) parênteses-formulário esporádicos no LLM (1 a cada N).

**Frase de retomada:** *"v7.57.0 humanização shipped (nota 5.2→9.2 em 13 cenários). Sandbox restaurada. Backlog: personalizeHandoffMessage no path skip-greeting (S12); truncamento "Jo" no extractLeadName. Monitorar EletropisoV2 PROD pós-deploy — caso Moyses não pode repetir."*

Detalhe completo: [[wiki/relatorio-humanizacao-2026-05-28]].

---


---

## Entries arquivadas

Entries de 2026-05-26 e anteriores → [[wiki/log-arquivo-2026-05-28-part1]].
Para arquivos mais antigos, ver `wiki/log-arquivo-*`.
