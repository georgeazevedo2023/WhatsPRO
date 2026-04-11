---
title: Funis — Documentacao Detalhada de Todas as Sub-Funcionalidades
tags: [funis, wizard, automacao, agentico, perfis, metricas, detalhado]
sources: [src/pages/dashboard/FunnelWizard.tsx, src/pages/dashboard/FunnelDetail.tsx, src/hooks/useCreateFunnel.ts]
updated: 2026-04-10
---

# Funis — Orquestrador Completo de Vendas (13 Sub-Funcionalidades)

> O Funil e o **maestro** que orquestra todos os outros modulos. Em vez de configurar campanha, bio link, formulario e kanban separadamente, voce cria um funil e ele **monta tudo automaticamente em 1 clique**: gera o link da campanha, cria a pagina de links, configura o formulario, cria o quadro kanban com as colunas certas, e conecta tudo.
>
> Pense assim: voce quer fazer um sorteio para captar leads. Sem funil, teria que: (1) criar campanha UTM, (2) criar Bio Link com botao de formulario, (3) criar formulario com campos nome/CPF, (4) criar board Kanban com colunas Inscrito→Confirmado→Sorteado, (5) configurar IA para esse contexto. Com funil, voce escolhe "Sorteio" no wizard e **tudo isso e criado em 30 segundos**.
>
> Alem de orquestrar, o funil tem seu proprio **motor de automacao** (gatilho → condicao → acao) e **instruçoes para a IA** especificas por contexto (perfis de atendimento).
>
> Ver tambem: [[wiki/casos-de-uso/campanhas-detalhado]], [[wiki/casos-de-uso/bio-link-detalhado]], [[wiki/casos-de-uso/formularios-detalhado]], [[wiki/casos-de-uso/crm-kanban-detalhado]], [[wiki/casos-de-uso/ai-agent-detalhado]]

---

## 10.1 Wizard de Criacao (4 Passos → Tudo Pronto)

**O que e:** Um assistente de 4 passos que cria todos os recursos necessarios automaticamente.

**Passo 1 — Tipo:** Escolhe entre 7 tipos de funil (ver secao 10.2)

**Passo 2 — Detalhes:** Nome do funil, instancia WhatsApp, descricao

**Passo 3 — Canais:** Confirma quais canais quer (campanha, bio link, formulario — pre-selecionados pelo tipo)

**Passo 4 — Resumo:** Revisao de tudo que sera criado. Botao "Criar Funil".

**O que o wizard cria automaticamente:**
1. **Board Kanban** com colunas pre-definidas pelo tipo (ex: Sorteio → Inscrito, Confirmado, Sorteado, Entregue)
2. **Formulario WhatsApp** com campos do template do tipo (ex: Sorteio → nome, telefone, CPF, aceite)
3. **Bio Link** com template visual + botoes (WhatsApp + Formulario)
4. **Campanha UTM** com instrucoes IA do tipo + link rastreavel
5. **Registro do Funil** orquestrando todos os 4 recursos acima

**Tela de sucesso:** Mostra o link da campanha, slug do Bio Link, e trigger do formulario — prontos para usar.

**Cenario real:** Gerente escolhe "Vaga de Emprego" → digita "Vaga Motorista" → wizard cria: Board com colunas Candidato→Entrevista→Avaliacao→Aprovado, formulario com nome/email/cargo/experiencia/portfolio, Bio Link com botao de candidatura, campanha UTM pro LinkedIn. Em 30 segundos, processo seletivo inteiro configurado.

> **Tecnico:** Pagina `FunnelWizard.tsx` (513 linhas, rota /dashboard/funnels/new). Hook `useCreateFunnelWizard()` de `useCreateFunnel.ts` (290 linhas). Sequencia: INSERT kanban_boards → kanban_columns (FUNNEL_KANBAN_COLUMNS) → whatsapp_forms + form_fields (FUNNEL_FORM_TEMPLATE) → bio_pages + bio_buttons (FUNNEL_BIO_DEFAULTS) → utm_campaigns (FUNNEL_CAMPAIGN_DEFAULTS + ai_template) → funnels (com FKs para todos). Templates em `src/data/funnelTemplates.ts`. Slug: `generateFunnelSlug(name)` — kebab-case + 4-char timestamp suffix.

