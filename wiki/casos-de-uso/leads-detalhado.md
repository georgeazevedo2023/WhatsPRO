---
title: Leads Database — Documentacao Detalhada de Todas as Sub-Funcionalidades
tags: [leads, funcionalidades, perfil, timeline, origem, crm, detalhado]
sources: [src/components/leads/, src/pages/dashboard/Leads.tsx, src/pages/dashboard/LeadDetail.tsx]
updated: 2026-04-09
---

# Leads Database — Cadastro Inteligente de Clientes (12 Sub-Funcionalidades)

> O modulo de Leads e o **cadastro de todos os contatos** que ja conversaram com a empresa pelo WhatsApp. Pense nele como uma **agenda de clientes inteligente**: nao e so nome e telefone — cada lead tem um perfil completo com tudo que a IA coletou, todos os formularios que preencheu, todas as campanhas por onde chegou, e toda a jornada desde o primeiro clique ate a ultima compra.
>
> Sem isso, cada conversa no WhatsApp e isolada. O atendente nao sabe se aquele numero ja comprou antes, se e um lead frio ou quente, de qual campanha veio, ou o que a IA ja descobriu sobre ele. O modulo de Leads centraliza **tudo sobre cada pessoa** em um unico lugar.
>
> Ver tambem: [[wiki/ai-agent]] (agente que coleta os dados), [[wiki/casos-de-uso/helpdesk-detalhado]] (onde as conversas acontecem), [[wiki/modulos]] (todos os modulos)

---

## 3.1 Pagina de Leads — Visao Geral com KPIs e Graficos

**O que e:** A pagina principal de Leads e um **painel de gestao** que mostra todos os leads da empresa com indicadores de desempenho, graficos e filtros. Imagine um painel de controle onde o gerente ve quantos leads tem, de onde vieram, o que querem, e em que estagio estao.

**KPIs exibidos no topo (numeros grandes):**
- **Total de leads** — quantos leads existem no sistema
- **Novos esta semana** — quantos chegaram nos ultimos 7 dias (com % de tendencia em relacao a semana anterior)
- **No CRM** — quantos tem card no quadro Kanban (% do total)
- **Perfil completo** — quantos tem dados preenchidos (nome, cidade, interesse)
- **Horario comercial** — quantos foram atendidos dentro do horario
- **Fora do horario** — quantos mandaram mensagem fora do expediente

**Graficos (secao expansivel):**
- **Leads por dia** — grafico de area dos ultimos 30 dias (mostra tendencia)
- **Horario comercial vs fora** — grafico de pizza
- **Leads por origem** — de onde vieram (Instagram, Google, Bio Link, etc.) — top 8
- **Leads por motivo** — o que querem (compra, suporte, orcamento, informacao)
- **Leads por interesse** — categorias de produto (tintas, ferramentas, eletrica) — top 10

**Cenarios reais:**
1. **Gerente abre segunda-feira de manha:** Ve que chegaram 45 novos leads na semana. 60% vieram do Instagram, 25% do Bio Link. 80% querem comprar, 15% querem orcamento. Sabe exatamente como direcionar a equipe.
2. **Dono da empresa:** Olha o grafico "Fora do horario" e ve que 40% dos leads mandam mensagem depois das 18h. Decide estender o horario do agente IA ate 22h.
3. **Gerente de marketing:** Filtra por origem "Google Ads" e ve que dos 30 leads que vieram, so 5 tem perfil completo. Percebe que o formulario da campanha nao esta captando dados suficientes.

> **Tecnico:** Pagina `src/pages/dashboard/Leads.tsx`. Acesso: `super_admin` e `gerente` apenas. Dados: query complexa com JOINs em `contacts` + `lead_profiles` + `conversations` (ultima conversa) + `kanban_cards` + `kanban_columns`. KPIs calculados client-side a partir do array de leads. Graficos: Recharts (AreaChart, PieChart, BarChart). Filtros: search (name/phone/tags), date range (7/14/30 dias), origin (dropdown dinamico de lead_profiles.origin), kanban stage (dropdown de kanban_columns). Instance selector: dropdown para filtrar por instancia WhatsApp. Tipo `LeadData` definido em `src/components/leads/types.ts`.

