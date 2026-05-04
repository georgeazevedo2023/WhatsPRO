---
title: Leads — Visão Geral e Perfil do Lead
tags: [leads, perfil, kpis, timeline, origem, detalhado]
sources: [src/pages/dashboard/Leads.tsx, src/pages/dashboard/LeadDetail.tsx, src/components/leads/LeadProfileSection.tsx, src/components/leads/LeadJourneyTimeline.tsx]
updated: 2026-05-04
---

# Leads — Visão Geral e Perfil (Sub-Funcionalidades 3.1 a 3.4)

> Esta sub-wiki cobre a **camada de visualização** do módulo Leads: o painel principal com KPIs, a ficha completa do lead, o badge de origem e a timeline de jornada. É a parte do sistema onde o gestor enxerga **quem é o lead, de onde veio e por onde passou**.
>
> Ver índice: [[wiki/casos-de-uso/leads-detalhado]]

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

## Links Relacionados

- [[wiki/casos-de-uso/leads-detalhado]] — Índice das 12 sub-funcionalidades
- [[wiki/casos-de-uso/leads-inteligencia-controle]] — Block IA, Clear context, funil, Kanban
- [[wiki/casos-de-uso/leads-captura-historico]] — Importação CSV, auto-criação, formulários, modal
- [[wiki/ai-agent]] — Agente IA que coleta os dados
- [[wiki/casos-de-uso/helpdesk-detalhado]] — Central de atendimento
