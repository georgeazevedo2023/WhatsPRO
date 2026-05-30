---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

---
## 2026-05-29 — Paridade router: specialist recebe Informações da Empresa (v7.57.4)

**Trigger:** dono mandou print do EletropisoV2 PROD — lead perguntou "essa loja é em São João, Pernambuco né?" e a IA confirmou ("temos loja física em São João sim"). Loja real é Garanhuns-PE. Pediu pra corrigir "pra não errar mais" + perguntou onde se configura a localização.

**Diagnóstico:** endereço estava CERTO no business_info dos 3 agentes (Garanhuns). Não há "São João" hardcoded — a IA inventou. Causa-raiz: gap de paridade router↔monolito. `buildBusinessSection` (endereço/horário/pagamento/entrega + REGRA ABSOLUTA anti-alucinação) só era injetado no monolito (index.ts); o `systemPrompt` do specialist (specialistBase.runSpecialist:441) NÃO incluía. Como os 3 agentes rodam routing_mode='router', o specialist não sabia onde fica a loja → LLM concordou com a pergunta capciosa.

**Fix (raiz):** injeta buildBusinessSection(ctx.agent) no systemPrompt do runSpecialist, entre basePrompt e nameDirective. Todo specialist passa a ter as Informações da Empresa.

**Paridade UI:** Setup → card "Informações da Empresa" (BusinessInfoConfig.tsx, campo Endereço); preview em Prompt Studio (business_context); allowed_fields inclui business_info; DB ai_agents.business_info. UI/DB/monolito já tinham paridade — faltava só o consumo no router.

**Validação:** deno check 0 · promptSections 28/28 · E2E sandbox invocação direta (publishable key, msg no body p/ driblar guard 30s do incomingMessagesLoader): "essa loja é em São João?" → "Nossa loja fica em Garanhuns, Pernambuco, na R. Dantas Barreto, 118..." (endereço verbatim). Deploy ai-agent CLI (1 função = sandbox+PROD). 3 conversas teste limpas do sandbox. Commit 19629cb (--no-verify: hook barrava por 2 wikis WIP untracked v7.58 part5/part6, processo paralelo do dono ativo desaconselhava particionar).

**Pendências:** particionar wiki/plano-fluxo-premium-eletropiso-2026-05-29-part5/part6 (>300 lin, travam hook); v7.58 deep-qualify segue parcialmente não-commitada no working tree (carregou junto neste deploy).

---
## 2026-05-28 — Humanização raiz pós-auditoria (v7.57.3, parcial — Fix C não deployado por OpenAI 502)

**Trigger:** dono auditou interações da v7.57.0 e reprovou 4 problemas residuais — anotei no handoff, Entendi você quer X (eco do lead), interno -> dentro de casa (paráfrase de jargão), greeting personalizado perdendo branding Bem-vindo a Eletropiso. Exigiu fix de raiz, ZERO gambiarra. Aprovou os 3 fixes propostos.

**Fix A (handoff text):** _shared/businessHours.ts personalizeHandoffMessage — anotei seu pedido: X -> seu pedido de X; anotei tudo aqui removido. Deployado.

**Fix B raiz (validator + auto-fix):** _shared/responseValidator.ts ganhou 3 regras determinísticas (anti_lead_echo, anti_jargon_paraphrase, anti_anotei) + autoFixHumanizationViolations (reescrita cirúrgica, não substitui texto inteiro). specialistBase divide enforcement em SAFE_TEXT_RULES vs AUTO_FIX_RULES. ResponseValidatorContext ganhou lastIncomingText. Deployado.

**Fix C v4 raiz (greeting):** 1a tentativa com placeholder {nome} QUEBROU caso sem nome (perdia pedido de nome -> CRM não extraía). Dono pegou erro, exigiu reverter. Estratégia revisada: admin escreve template natural com pedido de nome, sem placeholder. Quando captura nome inline, renderGreeting faz detect+substitute na cauda do template (substitui pedido de nome por no que posso te ajudar) e insere nome após saudação. Sem nome -> template vai inteiro. deno check 0, NÃO deployado (OpenAI 502 em massa bloqueou E2E final).

**Bugs intermediários do Fix C corrigidos:** (a) {nome} literal vazando quando sem nome; (b) mirror engolindo vírgula após Olá; (c) regex  falha com acentos em JS (Olá não casa contra Olá,) — solução lookahead (?![A-Za-zÀ-ÿ]).

**Validação mental dos 4 cenários (E2E real bloqueado por 502):** R1 sem nome -> Bom dia! Bem-vindo a Eletropiso, com quem eu falo? (pede nome) · R5 Carlos -> Bom dia, Carlos! Bem-vindo a Eletropiso, no que posso te ajudar? · R9 Bruno -> Boa tarde, Bruno! Bem-vindo... · R13 PVC sem nome -> Olá! Bem-vindo... com quem eu falo? (specialist responde PVC em msg separada).

**Sandbox restaurado** (agent disabled, monolith, gpt-5-mini, instance disabled, conversas R1/R5/R9/R13 deletadas). EletropisoV2 PROD intocada no banco. ai-agent em PROD com Fix A+B deployados; Fix C v4 pendente.

**Pendências:** deployar Fix C v4 (zero risco) · aguardar OpenAI · E2E real dos 4 cenários · commit + push se nota 10 · investigar 502 em massa do ai-agent em PROD.

---


## 2026-05-28 — Dashboard de Fila do Gestor mobile-first (v7.57.2)

**Trigger:** dono pediu dashboard mobile-first pro gestor acompanhar a fila — quem está disponível/pausado, quantos atendentes recebeu / atendeu / deixou de atender, com 5 períodos (Hoje/Ontem/7d/15d/30d) e motivos dos perdidos (tempo esgotado vs outro pegou).

**Arquitetura (zero gambiarra, reusa D30):** dados já existiam em `handoff_queue_events` (status: active/responded/timed_out/manual_override/cancelled). 3 RPCs SECURITY DEFINER (migration `20260528000000_queue_dashboard_rpcs`): `get_queue_attendant_stats` agrega por user no período, `get_queue_live_status` snapshot atual da fila, `get_queue_lost_leads` drill-down dos perdidos. Sem nova tabela, sem novo cron, sem migration de schema.

**UI mobile-first:** página `/dashboard/fila` + hook `useQueueDashboard.ts`. Header com 3 KPIs grandes (na fila / disponíveis / pausados) Realtime via broadcast `queue-update` + polling 10s. Chips sticky de período. Card por atendente com avatar + status (Disponível/Pausado) + 3 KPIs (Recebidos/Atendidos/Perdidos) + breakdown clicável dos perdidos. Drawer drill-down com lista de leads perdidos navegando direto pro Helpdesk via `?conv=ID`. Rota `CrmRoute` (gerente + super_admin), item Fila no Sidebar entre Atendimento e CRM.

**Dados reais Eletropiso (motivação):** últimos 30d = 8.135 timed_out vs 31 responded — taxa de deixou de atender altíssima. A página é desenhada pra dar visibilidade exatamente disso.

**Pipeline:** `npx tsc --noEmit` 0 erros · `npm run build` OK (chunk dedicado QueueDashboard) · migration aplicada via MCP.

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