---

## 3.2 Card do Lead — Perfil Completo

**O que e:** Cada lead tem uma pagina de detalhe (como uma "ficha do cliente") com todas as informacoes organizadas em duas colunas. A coluna da esquerda mostra os dados pessoais e campos editaveis. A coluna da direita mostra o historico, o funil, a jornada e os formularios.

**Dados exibidos e editaveis:**

**Informacoes basicas (coletadas pela IA ou formulario):**
- Nome completo
- Telefone (do WhatsApp)
- Email
- CPF/Documento
- Data de nascimento
- Empresa onde trabalha
- Cargo/funcao

**Localizacao:**
- Cidade e estado
- Endereco completo (rua, numero, bairro, CEP) — campos editaveis

**Dados de comportamento (extraidos pela IA automaticamente):**
- Interesses (ex: "tintas, ferramentas")
- Motivo do contato (ex: "compra", "orcamento")
- Ticket medio (valor medio de compras, ex: R$ 450,00)
- Objecoes (ex: "achou caro, quer parcelar")
- Notas da IA (resumo do que aprendeu)
- Resumos de conversas anteriores

**Dados de rastreamento:**
- Origem (de onde veio: Instagram, Google, Bio Link, etc.)
- Data do primeiro contato
- Total de interacoes
- Data do ultimo contato
- Historico de sentimento (positivo, neutro, negativo ao longo do tempo)

**Campos personalizados (Custom Fields):**
- O admin pode configurar campos extras (ex: "Profissao", "Site", "Tamanho da obra")
- Esses campos aparecem automaticamente na ficha do lead
- Valores podem ser preenchidos manualmente ou extraidos pela IA

**Salvamento automatico:** Quando o atendente edita qualquer campo, o sistema salva automaticamente apos 1 segundo (sem precisar clicar "Salvar"). Aparece "Salvando..." e depois "Salvo".

**Cenarios reais:**
1. **Atendente abre ficha do lead:** Ve nome "Pedro Silva", cidade "Recife", interesse "tintas", ticket medio "R$ 450", objecao "quer parcelar". Ja sabe como abordar.
2. **Gerente preenche campo manual:** Adiciona endereco completo do lead para entrega. Salva automaticamente.
3. **IA extraiu dados:** Durante a conversa, a IA detectou cidade, interesse e objecao e preencheu automaticamente. O atendente so confere.

> **Tecnico:** Pagina `src/pages/dashboard/LeadDetail.tsx`. Layout 2 colunas. Auto-save: `useEffect` com debounce 1s → `supabase.from('lead_profiles').upsert({ ... }, { onConflict: 'contact_id' })`. Status: "Salvando..." / "Salvo" com timeout 2s. Tabela `lead_profiles` com ~25 campos (full_name, city, state, cpf, birth_date, email, company, role, interests TEXT[], average_ticket NUMERIC, notes TEXT, reason TEXT, origin TEXT, address JSONB, custom_fields JSONB, conversation_summaries JSONB[], sentiment_history JSONB[], metadata JSONB). FK: `contact_id` UNIQUE → `contacts.id`. Custom fields: fonte em `extractionFields` config do AI Agent (section='custom' ou defaults: email, documento, profissao, site). Componente: `LeadProfileSection.tsx` (header com avatar, badges, toggle IA).

---

## 3.3 Badge de Origem (Origin Badge)

**O que e:** Um badge colorido no perfil do lead que mostra **de onde ele veio** — como ele chegou ate a empresa. Cada canal tem uma cor diferente para identificacao rapida.

**As origens e suas cores:**
- **Verde** (Bio Link) — Lead clicou num botao do Bio Link (pagina de links estilo Linktree)
- **Azul** (Campanha) — Lead veio de um link rastreavel de campanha UTM (Instagram, Google, etc.)
- **Roxo** (Formulario) — Lead preencheu um formulario (na landing page ou no WhatsApp)
- **Laranja** (Funil) — Lead entrou via um funil de conversao configurado
- **Cinza** (Organico) — Lead chegou direto pelo WhatsApp, sem link rastreavel

**Origens manuais (selecionaveis no perfil):** Instagram, Google, Google Ads, Trafego Pago, Trafego Direto, Indicacao, WhatsApp, Outro

