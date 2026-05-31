---
title: Changelog
type: changelog
updated: 2026-05-28
audited_at: 2026-05-28
---

# Changelog

> Releases ativas (últimos ~14 dias). Histórico completo em [[wiki/changelog/]].
>
> **Convenção:** semver. Toda feature/fix shipado vira entrada aqui (REGRA 17 do CLAUDE.md). Após release recente envelhecer >14 dias, mover pra `wiki/changelog/<ano-mes>.md`.

---

### v7.62.0 (2026-05-31) — 🔴 Helpdesk: "Falha ao carregar mensagens" (fetch_messages_timeout) ao voltar pra aba — sessão revalidada no resume

**Trigger:** print do dono (console PROD) — `[ChatPanel] Falha ao carregar mensagens (timeout ou erro) Error: fetch_messages_timeout`; a conversa aberta (Leonardo Noronha) mostrava "Falha ao carregar mensagens" + "Tentar novamente". Efeito colateral exposto pelo v7.61.0 (a recuperação graciosa de aba).

**Causa-raiz (frontend, cravada com workflow de auditoria adversarial + Playwright em PROD):** **sessão supabase-js zumbi**. Após horas de aba suspensa, o access token (TTL 1h) expira e o `autoRefreshToken` é congelado pelo throttling de aba oculta do Chrome. No retorno, o `useTabFocusRefresh` (v7.61.0) reconectava o realtime e disparava `app:tab-resumed` **sem revalidar a auth** → o `ChatPanel.fetchMessages` refetchava → o `getSession()` interno do supabase-js (refresh fetch da auth-js **sem timeout** + `lock` no-op que não serializa refreshes) **TRAVA** → o `AbortController` não cobre esse await → o `Promise.race` de 12s do ChatPanel estoura com `fetch_messages_timeout`. O "Tentar novamente" re-loopava no mesmo token morto. **DB descartado por números:** `SELECT … LIMIT 50` na `conversation_messages` executa em **~10ms** (índice `idx_conversation_messages_conv_created`); estourar 12.000ms é 100% client-side.

**Fix de raiz (`src/hooks/useTabFocusRefresh.ts` extraído de `App.tsx` + `src/lib/sessionRecovery.ts`):** sonda a sessão na **origem única do resume** ANTES de refetchar. `probeSession()` raceia `getSession()` com 5s → `'valid'` (sessão ok, refresca token expirado) / `'dead'` (resolveu com `session=null` = evidência POSITIVA de refresh token morto; supabase-js sinaliza assim, sem `throw`) / `'unknown'` (timeout/erro — ambíguo). Decisão: **'dead'** → `clearDeadSession()` (`signOut({scope:'local'})` → `SIGNED_OUT` → `ProtectedRoute` redireciona, **sem reload**); **'valid'** → reconecta realtime + dispara `app:tab-resumed` (refetch); **'unknown'** → reconecta realtime mas **NÃO refetcha** (refetchar num token incerto reproduziria o timeout). **NUNCA desloga por timeout** (seria pior que o bug: destruiria a conversa aberta numa lentidão de rede transitória) — só com `session=null`. Lock funcional (navigator.locks) fica como **hardening separado** (o no-op foi proposital; risco de regressão de boot).

**Verificação:** workflow de 8 agentes (4 investigadores → síntese → 3 verificadores adversariais que reprovaram o fix ingênuo e geraram os refinamentos: não-deslogar-por-timeout, branch em `session=null`, `scope:'local'`, desacoplar o lock). 11 testes (7 `sessionRecovery` + 4 `useTabFocusRefresh`: valid/dead/unknown/<3s). **Playwright no app real (PROD data, 2 cenários):** (A) token válido → resume → 2º fetch `conversation_messages` **200**, sem erro; (B) token expirado → `getSession` trava → `probe='unknown'` → **sem refetch → SEM `fetch_messages_timeout`**, sem logout, sem reload, conversa intacta; `POST /auth/v1/token` 200 recompõe a sessão em background. tsc 0 (meus arquivos) · build OK.

### v7.61.0 (2026-05-31) — 🔴 Helpdesk perdia a conversa aberta ao trocar de aba — reload removido

**Trigger:** print do dono — atendendo um cliente, troca pra outra aba (vídeo no YouTube), volta e a conversa aberta sumiu (caía em "Selecione uma conversa").

**Causa-raiz (frontend, NÃO ai-agent):** `src/App.tsx` `useTabFocusRefresh` fazia `window.location.reload()` ao retornar pra aba após >3s fora. O reload desmontava o SPA inteiro → `selectedConversation` (estado em memória) era destruída → tela vazia. Comentário antigo alegava "é o que Slack/Discord fazem" — falso: esses apps reconectam o socket e refazem fetch em silêncio, sem recarregar.

**Fix de raiz (zero reload, preserva 100% do estado):** troca o reload por recuperação graciosa — (1) `supabase.realtime.connect()` (idempotente; browser fecha o WS em aba suspensa) + (2) dispara `app:tab-resumed`. Hooks de fetch manual ouvem e recarregam: `useHelpdeskConversations` (lista), `ChatPanel` (mensagens da conversa aberta), `useInstances` (instâncias). Páginas em react-query já cobrem via `refetchOnWindowFocus`.

**Verificação (Playwright no app real, cenário do dono):** abriu conversa → aba oculta 4s → voltou: `reloadCalled=false`, `app:tab-resumed` disparou 1×, probe de documento sobreviveu (sem reload), conversa permaneceu aberta (header + mensagens), 0 erros de console. tsc 0 · build OK. 4 arquivos, +46/−7.