---

## 10.2 Os 7 Tipos de Funil

**O que e:** Cada tipo define as colunas do Kanban, os campos do formulario, e as instrucoes da IA.

| Tipo | Colunas Kanban | Formulario | Uso |
|------|---------------|------------|-----|
| **Sorteio** | Inscrito → Confirmado → Sorteado → Entregue | Nome, telefone, CPF, aceite | Captacao massiva |
| **Captacao** | Novo → Qualificado → Em Contato | Nome, email, interesse | Gerar leads |
| **Venda** | Novo → Interesse → Proposta → Negociacao → Fechado | Orcamento completo | Pipeline vendas |
| **Vaga** | Candidato → Entrevista → Avaliacao → Aprovado | Nome, email, cargo, experiencia | Processo seletivo |
| **Lancamento** | Interessado → Lista VIP → Pre-venda → Comprou | Nome, email, interesse | Lancamento produto |
| **Evento** | Inscrito → Confirmado → Presente → Follow-up | Nome, email, empresa, cargo | Inscricao evento |
| **Atendimento** | Triagem → Em Atendimento → Resolvido | Tipo problema, descricao, urgencia | Suporte tecnico |

Cada tipo tambem define: template de campanha (instrucoes IA), defaults do Bio Link, e template de formulario.

> **Tecnico:** Enum `FunnelType` em `src/types/funnels.ts`. `FUNNEL_TYPE_CONFIGS` com: label, icon (lucide), description, color, needsCampaign/Bio/Form booleans, kanbanColumns[], defaultAiTemplate. Templates: `FUNNEL_KANBAN_COLUMNS` (colunas + cores por tipo), `FUNNEL_BIO_DEFAULTS` (template visual + capture fields + botoes), `FUNNEL_CAMPAIGN_DEFAULTS` (campaign_type + utm params), `FUNNEL_FORM_TEMPLATE` (mapping tipo→template_type).

---

## 10.3 Pagina de Funis (Lista + KPIs)

**O que e:** Dashboard com todos os funis, KPIs resumidos e acoes.

**KPIs no topo:**
- Funis ativos
- Total de leads (todos os funis)
- Total de funis criados

**Lista de funis:** Cards com nome, tipo (icone + cor), status (ativo/pausado), leads count, conversao %. Acoes: ver detalhes, pausar/ativar, excluir.

**Busca e filtro:** Por nome e tipo.

**Importar existente:** Dialog que permite vincular campanhas, bio links, formularios e boards ja existentes a um novo funil (sem auto-criacao).

> **Tecnico:** Pagina `FunnelsPage.tsx`. Hooks: `useFunnelsList()` (JOIN campaigns/bio/forms para nomes), `useFunnelKPIs()` (counts agregados). Dialog `ImportExistingDialog.tsx` (312 linhas — carrega resources por instancia, submit cria funnel com FKs opcionais). Toggle status: `useUpdateFunnel({ status })`. Delete: `useDeleteFunnel()`.

---

## 10.4 Detalhe do Funil (KPIs + Kanban + 5 Tabs)

**O que e:** Pagina completa de um funil com metricas, visualizacao Kanban e 5 abas de configuracao.

**KPIs (topo):**
- Leads (total no funil)
- Conversas (conversas com tag funil:SLUG)
- Visitas (campanha UTM)
- Conversao % (leads ÷ visitas)

**Kanban Visual:** Barra horizontal mostrando distribuicao de leads por etapa (ex: 40% Novo, 30% Proposta, 20% Negociacao, 10% Fechado) com legenda colorida.

**5 abas:**

### Tab 1 — Canais
Mostra metricas de cada canal do funil:
- **Campanha UTM:** visitas, conversoes, taxa, link copiavel
- **Bio Link:** visualizacoes, cliques, leads, CTR, link copiavel
- **Formulario:** submissoes (total + hoje), trigger FORM:slug copiavel

### Tab 2 — Formulario
Submissoes do formulario com contagem (total + hoje) e trigger FORM:slug para copiar.

### Tab 3 — Automacoes (Motor M17 F1)
Lista de regras de automacao: gatilho → condicao → acao. CRUD visual com dialog editor. Ver secao 10.6.