**Como funciona:** O badge e detectado automaticamente pelas tags da conversa do lead:
- Tag `bio_page:SLUG` → badge verde "Bio"
- Tag `campanha:NOME` → badge azul "Campanha"
- Tag `formulario:SLUG` → badge roxo "Formulario"
- Tag `funil:SLUG` → badge laranja "Funil"

**Cenario real:** Gerente olha a lista de leads e ve: 15 verdes (Bio Link), 25 azuis (Campanha Instagram), 8 roxos (Formulario landing), 5 laranjas (Funil de venda). Sabe exatamente qual canal esta trazendo mais leads.

> **Tecnico:** Componente inline em `LeadProfileSection.tsx` (linhas 40-83). Deteccao: busca tags da conversa mais recente do contato. Prioridade: bio_page > campanha > formulario > funil > origin field. Badge: `<Badge>` com classes condicionais (emerald/blue/purple/orange/gray). Origens manuais: `ORIGIN_OPTIONS` array com 8 opcoes, editavel via Select no LeadDetail. Campo: `lead_profiles.origin` TEXT.

---

## 3.4 Timeline de Jornada (Lead Journey Timeline)

**O que e:** Uma **linha do tempo visual** que mostra todos os pontos de contato do lead com a empresa, em ordem cronologica — desde o primeiro clique ate o momento atual. E como um "filme" da historia do lead com a sua empresa.

**Os 6 tipos de evento na timeline:**
1. **Bio Link** (icone de link, verde) — "Clicou no Bio Link 'Loja X'" com data e hora
2. **Campanha** (icone de megafone, azul) — "Acessou campanha 'Promo Agosto'" com status
3. **Formulario** (icone de documento, roxo) — "Preencheu formulario 'Orcamento'" com preview dos dados
4. **Conversa** (icone de chat, padrao) — "Conversa WhatsApp" com status e tags
5. **Kanban** (icone de quadro, padrao) — "Card criado no board 'Pipeline'" com coluna atual
6. **Funil** (icone de funil, laranja) — "Entrou no funil 'Captacao Agosto'" detectado via tag

**Cenario real:** O gerente abre o perfil do lead "Maria" e ve a timeline:
- 5 abr 14:30 — Clicou no Bio Link "Loja WSmart" (verde)
- 5 abr 14:32 — Preencheu formulario "Orcamento Pintura" (roxo)
- 5 abr 14:33 — Conversa WhatsApp iniciada, IA respondeu (azul)
- 5 abr 15:00 — Card criado no board "Pipeline Vendas", coluna "Novo"
- 6 abr 09:15 — Conversa com atendente humano, status: pendente
- 7 abr 11:00 — Card movido para "Proposta Enviada"
- 8 abr 16:30 — Card movido para "Fechado Ganho"

Em um olhar, o gerente ve toda a jornada de 3 dias — do primeiro clique ao fechamento da venda.

> **Tecnico:** Componente `src/components/leads/LeadJourneyTimeline.tsx`. Hook `src/hooks/useLeadJourney.ts`. Queries paralelas em 5 tabelas: `bio_lead_captures` (JOIN bio_pages), `utm_visits` (JOIN utm_campaigns), `form_submissions` (JOIN whatsapp_forms), `conversations` (contact_id, tags para detectar funil), `kanban_cards` (JOIN kanban_boards + kanban_columns). Tipo `JourneyEvent` com 6 variantes. Ordenacao cronologica unificada. Tipo `funnel_entry` detectado via tag `funil:SLUG` nas conversations. Icones e cores por tipo de evento.

---

## 3.5 Ligar/Desligar IA por Lead (Block IA)

**O que e:** Um interruptor que permite **bloquear a IA de responder** para um lead especifico, independente da conversa. Diferente do toggle de IA no Helpdesk (que e por conversa), esse e **por contato** — se bloquear, a IA nao responde em nenhuma conversa daquele numero.

**Como funciona:**
- No perfil do lead, aparece um interruptor (switch) para cada instancia WhatsApp
- Ao ativar o bloqueio, a IA para de responder aquele numero naquela instancia
- Badge "IA Bloqueada (N)" aparece no perfil (N = numero de instancias bloqueadas)
- Na lista de leads, aparece indicador visual de que a IA esta bloqueada
- O bloqueio e **por instancia** — pode bloquear numa instancia e manter ativo em outra

