# PRD — Helpdesk: Filtros e Cartão de Contato

> **Módulo:** Helpdesk — Filtros & Cartão de Contato  
> **Versão:** 1.0  
> **Última atualização:** 2026-03-06  
> **Responsável:** Equipe WsmartQR  

---

## 1. Visão Geral

Este documento detalha o sistema de **filtros avançados** da lista de conversas e o **cartão de contato** (painel lateral de informações) do módulo Helpdesk. Ambos os componentes são fundamentais para a produtividade dos agentes, permitindo localizar conversas rapidamente e gerenciar dados contextuais do atendimento.

### Objetivos
- Oferecer filtros combinados e intuitivos para triagem rápida de conversas
- Exibir informações completas do contato e da conversa em painel lateral
- Suportar atribuição de agente, departamento, prioridade e etiquetas
- Integrar resumo por IA e histórico de conversas anteriores
- Garantir experiência mobile-first com UX moderna

### Rota
\`/dashboard/helpdesk\`

---

## 2. Sistema de Filtros

### 2.1 Abas de Status (Controle Segmentado)

O cabeçalho do Helpdesk exibe um controle segmentado com quatro abas de status:

| Aba | Valor interno | Ícone | Descrição |
|-----|--------------|-------|-----------|
| Atendendo | \`aberta\` | 🟢 | Conversas em atendimento ativo |
| Aguardando | \`pendente\` | 🟡 | Conversas pendentes de resposta |
| Resolvidas | \`resolvida\` | ✅ | Conversas finalizadas |
| Todas | \`todas\` | 📋 | Todas as conversas sem filtro de status |

**Comportamento:**
- Cada aba exibe um contador em tempo real com a quantidade de conversas
- O contador é atualizado automaticamente via realtime (broadcast \`new-message\`)
- A aba ativa recebe estilo \`bg-primary text-primary-foreground\` com sombra
- Em mobile, os labels das abas são ocultados, mantendo apenas ícone + contador

### 2.2 Filtros Colapsáveis

Abaixo da barra de busca, há um sistema de filtros colapsável acionado por um botão com ícone de ajuste (\`SlidersHorizontal\`).

#### Badge de Filtros Ativos
- Um badge numérico aparece sobre o botão quando há filtros ativos
- Cor: \`bg-primary text-primary-foreground\`
- Cálculo: soma de filtros não-padrão (atribuição ≠ 'todas', prioridade ≠ 'todas', label selecionada, departamento selecionado)

#### Animação
- Transição via CSS Grid: \`grid-rows-[0fr]\` → \`grid-rows-[1fr]\`
- Duração: 200ms com \`transition-all\`
- Conteúdo interno com \`overflow-hidden\`

### 2.3 Tipos de Filtro

#### 2.3.1 Filtro de Atribuição
- **Componente:** \`<Select>\` com trigger estilo chip/pill
- **Opções:**
  - \`Todas\` — Mostra todas as conversas
  - \`Minhas\` — Conversas atribuídas ao agente logado (\`assigned_to = auth.uid()\`)
  - \`Não atribuídas\` — Conversas sem agente (\`assigned_to IS NULL\`)
- **Estilo ativo:** \`bg-primary/15 border-primary/30 text-primary\`

#### 2.3.2 Filtro de Prioridade
- **Componente:** \`<Select>\` com trigger estilo chip/pill
- **Opções:**
  - \`Todas\` — Sem filtro de prioridade
  - \`🔴 Alta\` — \`priority = 'alta'\`
  - \`🟡 Média\` — \`priority = 'media'\`
  - \`🔵 Baixa\` — \`priority = 'baixa'\`
- **Estilo ativo:** \`bg-primary/15 border-primary/30 text-primary\`

#### 2.3.3 Filtro de Etiquetas (Labels)
- **Componente:** \`<Select>\` com trigger estilo chip/pill
- **Opções:** Dinâmicas — carregadas da tabela \`labels\` filtradas por \`inbox_id\`
- **Exibição:** Bolinha colorida (\`label.color\`) + nome da etiqueta
- **Filtragem:** Verifica \`conversationLabelsMap[conversation.id]\` para inclusão do label selecionado
- **Visibilidade:** Só aparece quando \`inboxLabels\` e \`onLabelFilterChange\` estão disponíveis

#### 2.3.4 Filtro de Departamento
- **Componente:** \`<Select>\` com trigger estilo chip/pill
- **Opções:** Dinâmicas — carregadas da tabela \`departments\` filtradas por inbox
- **Filtragem:** \`conversation.department_id = selectedDepartmentId\`
- **Visibilidade:** Só aparece quando \`inboxDepartments\` e \`onDepartmentFilterChange\` estão disponíveis

### 2.4 Botão Limpar Filtros
- Texto: "Limpar"
- Ação: Reseta todos os filtros para valores padrão
- Visibilidade: Só aparece quando \`hasActiveFilters === true\`
- Estilo: \`text-primary hover:text-primary/80 font-medium\`

### 2.5 Barra de Busca
- **Componente:** \`<Input>\` com ícone \`Search\` à esquerda
- **Placeholder:** "Buscar conversa..."
- **Filtragem:** Busca por nome do contato (\`contact.name\`) e telefone (\`contact.phone\`)
- **Estilo:** \`rounded-xl bg-secondary/50 border-secondary\` com foco em \`ring-primary/20\`

---

## 3. Cartão de Contato (ContactInfoPanel)

### 3.1 Estrutura Visual

O painel lateral direito exibe informações detalhadas da conversa e do contato selecionado.

#### Layout (de cima para baixo):
1. **Avatar do Contato** — Avatar circular com iniciais como fallback
2. **Nome do Contato** — \`contact.name\` ou "Sem nome"
3. **Telefone** — \`contact.phone\` com ícone de telefone
4. **Seção de Etiquetas** — Labels atribuídas à conversa
5. **Status da Conversa** — Select com opções de status
6. **Prioridade** — Select com indicadores coloridos
7. **Agente Responsável** — Select com lista de agentes da inbox
8. **Departamento** — Select com departamentos da inbox
9. **Resumo da Conversa (IA)** — Card com resumo gerado por IA
10. **Histórico de Conversas** — Timeline de conversas anteriores

### 3.2 Seção de Etiquetas

#### Componentes:
- \`<ConversationLabels>\` — Renderiza badges coloridos das labels atribuídas
- \`<LabelPicker>\` — Popover para adicionar novas labels
- \`<ManageLabelsDialog>\` — Dialog para CRUD de labels da inbox

#### Fluxo:
1. Labels são carregadas da tabela \`labels\` filtradas por \`inbox_id\`
2. Labels atribuídas vêm de \`conversation_labels\` via \`conversationLabelsMap\`
3. Ao clicar "+", abre \`LabelPicker\` com opções disponíveis
4. Ao clicar no ícone de configuração, abre \`ManageLabelsDialog\`
5. Remoção de label: clique no "x" do badge → \`DELETE FROM conversation_labels\`

#### Tabelas envolvidas:
\`\`\`sql
-- Labels da inbox
SELECT * FROM labels WHERE inbox_id = :inbox_id;

-- Labels atribuídas a uma conversa
SELECT label_id FROM conversation_labels WHERE conversation_id = :conv_id;

-- Atribuir label
INSERT INTO conversation_labels (conversation_id, label_id) VALUES (:conv_id, :label_id);

-- Remover label
DELETE FROM conversation_labels WHERE conversation_id = :conv_id AND label_id = :label_id;
\`\`\`

### 3.3 Status da Conversa

| Status | Label | Cor |
|--------|-------|-----|
| \`aberta\` | Aberta | Verde |
| \`pendente\` | Pendente | Amarelo |
| \`resolvida\` | Resolvida | Cinza |

**Atualização:**
\`\`\`sql
UPDATE conversations SET status = :new_status, updated_at = NOW() WHERE id = :conv_id;
\`\`\`

### 3.4 Prioridade

| Prioridade | Label | Indicador |
|------------|-------|-----------|
| \`alta\` | Alta | 🔴 Vermelho |
| \`media\` | Média | 🟡 Amarelo |
| \`baixa\` | Baixa | 🔵 Azul |

**Atualização:**
\`\`\`sql
UPDATE conversations SET priority = :new_priority, updated_at = NOW() WHERE id = :conv_id;
\`\`\`

### 3.5 Agente Responsável

- **Componente:** \`<Select>\` com opção "— Nenhum —"
- **Dados:** Carregados de \`inbox_users\` JOIN \`user_profiles\` filtrados por \`inbox_id\`
- **Atualização:**
\`\`\`sql
UPDATE conversations SET assigned_to = :agent_user_id, updated_at = NOW() WHERE id = :conv_id;
\`\`\`
- **Broadcast:** Envia evento \`assigned-agent\` via realtime channel \`helpdesk-realtime\`

### 3.6 Departamento

- **Componente:** \`<Select>\` com opção "— Nenhum —"
- **Dados:** Carregados de \`departments\` filtrados por \`inbox_id\` da conversa
- **Atualização:**
\`\`\`sql
UPDATE conversations SET department_id = :dept_id, updated_at = NOW() WHERE id = :conv_id;
\`\`\`

### 3.7 Resumo da Conversa (IA)

#### Funcionamento:
1. Ao abrir o painel, verifica se existe \`ai_summary\` e se não expirou (\`ai_summary_expires_at\`)
2. Botão "Gerar Resumo" ou ícone de refresh para forçar geração
3. Chama Edge Function: \`POST /functions/v1/summarize-conversation\`

#### Payload da Edge Function:
\`\`\`json
{
  "conversation_id": "uuid",
  "force_refresh": true
}
\`\`\`

#### Resposta salva em \`conversations.ai_summary\`:
\`\`\`json
{
  "reason": "Cliente solicitou informações sobre produto",
  "summary": "O cliente perguntou sobre preços e disponibilidade...",
  "resolution": "Agente forneceu tabela de preços atualizada",
  "generated_at": "2026-03-06T10:00:00Z",
  "message_count": 15
}
\`\`\`

#### Campos do card de resumo:
- **Motivo do Contato** — \`ai_summary.reason\`
- **Resumo** — \`ai_summary.summary\`
- **Resolução** — \`ai_summary.resolution\`
- **Metadados** — Data de geração + quantidade de mensagens analisadas

### 3.8 Histórico de Conversas Anteriores

#### Funcionamento:
1. Busca conversas anteriores do mesmo contato: \`SELECT * FROM conversations WHERE contact_id = :contact_id AND id != :current_conv_id ORDER BY created_at DESC\`
2. Exibe em formato timeline expandível
3. Cada item mostra: status, data, última mensagem, resumo IA (se disponível)
4. Botão para gerar resumo individual de cada conversa anterior

---

## 4. Modelo de Dados

### 4.1 Tabelas Principais

\`\`\`sql
-- Conversas
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id UUID REFERENCES inboxes(id) NOT NULL,
  contact_id UUID REFERENCES contacts(id) NOT NULL,
  status TEXT DEFAULT 'aberta', -- aberta, pendente, resolvida
  priority TEXT DEFAULT 'media', -- alta, media, baixa
  assigned_to UUID, -- user_id do agente
  department_id UUID REFERENCES departments(id),
  is_read BOOLEAN DEFAULT false,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  ai_summary JSONB,
  ai_summary_expires_at TIMESTAMPTZ,
  status_ia TEXT, -- ativada, desativada
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contatos
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jid TEXT NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  profile_pic_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Labels
CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id UUID REFERENCES inboxes(id) NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vínculo conversa ↔ label
CREATE TABLE conversation_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) NOT NULL,
  label_id UUID REFERENCES labels(id) NOT NULL
);

-- Departamentos
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id UUID REFERENCES inboxes(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

### 4.2 Queries de Filtragem

\`\`\`sql
-- Filtro por status
SELECT * FROM conversations WHERE inbox_id = :inbox_id AND status = :status;

-- Filtro por atribuição (minhas)
SELECT * FROM conversations WHERE inbox_id = :inbox_id AND assigned_to = auth.uid();

-- Filtro por não atribuídas
SELECT * FROM conversations WHERE inbox_id = :inbox_id AND assigned_to IS NULL;

-- Filtro por prioridade
SELECT * FROM conversations WHERE inbox_id = :inbox_id AND priority = :priority;

-- Filtro por departamento
SELECT * FROM conversations WHERE inbox_id = :inbox_id AND department_id = :dept_id;

-- Filtro por label
SELECT c.* FROM conversations c
JOIN conversation_labels cl ON cl.conversation_id = c.id
WHERE c.inbox_id = :inbox_id AND cl.label_id = :label_id;

-- Busca por nome/telefone
SELECT c.* FROM conversations c
JOIN contacts ct ON ct.id = c.contact_id
WHERE c.inbox_id = :inbox_id
AND (ct.name ILIKE '%query%' OR ct.phone ILIKE '%query%');
\`\`\`

---

## 5. Componentes Frontend

| Componente | Arquivo | Responsabilidade |
|-----------|---------|-----------------|
| \`ConversationList\` | \`src/components/helpdesk/ConversationList.tsx\` | Lista de conversas com busca e filtros colapsáveis |
| \`ConversationItem\` | \`src/components/helpdesk/ConversationItem.tsx\` | Item individual de conversa na lista |
| \`ContactInfoPanel\` | \`src/components/helpdesk/ContactInfoPanel.tsx\` | Painel lateral com dados do contato e conversa |
| \`ConversationLabels\` | \`src/components/helpdesk/ConversationLabels.tsx\` | Renderização de badges de labels |
| \`LabelPicker\` | \`src/components/helpdesk/LabelPicker.tsx\` | Popover para atribuir labels |
| \`ManageLabelsDialog\` | \`src/components/helpdesk/ManageLabelsDialog.tsx\` | CRUD de labels da inbox |
| \`HelpDesk\` | \`src/pages/dashboard/HelpDesk.tsx\` | Página principal com estado, filtros e layout responsivo |

---

## 6. Realtime e Broadcasts

### Canais:
- \`helpdesk-realtime\` — Eventos de mensagens e transcrições
- \`helpdesk-conversations\` — Eventos de atualização de conversa

### Eventos relevantes:
| Evento | Payload | Origem |
|--------|---------|--------|
| \`new-message\` | \`{ conversation_id, message }\` | Webhook / envio |
| \`assigned-agent\` | \`{ conversation_id, agent_id }\` | ContactInfoPanel |
| \`conversation_updated\` | \`{ conversation_id, inbox_id }\` | Qualquer atualização |

---

## 7. Permissões (RLS)

| Ação | Regra |
|------|-------|
| Ver conversas | \`has_inbox_access(inbox_id, auth.uid())\` ou \`is_super_admin(auth.uid())\` |
| Atualizar conversa | Membro da inbox (\`inbox_users\`) |
| Gerenciar labels | Membro da inbox com role \`admin\` ou \`gestor\` |
| Ver departamentos | Membro da inbox |
| Atribuir agente | Membro da inbox |

---

## 8. UX / Design Patterns

### 8.1 Mobile-First
- Filtros colapsáveis para economizar espaço vertical
- Controle segmentado com ícones compactos em telas pequenas
- Painel de contato acessível via botão no header do chat (mobile)
- Transições suaves com CSS Grid animation

### 8.2 Feedback Visual
- Badge de contagem nos filtros ativos
- Indicadores coloridos de prioridade (🔴🟡🔵)
- Status com cores semânticas (verde/amarelo/cinza)
- Labels com cores customizáveis
- Skeleton loading durante carregamento

### 8.3 Acessibilidade
- Todos os selects possuem labels descritivos
- Botões com aria-labels apropriados
- Contraste adequado em modo claro e escuro
- Navegação por teclado nos filtros

---

## 9. Edge Functions Relacionadas

| Função | Endpoint | Uso |
|--------|----------|-----|
| \`summarize-conversation\` | \`POST /functions/v1/summarize-conversation\` | Gera resumo IA da conversa |
| \`sync-conversations\` | \`POST /functions/v1/sync-conversations\` | Sincroniza conversas da instância |

---

## 10. Secrets Necessários

| Secret | Uso |
|--------|-----|
| \`GROQ_API_KEY\` | API de IA para geração de resumos |
| \`SUPABASE_URL\` | URL do projeto Supabase |
| \`SUPABASE_SERVICE_ROLE_KEY\` | Chave service role para operações administrativas |

---

## 11. Regras de Negócio

1. **Filtros são combinados (AND):** Status + Atribuição + Prioridade + Label + Departamento + Busca textual
2. **Busca é case-insensitive** via \`ILIKE\`
3. **Labels são por inbox:** Cada inbox tem seu conjunto independente de labels
4. **Departamento padrão:** Novas conversas recebem o departamento marcado como \`is_default\`
5. **Resumo IA expira:** Após \`ai_summary_expires_at\`, o resumo é marcado como desatualizado
6. **Histórico por contato:** Conversas anteriores são buscadas pelo \`contact_id\`, independente da inbox
7. **Atribuição via broadcast:** Mudança de agente dispara evento realtime para atualizar outros clientes
8. **Contadores são client-side:** Os contadores das abas são calculados a partir do array de conversas já carregado