### Tab 4 — Agente IA (Funis Agenticos M17 F2+F3)
- **Perfil de atendimento:** dropdown para selecionar perfil (Agent Profile)
- **Prompt do funil:** textarea com instrucoes especificas
- **Regra de handoff:** so se pedir / apos N msgs / nunca
- **Max mensagens:** limite antes de handoff automatico
Ver secao 10.7.

### Tab 5 — Configuracao
Metadados: tipo, status, template, configuracao de handoff.

> **Tecnico:** Pagina `FunnelDetail.tsx` (~600 linhas). Hooks: `useFunnel(id)`, `useFunnelMetrics(funnel)` (167 linhas — campaignVisits/conversions, bioViews/clicks/leads, formSubmissions, totalLeads via tag, kanbanStages distribution). KPI Kanban: barra horizontal com cores das colunas + legenda. Tab Automacoes: `useAutomationRules(funnelId)` + `AutomationRuleEditor.tsx`. Tab IA: `useAgentProfilesByInstance()` + `useUpdateFunnel()` para salvar funnel_prompt/handoff_rule/profile_id.

---

## 10.5 Tag funil:SLUG (Propagacao Automatica)

**O que e:** Quando um lead entra num funil (por qualquer canal), a conversa recebe automaticamente a tag `funil:SLUG`. Essa tag e o elo que conecta tudo.

**Onde a tag e aplicada:**
- **form-public:** lead submete formulario da campanha/bio → tag aplicada
- **bio-public:** lead e captado pelo Bio Link → tag aplicada
- **whatsapp-webhook:** lead chega pela campanha UTM → tag aplicada

**Para que serve:**
- IA detecta e injeta `<funnel_context>` no prompt
- Metricas do funil contam leads pela tag
- LeadFunnelCard mostra qual funil o lead esta
- Dashboard filtra por funil

> **Tecnico:** Tag formato `funil:SLUG` em conversations.tags TEXT[]. Aplicada em 3 edge functions: form-public (via mergeTags), bio-public (action=capture, lookup funnel by bio_page_id), whatsapp-webhook (match campanha→funnel). Contagem: `useFunnelMetrics` usa `.contains('tags', ['funil:${slug}'])`. RPC `get_funnel_lead_count(slug)` conta contacts distintos.

---

## 10.6 Motor de Automacao (M17 F1)

**O que e:** Sistema de regras "SE acontecer X → ENTAO fazer Y" dentro de cada funil. Funciona sem IA — e puramente logico, como um robozinho que segue instrucoes fixas.

**7 gatilhos (o que dispara a regra):**
1. **Card movido** — card mudou de coluna no Kanban
2. **Formulario concluido** — lead terminou de preencher
3. **Lead criado** — novo lead entrou no funil
4. **Conversa resolvida** — atendente finalizou ticket
5. **Tag adicionada** — tag especifica foi aplicada
6. **Etiqueta aplicada** — etiqueta visual foi colocada
7. **Enquete respondida** — lead votou numa enquete

**4 condicoes (filtro opcional):**
1. **Sempre** — executa em qualquer caso
2. **Tag contem** — so se lead tem tag especifica
3. **Funil e** — so se lead esta no funil X
4. **Horario comercial** — so dentro/fora do expediente

**6 acoes (o que fazer):**
1. **Enviar mensagem** — texto automatico pelo WhatsApp
2. **Mover card** — mover no Kanban para coluna X
3. **Adicionar tag** — aplicar tag na conversa
4. **Ativar IA** — ligar o agente IA na conversa
5. **Transferir** — handoff para departamento/atendente
6. **Enviar enquete** — disparar enquete nativa

**Cenario real:** Funil "Venda" com regra: "Quando formulario de orcamento for concluido (gatilho) → mover card para 'Proposta' (acao 1) + enviar mensagem 'Orcamento recebido! Um consultor vai entrar em contato em breve.' (acao 2)".