**Cenario real:**
1. **Lead problematico:** Cliente reclama que a IA respondeu errado. Gerente bloqueia a IA para aquele lead → so humanos respondem a partir de agora.
2. **Cliente VIP:** Dono decide que clientes acima de R$ 10.000 em compras so sao atendidos por humanos. Bloqueia a IA para esses leads.
3. **Teste:** Atendente quer testar como a IA responde para um lead especifico → desbloqueia, manda mensagem de teste, avalia, e bloqueia de novo.

> **Tecnico:** Campo `contacts.ia_blocked_instances` (TEXT[] default '{}'). Migration: `20260322175956_ia_blocked_per_instance.sql`. Toggle: add/remove instance_id do array. Handler `handleToggleBlockInstance(instId)` em LeadDetail.tsx. Mutation `toggleIaMutation` em Leads.tsx. Check no ai-agent/index.ts: se `contact.ia_blocked_instances` contem o instance_id da request, return silencioso. Badge no LeadProfileSection: conta length do array.

---

## 3.6 Limpar Contexto (Clear Context)

**O que e:** Um botao que faz um **reset total** — o lead "vira novo" para a IA. Todos os dados extraidos, resumos, tags e historico de IA sao apagados. Na proxima mensagem, a IA trata aquele lead como se fosse o primeiro contato.

**O que acontece ao clicar "Limpar Contexto":**
1. **Perfil limpo:** Resumos de conversas, interesses, notas, motivo, ticket medio — tudo zerado
2. **Tags resetadas:** Todas as tags da conversa sao substituidas por `ia_cleared:DATA_HORA` (um marcador de que o contexto foi limpo)
3. **Resumos IA apagados:** Os resumos automaticos de todas as conversas sao removidos
4. **IA reativada:** O status da IA volta para "ligada" (se estava em shadow ou desligada)
5. **Bloqueio removido:** Se a IA estava bloqueada para aquele lead, o bloqueio e removido
6. **Logs apagados:** Registros de acoes da IA (handoffs, ferramentas usadas) sao deletados

**Regra importante sobre as tags:** O sistema NUNCA deixa as tags vazias (array vazio `[]`). Sempre coloca pelo menos `ia_cleared:2026-04-09T15:30:00`. Isso porque tags vazias quebram o contador de handoff — a IA perderia a contagem de mensagens e faria handoff na hora errada.

**Cenarios reais:**
1. **Conversa ruim ha 1 mes:** Lead teve experiencia ruim, IA ficou em shadow. Admin faz Clear Context → lead manda mensagem → IA responde como se fosse novo, sem vicio.
2. **Dados errados:** IA extraiu cidade errada e interesses errados. Em vez de corrigir campo por campo, admin limpa tudo e deixa a IA reaprender na proxima conversa.
3. **Teste de qualidade:** Admin quer testar o fluxo completo como se fosse um lead novo. Limpa contexto do seu proprio numero de teste.

> **Tecnico:** Handler `handleClearContext(lead)` em Leads.tsx e LeadDetail.tsx. Mutation `clearContextMutation`. Operacoes: (1) `lead_profiles` upsert com nulls (conversation_summaries=[], interests=null, notes=null, reason=null, full_name=null, average_ticket=null), (2) conversations update: `tags=['ia_cleared:TIMESTAMP']`, `ai_summary=null`, `status_ia='ligada'`, (3) DELETE `ai_agent_logs` WHERE conversation_id IN (contact convs), (4) contacts update: `ia_blocked_instances=[]`. NUNCA tags=[] — tag ia_cleared:TIMESTAMP obrigatorio. Invalida queries React Query apos sucesso.

---

## 3.7 Importacao CSV

**O que e:** Upload de um arquivo CSV (planilha simples) ou Excel com lista de leads para cadastrar em massa. Util quando a empresa ja tem uma base de clientes em outra ferramenta e quer migrar para o WhatsPRO.