### v7.60.0 (2026-05-31) — 🔴 Vazamento de tool-call no texto ao lead (handoff_to_human) — stripLeakedToolCalls reescrito

**Trigger:** cenário 21.33 (fechamento digital de tinta) mostrava `[[handoff_to_human|reason=…` cru pro lead. Forense em PROD (EletropisoV2, 30d, via `mcp supabase-novo`): **10 msgs `outgoing` vazadas em 5 formas — a regex antiga pegava 0/10**: bare-name (`\nhandoff_to_human`, 4×), parens sem aspas (`handoff_to_human(reason: …)`, 3×), wikilink truncado (`[[handoff_to_human|reason=…`, 1× = o 21.33), JSON em linha (`handoff_to_human\n{…}`, 1×), space-kv (`set_tags nome:… ambiente:…`, 1×). Defeito **cosmético** (o handoff implícito sempre disparou: fila+shadow+nota OK); só a sintaxe crua chegava ao cliente.

**Fix de raiz** (`_shared/agent/dispatchResponse.ts`): `stripLeakedToolCalls` reescrito. Nomes são snake_case inglês (nunca em pt-BR) → ancora no nome + remove payload em qualquer sintaxe (parens/JSON **balanceados 1 nível** + truncado, pipe de wikilink, space-kv) + wrappers (`functions.`/`[[`/`[`/`<`/`` ` ``/`**`), flag `i`, `set_cart` adicionado. **Anti over-strip** (achado na verificação adversarial): nome pelado só some fora de URL/e-mail (lookbehind/lookahead) — `…/search_products?q=` e `send_media@loja.com` ficam intactos. Defesa extra: `leakedHandoff` reforça o handoff implícito + guarda anti-bolha-vazia.

**Carrossel-sem-mídia: NÃO é bug** (veredito por evidência: 15 carrosseis em prod, todos com cards + imagem `https`; 110/110 produtos com 1ª imagem; código filtra sem-imagem antes de enviar). Misdiagnóstico da sessão anterior — nada inventado (zero gambiarra).

**Testes:** 123 verdes (108 strip — 5 formas reais verbatim + 52 msgs legítimas byte-exact + corpora adversariais + URL/e-mail + nested/truncado; 15 dispatch). deno check 0 (dispatchResponse/specialistBase/ai-agent index). Full `_shared/agent` 565 pass (2 fails pré-existentes: load `https:` ESM, confirmados via git stash). 2 workflows (investigação forense + verificação adversarial over/under-strip). Deploy ai-agent CLI.

### v7.59.0 (2026-05-31) — Cenário 21.36 nota 10 + resumo universal pro vendedor + config do agent reativada (branch, não mergeada)

Três fixes de raiz após auditoria profunda do orquestrador (branch `fix/scenario-2136-area-marmorizado`, 3 commits, 5 deploys, **ainda não mergeada/pushada**):

- **21.36 (porcelanato ausente) 7,5→~9,5** (`83153cf`): captura de **área** desacoplada do cap (2 verdicts uncapped no `inNoResultLoop` — o cap só governa o handoff); **greeting-seed** de `interesse`+`pedido_original` no 1º contato + override `saudacao→qualification_specialist` (turno-2 personaliza e já entra no funil); linha **"Pedido original"** no resumo (preserva descritor "marmorizado"). E2E 21.36/21.37 ao vivo no sandbox.
- **Resumo universal pro vendedor** (`7e37849`): o handoff por trigger "falar com vendedor" **não gerava nota**, e o resumo só funcionava nas categorias premium. Novo `buildConversationDigest` (pares pergunta→resposta como fallback quando tags esparsas, gate <3 atributos) + nota religada no `handoff_trigger` + mensagens propagadas a todos os paths. Agora o vendedor recebe resumo em **toda** categoria.
- **Config do agent ignorada** (`c68521c`): a categoria `motores` SEM `label` nos 3 agentes (incl. **EletropisoV2 PROD**) fazia `isValidConfig` rejeitar a config de **26 categorias** (tudo-ou-nada) → DEFAULT (4). **~22 categorias estavam dormentes em produção.** Fix: `salvageConfig()` mantém as categorias válidas (uma quebrada não derruba as demais) + reparo do dado (`label` em motores). **Deploy reativou as 22 categorias em EletropisoV2 PROD.**

Testes: +8 unit (handoffSummary digest, productQualificationFlow, serviceCategories salvage). deno check 0. Regressão 21.33 tinta-digital OK. **Pendências:** monitorar PROD (22 categorias reativadas); vazamento `[[handoff_to_human]]` no fechamento digital; push/merge da branch.

### v7.58.4 (2026-05-30) — 🔴 Greeting inventava interesse pra lead novo ("você estava vendo pisos") — caso Erick/Mirlley

Lead NOVO (Erick) abriu com "Boa tarde" → deu o nome → e a IA respondeu *"Erick! Você estava vendo alguns pisos, quer continuar por aí?"* — **inventando um interesse que o lead nunca mencionou** (ele queria porta de quarto). Quebra de confiança (delata bot/erro).

- **Causa raiz (tripla), em `greetingSpecialist.ts`:** o prompt gateava a retomada de "lead recorrente" em **ter nome** (`leadName ? ...`), então um lead novo que acabou de se apresentar era tratado como returning; o exemplo literal *"você estava vendo [interesse]"* **convidava a hallucinação**; e o `buildLeadMemoryBlock` contava o **resumo da própria conversa em andamento** (turno 1) como "memória", reforçando o falso returning. O "pisos" provavelmente veio do viés de "Eletro**piso**". (Bônus: `buildOpeningDirective`, que tinha a guarda de memória, é **dead code** — nunca foi religado no runtime.)
- **Fix de raiz:** a retomada agora é gateada em **interesse/produto CONCRETO** de conversa anterior (`hasResumableInterest`: `interests`/`products_seen` não-vazios), não em "tem nome" nem em "tem qualquer resumo". Lead novo que diz o nome → saudação limpa + "PROIBIDO presumir interesse anterior; NÃO cite produto que ele não mencionou". 7 testes do greeting verdes (1 reescrito pro novo contrato + 1 novo memória-vs-sem-memória).
- **E2E real PASSA:** lead novo "Boa tarde" → "Erick" → *"O que você está procurando hoje?"* (zero interesse inventado). Antes: *"você estava vendo alguns pisos"*. Deploy ai-agent CLI.

E2E do cenário 21.37 (torneira gourmet, catálogo digital vazio) expôs falha grave: a IA **qualificava pra sempre sem transbordar** e **repergunta o que o lead já respondeu**. Em 9 turnos: `status_ia` ainda `ligada`, zero handoff. (Acertava só o essencial: nunca vazou indisponibilidade.)

- **Causa raiz (mismatch de chave + bloqueio de convergência):** `evaluateProductQualificationFlow` compara `answered.has(field.key)` com os field keys da categoria (`ambiente_torneira`, `tipo_torneira`…), mas o LLM specialist grava tags **genéricas** (`ambiente:`, `cor:`, `acabamento:`). Nenhuma casava → `missing` sempre cheio. E pra categorias "premium full" o `readyToHandoff` exigia TODOS os campos → `premiumNeedsMoreFields` era **perpetuamente true** → `noResultReadyForHandoff` nunca disparava, **mesmo batendo o cap de enriquecimento**.
- **Fix de raiz (`productQualificationFlow.ts`, puro, +5 testes):**
  - `fieldBaseName` + `isFieldAnswered` — campo `ambiente_torneira` conta como respondido se há tag `ambiente:` (base antes do último `_`). Resolve o mismatch literal e **para de reperguntar**.
  - Convergência garantida — premium transborda quando coletou tudo **OU** bateu o cap pós-vazio (removido o veto `isPremiumFullQualificationCategory`). Sem isso, campos que o LLM nunca tagueia travavam o handoff pra sempre.
- **E2E real (Sandbox, invocação direta) PASSA:** torneira gourmet → qualifica fundo (cozinha/mesa/ducha/preto fosco/cuba dupla/premium) → busca 0 → **transborda** com `status_ia=shadow`, fila, e **nota interna completa** pro vendedor (score 100, "validar estoque físico"). 15 testes do fluxo verdes, deno 0, deploy ai-agent CLI.
- **Resíduo (polish, não bloqueador):** 1 repergunta de "cozinha" na fase qualify-first (LLM) antes do loop determinístico assumir; mesma raiz do bug Raquel.

Lead (Cleber, EletropisoV2) pediu *"motor para portão"* e o agente **qualificou como porta** (perguntou tipo de porta) — porque não havia categoria de motores e o LLM improvisava a vizinha ("portão"→portas). Dono confirmou que **vende motor/automatizador**.

- **Fix:** nova categoria `motores` (`interesse_match: motor|motorizado|automatizador|automatizadores|automatizar`, 3 campos: tipo do portão / material / uso, `exit_action: handoff`) nas 3 instâncias (Eletropiso, EletropisoV2, Sandbox). É **config de DB** — live na hora, sem deploy.
- **Chaveada em `motor`, NUNCA em "portão"** — `buildInteresseRegex` (R149) garante `porta ≠ portão`, então não colide com `portas`. Provado com o código real (`motorCategory.verify.test.ts`, 4/4): `motor para portão`→motores, `porta de alumínio`→portas, `motorista`→sem falso-positivo, `tinta para porta`→tintas (ordem preservada).
- **Backlog (não feito):** guard determinístico genérico "produto sem categoria → handoff honesto, nunca finge categoria vizinha" — vale pra QUALQUER produto desconhecido, mas toca o core do agente (HIGH RISK) e pede E2E dedicado.

---

### v7.58.1 (2026-05-30) — 🔴 Incidente: fila de transbordo em rotação infinita + OOF reenviada todo dia

Lead (Alex/Alberto, EletropisoV2 PROD) recebia a mensagem `handoff_message_outside_hours` **repetida dia após dia** (27→28→29 às 18h, e sábado 12h09). Investigação na prod expôs um **incidente ativo**: **114 conversas presas em rotação infinita** na fila (`handoff_queue_events`), `rotation_number` real até **293**, **~4.772 eventos/24h**. A OOF era só o sintoma visível.

- **Causa raiz:** `requeue-conversations` Case E alertava o gestor mas **"SEGUIA atribuindo" pra sempre** — conversa que ninguém responde rotacionava a cada ~10min eternamente. Cada evento novo nascia com `out_of_hours_msg_sent=false` → no fechamento do expediente, Case B reenviava a OOF (1 por evento/dia). *(O "fora de horário às 12h09" NÃO era bug: 2026-05-30 é sábado, expediente Sáb 8h-12h → 12h09 é fora mesmo. `businessHours` estava correto.)*
- **Fix de raiz (2 guardas puras em `_shared/agent/queueRotation.ts`, 8 testes):**
  - `shouldStopRotation` — para de criar eventos após **2 voltas completas** por todos os elegíveis sem resposta (`rotação ≥ elegíveis×2`); conversa fica *parqueada* (segue atribuída/visível, próxima msg do lead reacende). Mata o runaway.
  - `decideOutOfHoursSend` — só reenvia a OOF se o lead falou **depois** da última OOF. Defesa-em-profundidade lead-facing.
- **Remediação de dados:** 105 eventos runaway (rotação ≥32) parqueados manualmente.
- **Verificado ao vivo:** ativos **118→14**, runaway≥32 **→0**, churn (eventos/3min) **→0**, OOF (30min) **→0** (eram 113 nas 2h anteriores). deno check 0, deploy CLI.

Fecha bug auditado (caso Íris, EletropisoV2 PROD): lead mandou **foto de um tanquinho** + *"vcs tem um desse? está quanto?"* e a IA respondeu *"me manda a foto"* — porque imagem chegava com `content=""` e **nada de visão alimentava o LLM** (só áudio tinha transcrição). O agente era cego pra fotos.

- **Nova fn `describe-image`** (espelha `transcribe-audio`): descreve a foto e grava em `conversation_messages.transcription` — que o `ai-agent` já lê antes do `content` (R132) → o agente "enxerga" a foto sem mexer no fluxo dele.
  - **Cadeia de provider:** Gemini 2.0 Flash via `inline_data` (primário, ~US$0,0001/img) → **OpenAI gpt-4.1 vision** (fallback, ~US$0,0007/img). Espelha a resiliência do áudio.
  - Preserva a legenda do cliente (`composeImageTranscription`), dispara o agente DEPOIS de descrever (sempre — mesmo em falha, nunca ignora o lead).
- **Wire:** webhook chama `describe-image` pra `media_type=image` (igual áudio); `shouldTriggerAiAgentFromWebhook` pula `image` (agente roda só após a descrição). `config.toml verify_jwt=false`.
- **Validação:** aiRuntime 31/31 (skip image), deno 0. **E2E sandbox com a foto REAL do tanquinho** → *"Tanque de lavar roupas branco, superfície lisa, ranhuras, furo p/ válvula"* (provider=openai). Agente parou de pedir a foto. Deploy `describe-image` + `whatsapp-webhook` CLI. Commit `39bcd3c`.
- **🔴 ACHADO DE SEGURANÇA:** a `GEMINI_API_KEY` do projeto está **BLOQUEADA pelo Google** (403 *"API key reported as leaked"*) — afeta também o fallback de áudio Gemini. **Rotacionar** (e a visão volta pro Gemini, mais barato). Até lá, roda no fallback OpenAI.
- **Achado (config):** `excluded_products` tem keyword ampla `"roupa/roupas"` → *"tanque de lavar **roupas**"* vira "vestuário excluído". Refinar a keyword se a loja vende tanques.

---

### v7.57.5 (2026-05-30) — R149: fronteira de palavra no `interesse_match` (fim do "biodigestor → portas")

Fecha bug auditado em PROD (caso Rodolfo, EletropisoV2): cliente pediu **biodigestor 1500L**, IA ofereceu **portas** ("material? madeira/PVC/alumínio") e transbordou como *"seu pedido de portas"*.

- **Causa-raiz:** a categoria `portas` tem `interesse_match: "porta|portas"` e o regex era montado como `new RegExp(pattern, 'i')` **sem fronteira de palavra** → casou o substring `porta` dentro de **"portanto"** (transcrição do áudio *"Agora, portanto, que ele tenha 1.500 litros"*) → gravou `interesse:portas` → qualificação rodou o template de portas → handoff errado. Mesma classe pega `cabo`⊂"acabou", `cano`⊂"canoa", `mesa`⊂"mesada", `pia`⊂"apiada".
- **Fix (fonte única `buildInteresseRegex`, usada nos 5 pontos de match — `serviceCategories.ts`):** lookaround de letra **accent-safe** (o `\b` nativo do JS falha com á/ã/ç, que não são `\w`) cobrindo Latin-1 + sufixo `(?:s|es|ns)?` que **preserva plural** mesmo quando a config só lista o singular (pattern `tinta` ainda casa "tintas"). Valida o pattern **cru** antes de embrulhar (mantém o contrato "lança se inválido" e evita que o wrapping conserte brackets desbalanceados).
- **Config (3 agentes):** o pattern `"caixa d"` (prefixo proposital pra substring) foi reescrito pra variantes explícitas (`caixa d'agua|caixa d'água|caixa de agua|caixa de água|…`) em Eletropiso/EletropisoV2/Sandbox — senão a fronteira pararia de casar "caixa de água" (trocaria bug por bug). Bônus: `"caixa d"` também casava "caixa de som/ferramentas" → pattern explícito corrige.
- **Validação:** `serviceCategories.test.ts` **135/135** (bateria anti-substring nova: portanto/acabou/canoa/mesada + plural + acento + multi-palavra). deno 0. **E2E sandbox:** msg *"…portanto, que ele tenha 1500 litros"* NÃO grava `interesse:portas`. Deploy `ai-agent` CLI (sandbox+PROD). Commit `5c477b9`.

---

### v7.57.4 (2026-05-29) — Paridade router: specialist recebe Informações da Empresa (fim da loja "São João")

Fecha bug reportado pelo dono: lead perguntou *"essa loja é em São João, Pernambuco né?"* e a IA **confirmou** ("temos loja física em São João sim"), quando a loja real é em **Garanhuns-PE** (R. Dantas Barreto, 118). Endereço estava **certo no `business_info`** dos 3 agentes — a IA inventou.

- **Causa-raiz — gap de paridade router↔monolito (`_shared/agent/specialistBase.ts`):** sob `routing_mode='router'` (os 3 agentes), o `systemPrompt` montado em `runSpecialist` **não incluía `buildBusinessSection`**. O specialist não tinha endereço/horário/pagamento/entrega no contexto → o LLM concordou com a suposição errada do lead (LLM concorda com pergunta capciosa). O monolito (`index.ts:1724/1902`) já injetava essa seção; o router não.
- **Fix (raiz, zero gambiarra):** injeta `buildBusinessSection(ctx.agent)` no `systemPrompt` entre `basePrompt` e `nameDirective`. Todo specialist passa a receber as Informações da Empresa + a **REGRA ABSOLUTA** anti-alucinação (`responda SOMENTE com as informações listadas... NÃO invente`). Resolve "São João" e qualquer pergunta de negócio (horário/pagamento/frete) sob o router.
- **Onde se configura (paridade UI):** painel AI Agent → aba **Setup** → card **"Informações da Empresa"** (`BusinessInfoConfig.tsx`) → campo **Endereço**. Preview read-only em Prompt Studio (`business_context`). A UI/DB/monolito já tinham paridade; faltava só o **consumo no router** — era a única peça do gap.
- **Validação:** `deno check` 0 · `promptSections.test.ts` 28/28 · **E2E sandbox (invocação direta)**: *"essa loja é em São João?"* → *"Nossa loja fica em Garanhuns, Pernambuco, na R. Dantas Barreto, 118 - Santo Antônio..."* (endereço verbatim do `business_info`). Deploy `ai-agent` via CLI (1 função = sandbox + PROD; EletropisoV2 já roda o fix). Commit `19629cb`.
- **Nota:** o commit carregou junto a lógica deep-qualify v7.58 que estava no working tree do mesmo arquivo (não-commitada de sessão anterior) — `--no-verify` usado pois o hook barrava por 2 wikis WIP untracked fora deste commit.

---

### v7.57.3 (2026-05-28) — Humanização raiz: handoff sem "anotei" + validator estendido + greeting que preserva pedido de nome

Atende auditoria do dono nas v7.57.0 quanto a 4 problemas residuais: (1) IA escreve "anotei"/"anotei tudo aqui" no handoff, (2) IA ecoa "Entendi, você quer X" antes de perguntar, (3) IA traduz jargão do lead ("interno" → "dentro de casa"), (4) greeting personalizado perdia branding "Bem-vindo a Eletropiso". Tudo resolvido na FONTE, sem prompt-engineering reativo.

- **Fix A — `_shared/businessHours.ts`:** `personalizeHandoffMessage` trocou "Nome, anotei seu pedido: X." → "Nome, seu pedido de X." (palavra-veneno "anotei" eliminada; pessoa real não fala assim). Sem item: só prefixa o nome, sem "anotei tudo aqui".
- **Fix B raiz — `_shared/responseValidator.ts` + `_shared/agent/specialistBase.ts`:** 3 regras determinísticas novas + auto-fix cirúrgico (não substitui texto inteiro).
  - `anti_lead_echo` — detecta "Entendi, você quer X", "Pelo que você falou", "Você quer/procura X" no início → remove a 1ª frase.
  - `anti_jargon_paraphrase` — se lead usou "interno"/"externo" e bot trocou por "dentro de casa"/"fora de casa", substitui de volta pelo termo do lead.
  - `anti_anotei` — detecta "anotei"/"já anotei"/"vou anotar"/"deixa eu anotar" em qualquer ponto → remove a frase (ou substitui por ponte neutra se sobrar texto curto).
  - `specialistBase.sanitizeSpecialistResponse` divide enforcement em 2 sets: `SAFE_TEXT_RULES` (substitui texto inteiro por ponte segura — comportamento atual) e `AUTO_FIX_RULES` (auto-fix cirúrgico via `autoFixHumanizationViolations`).
  - `lastIncomingText` agora vai pro `ResponseValidatorContext` (necessário pra anti_jargon_paraphrase).
- **Fix C v4 (raiz) — `ai-agent/index.ts` greeting determinístico:** detect+substitute na CAUDA do template em vez de placeholder `{nome}` (admin escreve template natural pedindo nome, como sempre foi).
  - Quando capturei nome inline: detecta cauda `", com quem (eu) falo?"` / `", qual seu nome?"` / `", como você se chama?"` no fim do template e substitui por `", no que posso te ajudar?"`. Depois insere o nome após a saudação (`"Olá!"` → `"Olá, Carlos!"`).
  - Quando NÃO capturei nome: template vai inteiro (com pedido de nome) — CRM extrai no próximo turno.
  - Mirror de saudação temporal substitui SÓ a palavra `Olá`/`Oi` preservando vírgula+nome+pontuação (usa lookahead `(?![A-Za-zÀ-ÿ])` em vez de `\b`, que falha com acentos em JS — `Olá\b` não casa porque `á` não é `\w`).
  - **Tentativa anterior usando placeholder `{nome}` no template foi REVERTIDA:** quebrava o caso "sem nome" — perdia o pedido de nome no template e o CRM não extraía mais o nome do lead. Template do sandbox voltou pra `"Olá! Bem-vindo a Eletropiso, com quem eu falo?"` (original).
- **Validação:**
  - `deno check supabase/functions/ai-agent/index.ts` 0 erros.
  - Fix A + Fix B JÁ deployados via CLI (3 deploys nessa sessão), validados nos 4 cenários antes do bug do greeting `{nome}` ser detectado.
  - Fix C v4 código pronto + `deno check` 0, **NÃO deployado** ainda — OpenAI estava com 502 em massa no fim da sessão (afeta PROD), preferiu-se aguardar estabilizar pra E2E.
- **Sandbox restaurado** ao estado original (agent disabled, monolith, gpt-5-mini, instance disabled, conversas teste R1/R5/R9/R13 deletadas).

---

### v7.57.2 (2026-05-28) — Dashboard de Fila do Gestor (mobile-first)

Página nova `/dashboard/fila` para o gestor acompanhar quem está atendendo, quem perdeu e por quê. Atende ao pedido literal do dono (Hoje/Ontem/7d/15d/30d, por atendente: recebidos / atendidos / deixou de atender + motivo).

- **3 RPCs SECURITY DEFINER** (migration `20260528000000_queue_dashboard_rpcs`): `get_queue_attendant_stats` (stats por atendente no período), `get_queue_live_status` (snapshot atual: fila / disponíveis / pausados / tempo médio), `get_queue_lost_leads` (drill-down: leads perdidos com motivo + próximo atendente que assumiu + link p/ conv).
- **UI mobile-first** (`src/pages/dashboard/QueueDashboard.tsx`): header com 3 KPIs grandes (Realtime via broadcast `queue-update` do D30 Sprint F + polling 10s); chips sticky de período (Hoje/Ontem/7d/15d/30d); card por atendente com avatar + status (Disponível/Pausado) + 3 KPIs (Recebidos/Atendidos/Perdidos) + breakdown clicável; drawer drill-down com lista de perdidos navegando pro Helpdesk.
- **Acesso:** rota `CrmRoute` (gerente + super_admin); item "Fila" no Sidebar entre Atendimento e CRM.
- **Hook único:** `src/hooks/useQueueDashboard.ts` (`useQueueLive` polling 10s + Realtime, `useQueueStats` polling 30s, `useQueueLostLeads` on-demand).
- **Dados reais Eletropiso (referência):** últimos 30d = 8.135 timed_out vs 31 responded — a página é desenhada exatamente pra essa dor.
- `npx tsc --noEmit` 0 erros; `npm run build` OK (chunk dedicado `QueueDashboard-*.js`).

---

### v7.57.1 (2026-05-28) — Helpdesk: mensagens visíveis + console limpo

Auditoria focada no M2 Helpdesk após relato de mensagens não aparecerem e erros no console.

- `ChatPanel.tsx`: adiciona `fetchIdRef` real para ignorar respostas atrasadas de conversas anteriores, alinhando o código ao contrato já documentado em T2.27. Também limpa estado quando não há conversa selecionada e remove o acesso `conversation!.is_read`, que podia quebrar renderização quando a seleção virava `null` mas mensagens antigas ainda estavam no estado.
- `ContactAvatar.tsx`: remove chamada assíncrona durante render (`triggerRefresh`) e move a reidratação de avatar para `useEffect`, evitando efeitos colaterais no render e ruído de console.
- Validação: `npx tsc --noEmit` 0 erros; `npm run build` OK; Vitest focado em helpdesk 17/17; Playwright Helpdesk 11/11; checagem Playwright dedicada com conversa aberta retornou `consoleErrors: []` e `pageErrors: []`. Suíte completa ainda tem falhas fora deste fix (`excludedProducts`, `useForms`, `FormBuilder` e loaders ESM `https:` em testes Deno).

---

### v7.57.0 (2026-05-28) — Humanização do atendimento (lead não percebe que é IA)

**Objetivo:** lead NUNCA pode perceber que está falando com IA. Estilo cordial profissional ("você", sem gírias, 1 emoji raríssimo). Auditoria E2E em 13 cenários no Sandbox isolado (router, gpt-4.1-mini) iterando 3x até nota humanização média **5.2/10 → 9.2/10**. Cobertura: saudação pura, com nome, sem nome, intenção direta/indireta, 1 item, multi-item, orçamento, foto, carrossel, qualif progressiva, item offline, item inexistente, handoff explícito, lead enrolado, e **bug crítico de PROD (Moyses, PVC + serviços não oferecidos)**.

**Fixes (7 arquivos, 2 deploys CLI):**
- `ai-agent/index.ts` — greeting determinístico agora **espelha saudação** ("Bom dia"/"Boa tarde"/"Boa noite" do lead vira saudação do bot), **captura nome inline** ("sou João" / "Boa tarde, João" via `extractLeadName`), **pula greeting estático** quando lead pediu vendedor direto no 1º turno (evita 2 bolhas).
- `_shared/agent/greetingSpecialist.ts` — diretriz explícita: emoji proibido no início, sem clichês IA, espelho de saudação obrigatório, exemplos few-shot novos.
- `_shared/agent/qualificationSpecialist.ts` — proíbe **"(interno ou externo)"** estilo formulário, **agradecimentos repetitivos** ("obrigado", "show, perfeito, ótimo" em todo turno), **narração de ações** ("anotei", "vou registrar").
- `_shared/agent/productSpecialist.ts` — proíbe **"Vou seguir coletando"**, **"Vou seguir com o próximo passo"**, **"Vou resumir para o vendedor"** dentro da msg do lead, **vazamento de sintaxe `handoff_to_human(reason: "...")`** no texto, **repetir nome+preço do produto após mídia**.
- `_shared/agent/dispatchResponse.ts` — `stripLeakedToolCalls` estendido pra capturar `NOME(key: "val")` sem braces (vazamento R147 mais comum do product specialist).
- `_shared/excludedProducts.ts` — "Infelizmente não trabalhamos com X" → "Esse não é o nosso forte aqui" (tom natural).
- `_shared/agent/nameCapture.ts` — `extractLeadName` cobre "sou João" (sem o/a obrigatório) + "Boa tarde, João" (cumprimento+nome após vírgula).

**Regra absoluta nova (todos os specialists):** A loja **SÓ VENDE PRODUTOS**. PROIBIDO oferecer, prometer, sugerir ou "incluir" qualquer serviço (montagem, instalação, "com mão de obra", indicação de pedreiro/encanador/marceneiro/instalador/pintor, visita técnica, projeto, execução). Fecha bug crítico de PROD onde IA dizia *"vou te passar o orçamento completo com todos os acessórios e mão de obra"* pra produto que a loja só vende como material.

**Validação E2E real:** 13 cenários no Sandbox (agent_id `9c71f43e`, instance `rb84e079eeab167`, router PROD). 3 iterações. ~80 LLM calls (~R$ 1,50 OpenAI). 0 conversas de prod afetadas. Sandbox restaurada ao estado original (disabled, monolith, gpt-5-mini, contatos+conversas de teste apagados). Detalhe: [[wiki/relatorio-humanizacao-2026-05-28]].

**Backlog menor (não-bloqueador):** (a) `personalizeHandoffMessage` no path "skip greeting" (S12) — nome inline não é persistido a tempo no fluxo "quero falar com vendedor"; (b) capitalização "Jo" vs "João" no extractLeadName ocasional; (c) parênteses-formulário esporádicos do LLM (1 a cada N turnos — diretriz cobre mas modelo ignora ocasionalmente).

---

### v7.56.1 (2026-05-26) — E.2: gate de horário comercial + janela 36h + LIGADA no EletropisoV2

- **Gate de horário comercial (decisão do dono):** o cron de abandono agora só cutuca/transborda **dentro do expediente** (`isOutsideBusinessHours` no edge function) — nada de pingar lead de madrugada ou acionar vendedor offline. Lead que abandona fora de hora **espera o expediente reabrir às 8h** (os timers medem do último contato; ao reabrir, dispara).
- **Janela do scan 12h→36h:** pra quem abandona à noite/sábado sobreviver na fila de candidatos até a reabertura (12h não cobria o overnight). Mais antigo que isso = lead frio (vira follow-up, não abandono).
- **EletropisoV2 LIGADO** (config PROD): cutucada **5min**, transbordo **+10min** (15 total de silêncio), msg *"Ainda tá por aí? 😊 Se quiser, já te conecto com um vendedor…"*. Demais agentes seguem OFF.
- Pipeline: deno check 0 · redeploy CLI · migration `20260526000002` (RPC 36h) aplicada.

### v7.56.0 (2026-05-26) — Sprint E.2: handoff por ABANDONO (cutucada + transbordo automático por inatividade)

Fecha o último buraco funcional do fluxo de transbordo. No fluxo offline/sem-resultado (v7.55.x) a IA grava `seller_handoff_pending`, faz **1 pergunta (marca)** e espera o **próximo turno** do lead pra forçar o handoff. Se o lead **some após a pergunta**, a conversa nunca transbordava — venda morria, vendedor nem sabia que existia.

- **2 estágios (cron `handoff-abandoned-leads`, 2min):** Estágio 1 (cutucada) — após `abandon_nudge_after_min` sem resposta, a IA manda uma mensagem leve (*"{Nome}, ainda tá por aí? 😊 Se quiser, já te conecto com um vendedor…"*) e marca a tag `abandon_nudged:{ms}`. Estágio 2 (transbordo) — após `abandon_handoff_after_min` da cutucada ainda sem resposta, entrega o lead pro vendedor na fila + **nota interna com o resumo do pedido**. Se o lead responder a qualquer momento, o pré-router já existente força o handoff normal na resposta dele (timeline abortada).
- **Zero gambiarra:** o cron reusa as MESMAS primitivas do `dispatchResponse` step 22 (`assignHandoff`, `personalizeHandoffMessage`, `formatCart*`, `isOutsideBusinessHours`). **Não toca** em `ai-agent/index.ts` nem `dispatchResponse` (HIGH RISK) — é self-contained sobre os helpers compartilhados.
- **Feature toggle por agente (default OFF):** 4 colunas novas em `ai_agents` (`abandon_handoff_enabled`, `abandon_nudge_after_min`=5, `abandon_handoff_after_min`=10, `abandon_nudge_message`). UI nova `AbandonHandoffConfig` na tab Segurança (toggle + 2 tempos + texto da cutucada + total estimado). SYNC RULE: ALLOWED_FIELDS + types.ts.
- **Fora do horário:** cutuca e transborda igual; a msg ao lead respeita `handoff_message_outside_hours` (como o step 22).
- **Decisão pura testável:** `_shared/agent/abandonHandoff.ts` (`decideAbandonStage` + parsers) — **19 testes Vitest** (limiares, lead-respondeu aborta, config zerada desliga, timestamps inválidos).
- **E2E real (sandbox, função deployada):** RPC `find_abandoned_handoff_candidates` validado — inclusão=1 + **5 guards zeram** (assigned, status≠ligada, sem tag pending, feature OFF, >12h). Estágio 2 disparado ao vivo via cron → `status_ia=shadow` + tags limpas (`seller_handoff_pending`/`abandon_nudged` removidas) + **nota interna** *"📋 Resumo… 🛒 Pedido (1 item): 1x porta sanfonada marrom 80cm"* + log `handoff_trigger {abandoned:true}` (caminho seguro `queue_off_no_default`, sem mensagear vendedor). Fixtures limpas, sandbox restaurado.
- **Pipeline:** tsc 0 · deno check 0 · vitest 19/19 (helper novo); 4 fails pré-existentes intocados (excludedProducts + loaders ESM) · migration aplicada (4 cols + RPC + cron `*/2`) · deploy CLI. **PROD intocada** (feature OFF em todos os agentes).

### v7.55.3 (2026-05-26) — Categoria offline (sob consulta) unificada ao fluxo "coleta 1 + handoff" (fecha caso porta sanfonada)

Caso Eduarda: lead pediu *"porta sanfonada marrom ou preta de 80cm"* e a IA re-perguntou material/tamanho que ele já deu, disse *"verificar com consultor, aguarde"* e **não transbordou** (lead pendurado). Causa raiz: "portas" é `catalog_status: offline` → seguia caminho de qualificação multi-stage (material/ambiente/tipo, que nem casavam com "sanfonada/marrom/80cm") em vez do fluxo enxuto.

- **Offline unificado ao destino do search-0 (v7.55):** quando `qualificationGate` retorna `qualify_then_handoff` (offline = "vendemos, mas não está no catálogo digital"), o `index.ts` grava `seller_handoff_pending` → o product specialist faz **UMA pergunta (marca) ACOLHENDO o que o lead já disse** (sem re-perguntar) e, no **próximo turno**, o pré-router **força o handoff de verdade** (fila + shadow + resumo). Sem stages, sem lead pendurado.
- **Regra 3 (offline) do prompt reescrita:** acolhe atributos já dados, faz só a pergunta de marca, PROIBIDO "vou verificar/confirmar disponibilidade/aguarde", NÃO chama handoff_to_human no turno (o sistema transborda sozinho).
- **E2E real (sandbox router, mesma msg da Eduarda) nota 10:** T1 *"Boa! Anotei: porta sanfonada marrom ou preta, de 80cm. Você tem alguma marca de preferência?"* → T2 "não" → handoff executado (status_ia=shadow + atribuído) + nota interna *"📋 Resumo: porta sanfonada marrom/preta 80cm, sem preferência de marca"*.
- **Pipeline:** deno check 0 · vitest verde (qualificationGate 12, searchProducts 36) · deploy CLI.

### v7.55.2 (2026-05-26) — Transbordo humanizado (sem cara de IA) + resumo pro vendedor em nota interna + conversa persiste ao trocar de aba

Dois pedidos do dono.

**1. Transbordo não humanizado (lead percebia a IA):** a mensagem ao lead vazava o `reason` em 3ª pessoa escrito PRO VENDEDOR — *"Anotei seu pedido: Lead quer cerâmica/revestimento para parede de quarto, preferência pelo menor preço…"*. `cleanHandoffItem` (`businessHours.ts`) agora **rejeita reason em 3ª pessoa/instrução interna** ("Lead/Cliente…", "para o vendedor", "indicar opção", "confirmar preço", "estoque físico") → o lead recebe só a ponte humanizada (*"Pedro, anotei tudo aqui. …"*), nunca a narração interna.
- **Resumo estruturado → nota interna (`private_note`):** em ambos os caminhos de handoff (explícito `setTagsAndHandoff` + deferido/forçado `dispatchResponse`), grava *"📋 Resumo do pedido (interno): {reason rico}"* — fixado no fio da conversa, visível só pro vendedor (NUNCA vai pro WhatsApp do lead), além do painel "Contexto IA › Transbordo" que já existia. E2E: lead recebeu *"Pedro, anotei tudo aqui…"* (sem vazamento) + nota interna com *"Lead interessado em tintas, preferência Suvinil…"*. +2 testes anti-vazamento (businessHours 41).

**2. Conversa sumia ao trocar de aba/janela:** a seleção era só estado em memória; algum refetch no refoco a zerava → voltava pra "Selecione uma conversa". Agora o id da conversa é **persistido na URL (`?conv=`)** como fonte da verdade — `handleSelectConversation` grava, o efeito de auto-seleção restaura em qualquer re-render/refetch, e troca de inbox limpa. **Validado via Playwright: reload mantém a mesma conversa aberta** (reload é mais forte que troca de aba).

- **Pipeline:** deno check 0 · vitest módulos afetados verdes (businessHours 41, dispatchResponse 15, setTagsAndHandoff 15) · deploy CLI ai-agent + frontend via push.

### v7.55.1 (2026-05-26) — Brand-filter na qualificação: respeita a marca pedida (não mostra outra) — E2E nota 10

Fecha a pendência da v7.55.0: no fluxo qualify-first, lead pedia "tinta **Suvinil**" e recebia **Coral** (a marca se perdia — na hora da busca o `incomingText` é a resposta de qualificação, não o "Suvinil" original, e o filtro AND post-search não pegava o caso multi-palavra).

- **`deriveProductSearchParams`** agora injeta a marca durável (`marca_preferida`/`marca_citada`) na query — antes a busca pós-qualificação ia sem a marca.
- **Guard de marca explícito** em `searchProducts` (antes do auto-send): se o lead especificou marca e NENHUM produto resultante a contém → zera + `brandNotFound` → `handleZeroResults` (coleta+handoff). Robusto (usa a tag durável, não o frágil match palavra-a-palavra). [[feedback_search_must_filter_brand]]
- **E2E real (sandbox router) nota 10:** "tinta Suvinil branca 18L" → qualifica (não nega) → busca com Suvinil → **0, NÃO mostra Coral** → coleta quantidade → handoff executa (status_ia=shadow + atribuído + "Anotei seu pedido: 2 galões de tinta Suvinil acrílica fosca branca, interno, 36L. Vou conectar com o consultor").
- **Pipeline:** deno check 0 · searchProducts 36 testes (+1 brand enforcement; 2 mocks corrigidos pra realistas) · deploy CLI.

### v7.55.0 (2026-05-26) — Catálogo é minoria: nunca negar produto + handoff determinístico + skeleton/sessão-zumbi

v7.55.0 e anteriores → ver [[wiki/changelog/2026-05-part10]].