> **Tecnico:** Tabela `automation_rules` (funnel_id FK, trigger_type ENUM, condition_type ENUM, action_type ENUM, trigger_config JSONB, condition_config JSONB, action_config JSONB, enabled BOOL, position INT). Engine: `_shared/automationEngine.ts` funcao `executeAutomationRules(funnel_id, trigger, data, conversation_id)`. form-bot chama apos form_completed. webhook chama apos poll_answered. Componente: `AutomationRuleEditor.tsx` (dialog com selects condicionais + config por tipo). Hooks: `useAutomationRules()`, `useCreateAutomationRule()`, `useUpdateAutomationRule()`, `useDeleteAutomationRule()`.

---

## 10.7 Funis Agenticos (M17 F2) — IA Personalizada por Funil

**O que e:** Cada funil pode ter **instrucoes especificas** para a IA e **regras de handoff** proprias. Assim, a IA se comporta diferente dependendo de qual funil o lead esta.

**Configuracao por funil:**
- **Prompt do funil** — instrucoes especificas (ex: "Este e um funil de sorteio. Confirme a inscricao e pergunte qual premio o lead prefere.")
- **Regra de handoff:**
  - "So se pedir" — IA nunca transfere por conta propria
  - "Apos N mensagens" — transfere apos X msgs sem resolver
  - "Nunca" — IA nunca transfere (resolve tudo sozinha)
- **Max mensagens** — limite antes do auto-handoff
- **Departamento** — para qual departamento transferir

**Prioridade:** Instrucoes do funil tem prioridade sobre instrucoes gerais do agente. Se o agente diz "seja formal" mas o funil diz "seja descontraido", vale "seja descontraido".

> **Tecnico:** Campos na tabela `funnels`: `funnel_prompt` TEXT, `handoff_rule` ENUM ('so_se_pedir'|'apos_n_msgs'|'nunca'), `handoff_max_messages` INT, `handoff_department_id` UUID FK. AI Agent: detecta tag funil:SLUG → carrega funnels → injeta `<funnel_instructions>` com funnel_prompt. Prioridade handoff: funnel > agent (handoff_message, department, max_messages).

---

## 10.8 Perfis de Atendimento (M17 F3) — Via Funil

**O que e:** Cada funil pode apontar para um **perfil de atendimento** (Agent Profile) — um pacote reutilizavel de comportamento da IA. Assim, varios funis podem compartilhar o mesmo perfil.

**Cenario:** Perfil "Vendedor Animado" usado pelo Funil "Venda Tintas" e pelo Funil "Venda Ferramentas". Se mudar o tom no perfil, ambos os funis mudam.

**Seletor:** No FunnelDetail tab "Agente IA", dropdown com perfis disponiveis.

> **Tecnico:** FK `funnels.profile_id` → agent_profiles.id. Hook `useAgentProfilesByInstance()` carrega perfis habilitados. Prioridade: profileData > funnelData > agent. AI Agent: se profile_id → carrega agent_profiles → injeta `<profile_instructions>` como ULTIMA secao. Se nao tem profile_id → usa funnel_prompt direto.

---

## 10.9 Metricas do Funil

**O que e:** Metricas agregadas mostrando o desempenho do funil como um todo.

**Hook `useFunnelMetrics` calcula:**
- Visitas da campanha (total + conversoes + taxa)
- Visualizacoes do Bio Link (views + clicks + leads + CTR)
- Submissoes do formulario (total + hoje)
- Total de leads (via tag funil:SLUG)
- Total de conversas
- Distribuicao por etapa Kanban (quantos em cada coluna)

**FunnelConversionChart (Dashboard):** Grafico horizontal agregado de TODOS os funis ativos: Visitas → Capturas → Leads → Conversoes.

> **Tecnico:** Hook `useFunnelMetrics.ts` (167 linhas). Queries: utm_visits (campaign_id), bio_pages (view_count), bio_buttons (sum click_count), bio_lead_captures (count), form_submissions (count + today), conversations (contains tag), kanban_cards (group by column). FunnelConversionChart: componente no DashboardHome, agrega todos os funis ativos.

---

## 10.10 LeadFunnelCard (Card no Perfil do Lead)

**O que e:** No perfil do lead, um card mostra em qual funil ele esta, em qual etapa, e ha quantos dias.

**Exibe:** Nome do funil, tipo (icone + cor), etapa atual no Kanban, dias na etapa. Link para o FunnelDetail.

