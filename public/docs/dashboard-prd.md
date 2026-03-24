# PRD — Modulo Dashboard / Analytics

## 1. Visao Geral

O modulo **Dashboard / Analytics** oferece uma visao consolidada de **metricas operacionais**, **estatisticas de instancias**, **analise de horarios comerciais** e **inteligencia de negocios** baseada em IA. E composto por duas paginas principais: o **Dashboard Home** (visao geral) e a pagina de **Inteligencia** (analise profunda com IA).

### Caracteristicas Principais
- **KPIs em tempo real**: instancias, status online/offline, grupos, leads
- **Filtros unificados**: instancia, caixa de entrada, periodo
- **Graficos interativos**: distribuicao de status, grupos/participantes por instancia, leads diarios
- **Horarios comerciais**: distribuicao horaria de mensagens recebidas com classificacao (comercial/noite/fds)
- **Motivos de contato**: extraidos de resumos IA com agrupamento inteligente via LLM
- **Metricas de Helpdesk**: tempo de resposta da IA e dos agentes por caixa
- **Inteligencia de Negocios**: analise estrategica de conversas com sentimento, produtos, objecoes e insights
- **Lazy loading**: secoes carregam sob demanda para performance otima

### Rotas
- \`/dashboard\` → \`DashboardHome.tsx\`
- \`/dashboard/intelligence\` → \`Intelligence.tsx\`

---

## 2. Dashboard Home

### 2.1 Filtros Unificados (DashboardFilters)

Barra de filtros que afeta todos os graficos e metricas da pagina.

| Filtro | Opcoes | Descricao |
|--------|--------|-----------|
| Instancia | Todas / lista de instancias (com badge On/Off) | Filtra dados por instancia especifica |
| Caixa de Entrada | Todas / lista de inboxes | Filtra dados por caixa de entrada |
| Periodo | 7, 15, 30, 60 dias | Janela temporal para graficos e metricas |

### 2.2 KPI Cards (StatsCard)

Cards compactos no topo com metricas principais.

| KPI | Icone | Descricao |
|-----|-------|-----------|
| Instancias | Server | Total de instancias ativas (nao desabilitadas) |
| Online | Wifi | Instancias com status \`connected\` ou \`online\` |
| Grupos | MessageSquare | Total de grupos em todas as instancias conectadas |
| Leads Hoje | UserPlus | Leads de helpdesk criados hoje, com total geral e trend vs ontem |

### 2.3 KPIs Secundarios (Collapsible)

Secao expansivel com metricas adicionais (progressive disclosure).

| KPI | Icone | Descricao |
|-----|-------|-----------|
| Offline | WifiOff | Instancias desconectadas |
| Participantes | UsersRound | Total de participantes em todos os grupos |
| Usuarios | Users | Total de usuarios do sistema (apenas super_admin) |

### 2.4 Graficos de Instancias (DashboardCharts)

#### Distribuicao de Status (PieChart)
- Grafico de rosca: instancias online vs offline
- Cores: verde (online), cinza (offline)
- Tooltip com contagem

#### Grupos por Instancia (BarChart horizontal)
- Top 6 instancias por quantidade de grupos
- Layout vertical com nomes truncados

#### Participantes por Instancia (BarChart horizontal)
- Top 6 instancias por quantidade de participantes
- Labels com valores formatados (pt-BR)
- Span de 2 colunas no grid

#### Leads Helpdesk — Ultimos 7 dias (AreaChart)
- Grafico de area com gradiente
- Dados diarios com labels de dia da semana
- Titulo dinamico conforme filtro de instancia

### 2.5 Horario das Conversas (BusinessHoursChart)

Analise da distribuicao horaria de mensagens recebidas no helpdesk.

#### Grafico de Barras (24 horas)
- Eixo X: horas do dia (00h-23h), timezone America/Sao_Paulo
- Cores por tipo: verde (08h-18h comercial), roxo (fora do expediente)
- Filtrado por inbox e periodo selecionados
- Dados de \`conversation_messages\` com \`direction = 'incoming'\`

#### Resumo por Periodo (PieChart + Barras de Progresso)
- Grafico de rosca com 3 categorias
- Barras de progresso com porcentagem
- Categorias:
  - **Horario Comercial** (08h-18h, dias uteis) — verde
  - **Fora do Expediente** (18h-08h, dias uteis) — roxo
  - **Fim de Semana** (sabado e domingo) — laranja

### 2.6 Motivos de Contato (TopContactReasons)

Exibe os principais motivos de contato extraidos dos resumos de IA das conversas.

- Fonte: campo \`ai_summary.reason\` das conversas
- **Normalizacao**: lowercase, trim, remocao de pontuacao final
- **Agrupamento IA** (opcional): chama Edge Function \`group-reasons\` para agrupar motivos similares
- **Visualizacao**: barras de progresso horizontais com cores alternadas
- **Tooltip**: mostra motivos originais agrupados (quando agrupado por IA)
- Badge "Agrupado por IA" quando ativo
- Filtros: instancia, inbox, periodo

### 2.7 Metricas do Helpdesk (HelpdeskMetricsCharts)

#### Tempo de Resposta da IA por Caixa (BarChart)
- Calcula tempo medio entre mensagem incoming e proxima outgoing em conversas com \`status_ia = 'ligada'\`
- Agrupado por inbox
- Formato: segundos (ex: "12s", "1min 30s")
- Ignora diferencas > 1 hora ou negativas

#### Tempo Medio de Resposta por Agente (Barras de Progresso)
- Calcula tempo medio entre primeira mensagem incoming e primeira outgoing por conversa
- Agrupado por inbox e agente (via \`assigned_to\`)
- Nomes de agentes resolvidos via \`useUserProfiles\`
- Formato: minutos/horas (ex: "15min", "1h 30min")
- Ignora diferencas > 24 horas

### 2.8 Instancias Recentes

Grid com cards das 6 instancias mais recentes, exibindo nome, status e dono (para super_admin).

### 2.9 Lazy Loading (LazySection)

Componente wrapper que carrega secoes sob demanda usando \`IntersectionObserver\`. Cada secao exibe um placeholder com altura configuravel ate se tornar visivel no viewport.

---

## 3. Pagina de Inteligencia

### 3.1 Visao Geral

Pagina dedicada a analise estrategica baseada em IA (Groq/Llama) dos resumos de conversas do helpdesk. Acessivel apenas para **super_admin**.

### 3.2 Filtros (IntelligenceFilters)

| Filtro | Opcoes | Descricao |
|--------|--------|-----------|
| Periodo | 24h, 48h, 7 dias, 30 dias, 90 dias | Janela temporal para analise |
| Caixa de Entrada | Todas / lista de inboxes | Filtra conversas por inbox |

- Exibe contagem de conversas com resumo IA disponiveis
- Botao "Gerar Analise" dispara a Edge Function
- Estado de loading com indicador visual

### 3.3 KPI Cards (IntelligenceKPICards)

4 cards com as metricas principais da analise:

| Card | Icone | Descricao |
|------|-------|-----------|
| Principal Motivo | MessageCircle | Motivo de contato mais frequente + contagem + botao "Abrir" para detalhes |
| Produto mais Citado | Package | Produto/servico mais mencionado + contagem |
| Principal Objecao | AlertCircle | Objecao/dificuldade mais citada + contagem |
| Sentimento Geral | SmilePlus/Meh/Frown | Porcentagem do sentimento dominante + total analisado |

- Cada card possui botao "Abrir" que abre dialog com conversas relacionadas

### 3.4 Graficos (IntelligenceCharts)

#### Motivos de Contato (BarChart horizontal)
- Top 5 motivos com contagem
- Layout vertical, nomes truncados a 30 caracteres
- Span de 2 colunas

#### Distribuicao de Sentimento (PieChart de rosca)
- 3 fatias: Positivo (verde), Neutro (cinza), Negativo (vermelho)
- Porcentagens que somam 100%
- Legenda com labels

#### Produtos/Servicos Citados (BarChart horizontal)
- Exibido apenas quando ha dados
- Cor azul

#### Objecoes dos Clientes (BarChart horizontal)
- Exibido apenas quando ha dados
- Cor amarela/warning

#### Insights Estrategicos
- Card destacado com fundo primario
- 2-3 frases geradas pela IA com insights acionaveis
- Indica periodo e quantidade de conversas analisadas

### 3.5 Dialog de Detalhes (ConversationDetailDialog)

Dialog que exibe as conversas especificas relacionadas a um motivo, produto, objecao ou sentimento.

- Nome do contato + link para WhatsApp
- Data/hora da conversa
- Resumo IA da conversa
- Scrollable para listas longas

---

## 4. Edge Functions

### 4.1 analyze-summaries

Analisa resumos de conversas usando Groq AI (Llama 3.3 70B com fallback para Llama 3.1 8B).

#### Autenticacao
- JWT do usuario no header Authorization
- Apenas \`super_admin\` tem permissao

#### Request
\`\`\`json
{
  "inbox_id": "uuid | null",
  "period_days": 30
}
\`\`\`

#### Processamento
1. Busca conversas com \`ai_summary\` no periodo (limite: 100)
2. Busca dados de contato para enriquecer resposta
3. Monta prompt com resumos formatados (motivo, resumo, resolucao)
4. Envia para Groq AI com retry (3 tentativas + fallback de modelo)
5. Parseia JSON da resposta, enriquece com \`conversation_ids\`
6. Retorna analise completa

#### Response
\`\`\`json
{
  "total_analyzed": 45,
  "top_reasons": [
    { "reason": "Duvida sobre prazo de entrega", "count": 12, "conversation_ids": ["uuid1", "uuid2"] }
  ],
  "top_products": [
    { "product": "Plano Premium", "count": 8, "conversation_ids": ["uuid3"] }
  ],
  "top_objections": [
    { "objection": "Preco alto comparado a concorrencia", "count": 5, "conversation_ids": ["uuid4"] }
  ],
  "sentiment": {
    "positive": 45,
    "neutral": 35,
    "negative": 20,
    "positive_ids": ["uuid5"],
    "neutral_ids": ["uuid6"],
    "negative_ids": ["uuid7"]
  },
  "key_insights": "A maioria dos contatos esta relacionada a prazos...",
  "conversations_detail": [
    {
      "id": "uuid",
      "contact_name": "Joao",
      "contact_phone": "5511999999999",
      "created_at": "2026-03-15T10:00:00Z",
      "summary": "Cliente perguntou sobre prazo de entrega..."
    }
  ]
}
\`\`\`

#### Tratamento de Erros
- **429**: Rate limit — retorna mensagem amigavel
- **402**: Creditos insuficientes — retorna mensagem amigavel
- **500**: Erro ao parsear resposta da IA
- Retry: 3 tentativas com backoff (2s, 4s) + fallback para modelo menor

### 4.2 group-reasons

Agrupa motivos de contato similares usando Groq AI (Llama 3.1 8B Instant).

#### Autenticacao
- JWT do usuario autenticado (\`verifyAuth\`)

#### Request
\`\`\`json
{
  "reasons": [
    { "reason": "problema login", "count": 5 },
    { "reason": "nao consigo entrar", "count": 3 }
  ]
}
\`\`\`

#### Response
\`\`\`json
{
  "grouped": [
    {
      "category": "Problemas de Acesso/Login",
      "count": 8,
      "original_reasons": ["problema login", "nao consigo entrar"]
    }
  ]
}
\`\`\`

#### Regras
- Se 3 ou menos motivos, retorna sem agrupamento (sem custo de IA)
- Maximo 10 categorias na resposta
- Categorias devem ser especificas e descritivas (nunca genericas)
- Fallback: retorna motivos originais se IA falhar

---

## 5. Modelo de Dados Consumido

O modulo Dashboard nao possui tabelas proprias. Consome dados de:

| Tabela | Uso |
|--------|-----|
| instances | KPIs, filtros, cards de instancia |
| user_profiles | Contagem de usuarios, nomes de agentes |
| inboxes | Filtro de caixa de entrada |
| conversations | Resumos IA, motivos de contato, metricas de resposta |
| conversation_messages | Horarios comerciais, tempos de resposta |
| contacts | Dados de contato para detalhes de inteligencia |
| lead_database_entries | Contagem de leads helpdesk (source = 'helpdesk') |
| lead_databases | Filtro de leads por instancia |

---

## 6. Componentes de Suporte

### 6.1 StatsCard
- Card compacto para KPIs
- Props: title, value, icon, description (opcional), trend (opcional), className
- Trend: seta + porcentagem de variacao + cor (verde positivo, vermelho negativo)

### 6.2 InstanceCard
- Card de instancia individual
- Exibe: nome, status (badge colorido), avatar, dono (quando super_admin)

### 6.3 LazySection
- Wrapper com \`IntersectionObserver\`
- Renderiza placeholder com altura configuravel ate visivel
- Melhora performance evitando renderizacao de secoes fora do viewport

### 6.4 DashboardFilters
- Barra de filtros com 3 selects: instancia, inbox, periodo
- Icones nos triggers dos selects
- Badge de status online/offline nas opcoes de instancia
- Memorizado com \`memo\` para evitar re-renders

### 6.5 IntelligenceFilters
- Filtros especificos da pagina de Inteligencia
- Select de periodo (24h a 90 dias) + select de inbox
- Exibe contagem de conversas com resumo disponiveis
- Botao "Gerar Analise" com estado de loading

---

## 7. Fluxos Operacionais

### 7.1 Dashboard Home — Carregamento
\`\`\`
Pagina carrega → fetchData()
→ Busca instances (nao desabilitadas)
→ Se super_admin: conta user_profiles
→ Para cada instancia conectada: chama uazapi-proxy (action: groups) com timeout 15s
→ Calcula totais: grupos, participantes
→ fetchHelpdeskLeadsStats(): conta leads por periodo
→ Realtime: subscribe em lead_database_entries (source: helpdesk)
\`\`\`

### 7.2 Inteligencia — Analise Completa
\`\`\`
Seleciona filtros (periodo + inbox)
→ Botao "Gerar Analise" → edgeFunctionFetch('analyze-summaries')
→ Edge Function:
  → Busca conversas com ai_summary no periodo
  → Busca contacts relacionados
  → Envia resumos para Groq AI (Llama 3.3 70B)
  → Parseia resposta JSON
  → Enriquece com conversation_ids
  → Retorna AnalysisResult
→ Frontend renderiza: KPI Cards + Graficos + Insights
\`\`\`

### 7.3 Motivos de Contato — Agrupamento
\`\`\`
Dashboard Home → TopContactReasons carrega
→ Busca conversations com ai_summary.reason
→ Filtra por instancia/inbox/periodo
→ Normaliza e conta motivos por inbox
→ Se > 3 motivos: chama group-reasons (IA)
→ Renderiza barras de progresso com motivos agrupados
\`\`\`

---

## 8. Tecnologias e Bibliotecas

| Biblioteca | Uso |
|-----------|-----|
| Recharts | PieChart, BarChart, AreaChart com containers responsivos |
| TanStack React Query | Queries para inboxes, contagem de resumos, logs |
| date-fns | Formatacao de datas, calculo de periodos |
| Groq AI (Llama 3.3 70B) | Analise de sentimento, motivos, produtos, objecoes |
| Groq AI (Llama 3.1 8B) | Agrupamento de motivos de contato |
| Supabase Realtime | Atualizacao em tempo real de leads helpdesk |
| IntersectionObserver | Lazy loading de secoes pesadas |

---

## 9. Permissoes

| Funcionalidade | super_admin | gerente | user |
|----------------|-------------|---------|------|
| Dashboard Home | Sim (todas as instancias) | Sim (instancias com acesso) | Sim (instancias com acesso) |
| KPI Usuarios | Sim | Nao | Nao |
| Inteligencia | Sim | Nao | Nao |
| Filtros | Todas as opcoes | Instancias com acesso | Instancias com acesso |

---

## 10. Seguranca

- **RLS**: Dados filtrados pelo Supabase conforme politicas de cada tabela
- **Autenticacao**: JWT obrigatorio em todas as operacoes
- **analyze-summaries**: restrito a \`super_admin\` (verificacao server-side)
- **group-reasons**: requer usuario autenticado
- **Tokens de instancia**: nunca expostos ao frontend
- **Rate limiting**: Edge Functions retornam 429 quando limite de IA excedido
- **Timeout**: chamadas para uazapi-proxy com timeout de 15 segundos