**Como funciona:**
- Arrasta o arquivo ou clica para selecionar (ate 10MB, maximo 50.000 linhas)
- O sistema detecta automaticamente o formato (virgula, ponto-e-virgula ou tabulacao)
- Identifica automaticamente as colunas de nome e telefone (busca palavras como "nome", "name", "telefone", "phone")
- Se nao encontrar automaticamente, mostra uma tela para o usuario mapear as colunas manualmente
- Valida os telefones (minimo 10 digitos)
- Protege contra formulas maliciosas em CSVs (remove caracteres como =, +, -, @ do inicio das celulas)

**Cenario real:** Loja de materiais tem planilha do Excel com 500 clientes do sistema antigo. Exporta como CSV → arrasta para o WhatsPRO → sistema detecta colunas "Nome" e "Celular" → 500 leads criados em 30 segundos → prontos para receber broadcast.

> **Tecnico:** Componente `src/components/broadcast/lead-importer/CsvTab.tsx`. Parse: delimiter auto-detect (,;⇥). Header detection: keywords array (nome, name, telefone, phone, numero, celular, whatsapp, contato, fone, tel). Phone-to-JID conversion. Limites: 10MB file size, 50k rows. CSV injection prevention: sanitize leading =, +, -, @. Output: `Lead[]` array. Drag-drop: onDragOver/onDrop handlers.

---

## 3.8 Auto-Criacao de Leads

**O que e:** Leads sao criados automaticamente — sem ninguem precisar cadastrar manualmente — quando acontece qualquer um desses eventos:

1. **Lead preenche formulario** (na landing page ou no chat WhatsApp) → sistema cria contato + perfil do lead automaticamente
2. **Lead clica no Bio Link e se cadastra** → sistema cria contato + perfil com origin='bio'
3. **Lead acessa link de campanha e manda mensagem** → sistema vincula a visita da campanha ao contato

**Mapeamento de campos do formulario para o perfil do lead:**
- Campo "nome" do formulario → nome completo do lead
- Campo "email" → email do lead
- Campo "cpf" → CPF do lead
- Campo "cidade" → cidade do lead
- Campos extras → salvos como campos personalizados

**Cenario real:** Lead ve post no Instagram → clica no link da campanha → chega na landing page → preenche formulario com nome, email e interesse → clica "Enviar" → sistema cria o contato, preenche o perfil, cria card no Kanban, marca a visita da campanha como convertida, e abre o WhatsApp. Quando o lead manda mensagem, a IA ja sabe o nome dele e o que preencheu no formulario.

> **Tecnico:** Auto-criacao em 3 edge functions: `form-public` (POST → upsert contact + lead_profile via leadHelper.ts), `bio-public` (action='capture' → upsert via leadHelper), `whatsapp-webhook` (match utm_visit quando conversa inicia). Modulo compartilhado: `_shared/leadHelper.ts` com `FORM_FIELD_MAP` (nome→full_name, email→email, cpf→cpf, cidade→city), `upsertContactFromPhone()`, `upsertLeadFromFormData()`. Campos extras → `custom_fields` JSONB. Upsert ON CONFLICT contact_id. Tags automaticas: `formulario:SLUG`, `origem:formulario`, `bio_page:SLUG`, `origem:bio`, `campanha:NOME`.

---

## 3.9 Formularios Respondidos (LeadFormsSection)

**O que e:** Uma secao no detalhe do lead que mostra **todos os formularios que aquele lead ja preencheu**, com os dados de cada um.

**O que mostra:**
- **Badge de contagem** — ex: "2 formularios" (numero total)
- **Lista de formularios** com: nome do formulario, tipo do template, data de envio
- **Preview rapido** — mostra os 2 primeiros campos preenchidos
- **Expandir** — clica para ver todos os dados coletados naquele formulario

**Cenario real:** Lead "Maria" preencheu 2 formularios: "Orcamento Pintura" (5 abr) com nome, CPF, tipo de servico, e "Pesquisa Satisfacao" (8 abr) com nota e comentario. O atendente ve tudo sem precisar procurar.

> **Tecnico:** Componente `src/components/leads/LeadFormsSection.tsx`. Query: `supabase.from('form_submissions').select('*, whatsapp_forms(name, slug, template_type)').eq('contact_id', X)`. Collapse/expand com state local. Preview: primeiros 2 entries de `data` JSONB. Expandido: todas as key-value pairs.