> **Tecnico:** Componente `LeadFunnelCard.tsx` (111 linhas). Detecta tag `funil:SLUG` na conversa. Query funnels por slug. Kanban stage: query kanban_cards WHERE contact_id AND board_id. Dias: `(Date.now() - updated_at) / 86400000`.

---

## 10.11 OriginBadge Funil (Laranja)

**O que e:** No perfil do lead, badge laranja com nome do funil quando o lead veio por um funil.

> **Tecnico:** Componente `OriginBadge` em LeadProfileSection.tsx. Cor laranja para origem 'funil'. Detecta tag `funil:SLUG`.

---

## 10.12 Importar Recursos Existentes

**O que e:** Dialog que permite criar um funil a partir de recursos que ja existem (campanha, bio, formulario, board) sem auto-criacao.

**Cenario:** Empresa ja tem campanha "Agosto" e board "Pipeline". Cria funil e vincula ambos sem criar duplicatas.

> **Tecnico:** Componente `ImportExistingDialog.tsx` (312 linhas). Carrega campaigns, bioPages, forms, boards quando instancia selecionada. Submit: INSERT funnel com FKs opcionais (campaign_id, bio_page_id, form_id, kanban_board_id). Sem auto-criacao de sub-recursos.

---

## 10.13 Sidebar Unificada (3→1)

**O que e:** Antes do M16, a sidebar tinha 3 itens separados: Campanhas, Bio Link, Formularios. Agora tem 1 item "Funis" com sub-itens: Funis (lista), Campanhas, Bio Link, Formularios.

**Navegacao:** Funis e o item principal. Campanhas/Bio/Formularios sao sub-itens dentro de Funis.

> **Tecnico:** Sidebar: item "Funis" com sub-items (Campanhas rota /dashboard/campaigns, Bio rota /dashboard/bio, Formularios rota /dashboard/forms). Rotas antigas mantidas como sub-items. Funis: /dashboard/funnels.

---

## Arvore de Componentes

```
FunnelsPage.tsx (lista — /dashboard/funnels)
+-- KPI cards (ativos, leads, total)
+-- Busca + filtro tipo
+-- Cards de funil (nome, tipo, status, metricas)
+-- ImportExistingDialog.tsx (vincular existentes)

FunnelWizard.tsx (wizard — /dashboard/funnels/new)
+-- Passo 1: Tipo (7 opcoes)
+-- Passo 2: Detalhes (nome, instancia)
+-- Passo 3: Canais (campanha, bio, form)
+-- Passo 4: Resumo
+-- Sucesso: links + triggers prontos

FunnelDetail.tsx (detalhe — /dashboard/funnels/:id)
+-- KPIs (leads, conversas, visitas, conversao)
+-- Kanban Visual (barra horizontal + legenda)
+-- Tab Canais (metricas campanha + bio + form)
+-- Tab Formulario (submissoes + trigger)
+-- Tab Automacoes
|   +-- AutomationRuleEditor.tsx (CRUD regras)
+-- Tab Agente IA
|   +-- Select perfil (agent_profiles)
|   +-- Textarea funnel_prompt
|   +-- Select handoff_rule
|   +-- Input max_messages
+-- Tab Configuracao

LeadFunnelCard.tsx (no LeadDetail)
FunnelConversionChart.tsx (no Dashboard)
```

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `funnels` | Funis (type, status, FKs campanha/bio/form/kanban, funnel_prompt, handoff, profile_id) |
| `automation_rules` | Regras de automacao (funnel_id FK, trigger/condition/action + configs JSONB) |
| `agent_profiles` | Perfis de atendimento (prompt + handoff rules reutilizaveis) |

---

## Links Relacionados

- [[wiki/casos-de-uso/campanhas-detalhado]] — Campanhas orquestradas pelo funil
- [[wiki/casos-de-uso/bio-link-detalhado]] — Bio Links orquestrados pelo funil
- [[wiki/casos-de-uso/formularios-detalhado]] — Formularios orquestrados pelo funil
- [[wiki/casos-de-uso/crm-kanban-detalhado]] — Boards Kanban criados pelo funil
- [[wiki/casos-de-uso/ai-agent-detalhado]] — IA com contexto do funil + perfis
- [[wiki/modulos]] — Todos os 17 modulos

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico)*