---

## 3.10 Card do Funil Ativo (LeadFunnelCard)

**O que e:** Um card no perfil do lead que mostra **em qual funil** o lead esta, **em qual etapa** do Kanban, e **ha quantos dias** esta naquela etapa. Funciona como um GPS do lead dentro do processo de vendas.

**O que mostra:**
- Nome do funil (ex: "Captacao Agosto")
- Tipo do funil (ex: "captacao", "venda", "vaga")
- Icone do tipo
- Estagio atual no Kanban (ex: "Proposta Enviada")
- Dias na etapa atual (ex: "3 dias")
- Link para a pagina detalhada do funil

**Cenario real:** Gerente abre perfil do lead e ve: "Funil: Venda Tintas | Etapa: Negociacao | 5 dias". Percebe que o lead esta parado na negociacao ha 5 dias — hora de ligar e fechar.

> **Tecnico:** Componente `src/components/leads/LeadFunnelCard.tsx`. Deteccao: busca tag `funil:SLUG` na conversa mais recente. Query: `supabase.from('funnels').select('*').eq('slug', X)`. Kanban stage: query `kanban_cards` WHERE contact_id AND board_id = funnel.kanban_board_id, JOIN kanban_columns. Dias: `Math.floor((Date.now() - new Date(card.updated_at)) / 86400000)`. Styling: borda laranja, icone Target.

---

## 3.11 Modal de Conversa

**O que e:** Ao clicar numa conversa na lista de historico do lead, abre uma **janela (modal)** com o chat completo — sem sair da pagina do lead. Assim o atendente pode ler a conversa inteira mantendo o perfil do lead visivel.

**O que mostra:**
- Todas as mensagens da conversa em ordem cronologica
- Direcao: mensagens do lead (icone azul), mensagens da IA/atendente (icone do sistema), notas privadas (icone amarelo em italico)
- Midia: imagens, audios (com transcricao), videos, documentos
- Data e hora de cada mensagem
- Rola automaticamente para o final ao abrir

**Cenario:** Gerente quer ver o que aconteceu na conversa de 3 dias atras. Clica na conversa na lista → modal abre → le as 30 mensagens → entende o contexto → fecha o modal → volta ao perfil do lead.

> **Tecnico:** Componente `src/components/leads/ConversationModal.tsx`. Dialog (shadcn/ui). Query: `supabase.from('conversation_messages').select('*').eq('conversation_id', X).order('created_at')`. Renderizacao por direction: incoming (User icon, blue), outgoing (Bot icon, primary), private_note (Headphones icon, yellow, italic). Media: image renderiza img, audio mostra transcription se presente. Auto-scroll: `scrollRef.current?.scrollTo({ top: 99999 })` no useEffect.

---

## 3.12 Integracao com CRM Kanban

**O que e:** Cada lead pode estar vinculado a um **card no quadro Kanban** (painel visual de vendas com colunas tipo "Novo → Proposta → Negociacao → Fechado"). Essa vinculacao acontece automaticamente ou manualmente.

**Como funciona:**
- Quando um lead e qualificado (pela IA ou pelo atendente), um card e criado no Kanban
- O card esta vinculado ao lead pelo telefone/contato (nao e uma copia — e o mesmo registro)
- A IA pode mover o card entre colunas (ferramenta `move_kanban`)
- O atendente pode mover ao finalizar atendimento (TicketResolutionDrawer)
- No perfil do lead, aparece a **etapa atual** do Kanban com a cor da coluna
- Na lista de leads, a coluna do Kanban aparece como filtro e como badge

**O que aparece no perfil do lead:**
- Nome do board (ex: "Pipeline Vendas")
- Coluna atual com cor (ex: bolinha verde + "Proposta Enviada")
- Link para abrir o board completo

**Cenarios:**
1. **IA qualifica automaticamente:** Lead respondeu 3 perguntas, mostrou interesse real → IA chama `move_kanban("Qualificado")` → card move da coluna "Novo" para "Qualificado" → gerente ve no perfil do lead e no board.
2. **Atendente finaliza venda:** Clica "Finalizar" → seleciona "Venda Fechada" → card move para "Fechado Ganho" automaticamente.
3. **Filtro no dashboard:** Gerente filtra leads com kanban_stage = "Negociacao" → ve os 12 leads que estao em negociacao → liga para cada um.

> **Tecnico:** FK: `kanban_cards.contact_id` (UUID → contacts.id). Migration: `20260322140251_s5_4_kanban_contact_id.sql`. LeadData type inclui `kanban_stage` (column name), `kanban_color` (column color), `kanban_board_id`. Query: JOIN kanban_cards → kanban_columns → kanban_boards. IA: tool `move_kanban` busca card pelo contact_id e move para coluna destino. TicketResolutionDrawer: `KANBAN_COLUMN_MAP` (VENDA→'Fechado Ganho', PERDIDO→'Perdido'). LeadDetail: secao CRM no sidebar direito. Leads.tsx: filtro por kanban stage, KPI "No CRM" = count leads with kanban_stage.

---

## Arvore de Componentes

```
Leads.tsx (pagina principal — lista + KPIs + graficos)
+-- Filtros: busca, data, origem, kanban stage
+-- KPIs: total, novos, CRM, perfil, horario
+-- Graficos: leads/dia, origem, motivo, interesses
+-- Tabela de leads (cada linha)
|   +-- Avatar + nome + telefone
|   +-- Ultima conversa
|   +-- Tags count
|   +-- IA block badge
|   +-- Kanban stage badge
|   +-- Acoes: ver, toggle IA, limpar contexto

LeadDetail.tsx (pagina de detalhe — 2 colunas)
+-- Coluna Esquerda
|   +-- LeadProfileSection.tsx
|   |   +-- Avatar + nome + telefone
|   |   +-- Badge de origem (OriginBadge)
|   |   +-- Badge "IA Bloqueada"
|   |   +-- Toggle IA por instancia
|   +-- Campos editaveis (origem, email, documento, nascimento)
|   +-- Secao Endereco (rua, numero, bairro, cidade, CEP)
|   +-- Secao Campos Adicionais (custom_fields)
+-- Coluna Direita
|   +-- Secao CRM (kanban stage + link pro board)
|   +-- LeadFormsSection.tsx (formularios respondidos)
|   +-- LeadFunnelCard.tsx (funil ativo + etapa + dias)
|   +-- LeadJourneyTimeline.tsx (timeline visual)
|   +-- Historico de conversas
|       +-- ConversationModal.tsx (modal com chat completo)
```

---

## Tabelas do Banco Envolvidas

| Tabela | O que guarda |
|--------|--------------|
| `contacts` | Registro base do contato (phone, jid, name, ia_blocked_instances) |
| `lead_profiles` | Perfil enriquecido (25+ campos — nome, cidade, interesses, ticket, etc.) |
| `conversations` | Conversas WhatsApp (tags, ai_summary, status_ia) |
| `conversation_messages` | Mensagens individuais |
| `bio_lead_captures` | Capturas via Bio Link |
| `utm_visits` | Visitas de campanhas UTM |
| `form_submissions` | Respostas de formularios |
| `kanban_cards` | Cards do CRM (contact_id FK) |
| `kanban_columns` | Colunas/etapas do Kanban |
| `kanban_boards` | Quadros do CRM |
| `funnels` | Funis de conversao |
| `ai_agent_logs` | Logs de acoes da IA |

---

## Links Relacionados

- [[wiki/ai-agent]] — Agente IA que coleta os dados dos leads automaticamente
- [[wiki/casos-de-uso/helpdesk-detalhado]] — Central de atendimento onde as conversas acontecem
- [[wiki/casos-de-uso/ai-agent-detalhado]] — 9 tools do agente (update_lead_profile, set_tags, move_kanban)
- [[wiki/modulos]] — Todos os 17 modulos
- [[wiki/banco-de-dados]] — Esquema completo do banco
- [[wiki/integracao-funis]] — Como Campanhas + Bio + Forms se conectam aos Leads

---

*Documentado em: 2026-04-09 — Sessao de documentacao detalhada com George Azevedo*
*Padrao dual: didatico (leigos) + tecnico (devs) em cada secao*
