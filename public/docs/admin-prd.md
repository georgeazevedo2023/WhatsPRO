# PRD — Módulo de Administração

> **Versão:** v1.0  
> **Última atualização:** 2026-03-03  
> **Status:** ✅ Completo  
> **Acesso:** Exclusivo \`super_admin\`

---

## 1. Visão Geral

O módulo de Administração centraliza a gestão de **usuários, permissões, instâncias, caixas de entrada, equipe de atendimento e departamentos** do WsmartQR. É acessível exclusivamente por usuários com papel \`super_admin\` e opera via Painel Administrativo (\`/dashboard/admin\`) e páginas dedicadas (\`/dashboard/users\`, \`/dashboard/inbox-users\`, \`/dashboard/inbox-management\`).

### Objetivo
Permitir ao super administrador:
- Criar, editar e excluir usuários do sistema
- Atribuir papéis (\`super_admin\`, \`gerente\`, \`user\`) e instâncias
- Criar e configurar caixas de entrada (inboxes) vinculadas a instâncias WhatsApp
- Montar equipes de atendimento com papéis por inbox (\`admin\`, \`gestor\`, \`agente\`)
- Organizar atendentes em departamentos para segmentação de conversas
- Configurar webhooks de entrada e saída por inbox

---

## 2. Hierarquia de Papéis

### 2.1 Papéis de Aplicação (\`app_role\`)

| Papel | Nível | Descrição |
|-------|-------|-----------|
| \`super_admin\` | Máximo | Acesso total a todas as funcionalidades, instâncias e dados |
| \`gerente\` | Intermediário | Acesso a instâncias atribuídas + funcionalidades de gestão |
| \`user\` | Básico | Acesso apenas às instâncias atribuídas |

### 2.2 Papéis de Inbox (\`inbox_role\`)

| Papel | Nível | Descrição |
|-------|-------|-----------|
| \`admin\` | Máximo | Gestão total da inbox: membros, labels, webhooks, departamentos |
| \`gestor\` | Intermediário | Gestão de departamentos e atribuição de conversas |
| \`agente\` | Básico | Visualiza e responde conversas do(s) seu(s) departamento(s) |

### 2.3 Diagrama de Herança de Acesso

\`\`\`
super_admin (app_role)
├── Acesso total a TODAS as instâncias (bypass RLS)
├── Acesso total a TODAS as inboxes
├── Acesso total a TODOS os departamentos
├── Acesso total a TODAS as conversas
├── CRUD de usuários via Edge Functions
└── Gestão de backup e documentação

gerente (app_role)
├── Acesso às instâncias atribuídas (user_instance_access)
├── Funcionalidades de broadcast, agendamento
└── NÃO tem acesso ao painel admin

user (app_role)
├── Acesso às instâncias atribuídas (user_instance_access)
├── Funcionalidades básicas de broadcast, agendamento
└── NÃO tem acesso ao painel admin
\`\`\`

\`\`\`
admin (inbox_role)
├── Vê TODAS as conversas da inbox (qualquer departamento)
├── Gerencia membros da inbox (inbox_users)
├── Gerencia labels da inbox
├── Configura webhooks da inbox
└── Cria/edita departamentos

gestor (inbox_role)
├── Vê TODAS as conversas da inbox (qualquer departamento)
├── Atribui conversas a agentes
├── Gerencia membros da inbox
└── Gerencia departamentos que participa

agente (inbox_role)
├── Vê APENAS conversas do(s) departamento(s) que participa
├── Responde conversas atribuídas
├── Adiciona notas privadas
└── NÃO gerencia membros ou configurações
\`\`\`

---

## 3. Modelo de Dados

### 3.1 Tabelas Principais

#### \`user_profiles\`
Perfil do usuário sincronizado automaticamente via trigger \`handle_new_user()\`.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID (PK) | Não | — | Mesmo ID do \`auth.users\` |
| email | TEXT | Não | — | E-mail do login |
| full_name | TEXT | Sim | email | Nome completo |
| avatar_url | TEXT | Sim | — | URL do avatar |
| created_at | TIMESTAMPTZ | Não | now() | Data de criação |
| updated_at | TIMESTAMPTZ | Não | now() | Última atualização |

#### \`user_roles\`
Papéis de aplicação do usuário. Um usuário pode ter múltiplos papéis, mas o sistema resolve o de maior prioridade.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID (PK) | Não | gen_random_uuid() | — |
| user_id | UUID | Não | — | FK implícita para auth.users |
| role | app_role | Não | 'user' | super_admin, gerente ou user |
| created_at | TIMESTAMPTZ | Não | now() | — |

#### \`instances\`
Instâncias WhatsApp conectadas via UAZAPI.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | TEXT (PK) | Não | — | Nome da instância UAZAPI |
| name | TEXT | Não | — | Nome de exibição |
| token | TEXT | Não | — | Token UAZAPI |
| user_id | UUID | Não | — | Proprietário |
| status | TEXT | Não | 'disconnected' | connected/disconnected |
| owner_jid | TEXT | Sim | — | JID do WhatsApp conectado |
| profile_pic_url | TEXT | Sim | — | Foto do perfil |
| disabled | BOOLEAN | Não | false | Desativada (soft delete) |
| created_at | TIMESTAMPTZ | Não | now() | — |
| updated_at | TIMESTAMPTZ | Não | now() | — |

#### \`user_instance_access\`
Tabela M:N que controla quais usuários têm acesso a quais instâncias.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID (PK) | Não | gen_random_uuid() | — |
| user_id | UUID | Não | — | — |
| instance_id | TEXT | Não | — | FK para instances |
| created_at | TIMESTAMPTZ | Não | now() | — |

> **Nota:** \`super_admin\` tem acesso a todas as instâncias via bypass RLS — não precisa de registro nesta tabela.

#### \`inboxes\`
Caixas de entrada do Helpdesk, vinculadas a uma instância WhatsApp.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID (PK) | Não | gen_random_uuid() | — |
| name | TEXT | Não | — | Nome da caixa |
| instance_id | TEXT | Não | — | FK para instances |
| created_by | UUID | Não | — | Quem criou |
| webhook_url | TEXT | Sim | — | Webhook de entrada |
| webhook_outgoing_url | TEXT | Sim | — | Webhook de saída |
| created_at | TIMESTAMPTZ | Não | now() | — |

#### \`inbox_users\`
Membros da equipe de atendimento de uma inbox, com papel específico.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID (PK) | Não | gen_random_uuid() | — |
| user_id | UUID | Não | — | — |
| inbox_id | UUID | Não | — | FK para inboxes |
| role | inbox_role | Não | 'agente' | admin, gestor ou agente |
| is_available | BOOLEAN | Não | true | Disponibilidade para atribuição |
| created_at | TIMESTAMPTZ | Não | now() | — |

> **Constraint:** UNIQUE(user_id, inbox_id) — um usuário pode ter apenas um papel por inbox.

#### \`departments\`
Departamentos organizacionais dentro de uma inbox.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID (PK) | Não | gen_random_uuid() | — |
| name | TEXT | Não | — | Nome do departamento |
| description | TEXT | Sim | — | Descrição |
| inbox_id | UUID | Não | — | FK para inboxes |
| is_default | BOOLEAN | Não | false | Departamento padrão da inbox |
| created_at | TIMESTAMPTZ | Não | now() | — |
| updated_at | TIMESTAMPTZ | Não | now() | — |

> **Trigger:** \`ensure_single_default_department\` — garante apenas 1 departamento padrão por inbox.

#### \`department_members\`
Associação de atendentes a departamentos.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | UUID (PK) | Não | gen_random_uuid() | — |
| department_id | UUID | Não | — | FK para departments |
| user_id | UUID | Não | — | — |
| created_at | TIMESTAMPTZ | Não | now() | — |

### 3.2 Enums

| Enum | Valores | Uso |
|------|---------|-----|
| \`app_role\` | super_admin, gerente, user | Papel global do usuário |
| \`inbox_role\` | admin, gestor, agente | Papel do atendente na inbox |

---

## 4. Funções de Segurança (SECURITY DEFINER)

Todas as funções abaixo executam com privilégios do owner (bypassing RLS) para evitar recursão nas políticas.

### \`is_super_admin(_user_id UUID) → BOOLEAN\`
Verifica se o usuário tem papel \`super_admin\` na tabela \`user_roles\`.

### \`has_role(_user_id UUID, _role app_role) → BOOLEAN\`
Verifica se o usuário possui um papel específico.

### \`is_gerente(_user_id UUID) → BOOLEAN\`
Atalho para verificar papel \`gerente\`.

### \`has_inbox_access(_user_id UUID, _inbox_id UUID) → BOOLEAN\`
Verifica se o usuário é membro da inbox (existe registro em \`inbox_users\`).

### \`is_inbox_member(_user_id UUID, _inbox_id UUID) → BOOLEAN\`
Equivalente a \`has_inbox_access\` — verifica existência em \`inbox_users\`.

### \`get_inbox_role(_user_id UUID, _inbox_id UUID) → inbox_role\`
Retorna o papel do usuário na inbox (\`admin\`, \`gestor\` ou \`agente\`).

---

## 5. Políticas RLS por Tabela

### 5.1 \`user_profiles\`
| Política | Comando | Condição |
|----------|---------|----------|
| Users can view own profile | SELECT | auth.uid() = id |
| Super admin can view all profiles | SELECT | is_super_admin(auth.uid()) |
| Inbox co-members can view limited profiles | SELECT | Co-membro via inbox_users JOIN |
| Users can update own profile | UPDATE | auth.uid() = id |
| Super admin can update all profiles | UPDATE | is_super_admin(auth.uid()) |
| Super admin can insert profiles | INSERT | is_super_admin OR auth.uid() = id |
| Super admin can delete profiles | DELETE | is_super_admin(auth.uid()) |

### 5.2 \`user_roles\`
| Política | Comando | Condição |
|----------|---------|----------|
| Users can view own roles | SELECT | auth.uid() = user_id |
| Super admin can view all roles | SELECT | is_super_admin(auth.uid()) |
| Super admin can manage all roles | ALL | is_super_admin(auth.uid()) |

### 5.3 \`instances\`
| Política | Comando | Condição |
|----------|---------|----------|
| Users can view assigned instances | SELECT | is_super_admin OR user_instance_access |
| Users can update assigned instances | UPDATE | is_super_admin OR user_instance_access |
| Super admin can insert instances | INSERT | is_super_admin(auth.uid()) |
| Super admin can delete instances | DELETE | is_super_admin(auth.uid()) |

### 5.4 \`user_instance_access\`
| Política | Comando | Condição |
|----------|---------|----------|
| Users can view own access | SELECT | auth.uid() = user_id |
| Super admin can manage all access | ALL | is_super_admin(auth.uid()) |

### 5.5 \`inboxes\`
| Política | Comando | Condição |
|----------|---------|----------|
| Users can view their inboxes | SELECT | is_super_admin OR has_inbox_access |
| Inbox admins can update inboxes | UPDATE | is_super_admin OR inbox_role IN (admin, gestor) |
| Super admins can manage all inboxes | ALL | is_super_admin(auth.uid()) |

### 5.6 \`inbox_users\`
| Política | Comando | Condição |
|----------|---------|----------|
| Users can view own inbox memberships | SELECT | auth.uid() = user_id |
| Inbox members can view co-members | SELECT | is_inbox_member(auth.uid(), inbox_id) |
| Inbox admins and gestors can manage members | ALL | inbox_role IN (admin, gestor) |
| Super admins can manage all inbox_users | ALL | is_super_admin(auth.uid()) |

### 5.7 \`departments\`
| Política | Comando | Condição |
|----------|---------|----------|
| Inbox users can view departments | SELECT | has_inbox_access(auth.uid(), inbox_id) |
| Super admins can manage all departments | ALL | is_super_admin(auth.uid()) |

### 5.8 \`department_members\`
| Política | Comando | Condição |
|----------|---------|----------|
| Inbox users can view department members | SELECT | has_inbox_access via departments.inbox_id |
| Super admins can manage all department members | ALL | is_super_admin(auth.uid()) |

---

## 6. Edge Functions Administrativas

### 6.1 \`admin-create-user\`
Cria um novo usuário via Supabase Auth Admin API.

**Endpoint:** \`POST /functions/v1/admin-create-user\`  
**Auth:** Bearer token (super_admin obrigatório)  
**JWT Verification:** Desabilitada (validação manual)

**Payload:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "minimo6chars",
  "full_name": "Nome Completo",
  "role": "user"
}
\`\`\`

**Fluxo:**
1. Valida token JWT e verifica \`super_admin\` via \`user_roles\`
2. Chama \`adminClient.auth.admin.createUser({ email, password, email_confirm: true })\`
3. Remove o role padrão (\`user\`) inserido pelo trigger \`handle_new_user()\`
4. Insere o role especificado na requisição
5. Retorna \`{ success: true, user_id }\`

**Validações:**
- Email obrigatório
- Senha mínima 6 caracteres
- Role normalizado para \`user\` se inválido

### 6.2 \`admin-update-user\`
Atualiza credenciais e perfil de um usuário existente.

**Endpoint:** \`POST /functions/v1/admin-update-user\`  
**Auth:** Bearer token (super_admin obrigatório)

**Payload:**
\`\`\`json
{
  "user_id": "uuid",
  "email": "novo@email.com",
  "password": "novasenha",
  "full_name": "Novo Nome"
}
\`\`\`

**Fluxo:**
1. Valida token e verifica \`super_admin\`
2. Atualiza \`auth.users\` via \`adminClient.auth.admin.updateUserById()\`
3. Atualiza \`user_profiles\` (full_name, email)
4. Retorna \`{ success: true }\`

**Validações:**
- user_id, email e full_name obrigatórios
- Senha opcional (se fornecida, mínimo 6 caracteres)

### 6.3 \`admin-delete-user\`
Exclui um usuário e todos os dados associados.

**Endpoint:** \`POST /functions/v1/admin-delete-user\`  
**Auth:** Bearer token (super_admin obrigatório)

**Payload:**
\`\`\`json
{
  "user_id": "uuid"
}
\`\`\`

**Fluxo:**
1. Valida token e verifica \`super_admin\`
2. Impede auto-exclusão (\`user_id !== auth.uid()\`)
3. Exclui em ordem: \`user_instance_access\` → \`user_roles\` → \`user_profiles\` → \`auth.users\`
4. Retorna \`{ success: true }\`

**Observação:** Não exclui registros de \`inbox_users\` ou \`department_members\` — estes ficam órfãos (sem impacto funcional pois o auth.user não existe mais).

---

## 7. Interface do Usuário

### 7.1 Painel Administrativo (\`/dashboard/admin\`)
Acesso exclusivo \`super_admin\`. Contém as abas:

| Aba | Componente | Funcionalidades |
|-----|-----------|-----------------|
| Caixas de Entrada | AdminPanel (aba inboxes) | Criar, excluir inboxes; configurar webhooks; gerenciar membros |
| Usuários | AdminPanel (aba users) | Criar, editar, excluir usuários; alterar roles; ver instâncias |
| Equipe | AdminPanel (aba team) | Gerenciar atendentes; editar perfil; ver/editar memberships |
| Departamentos | DepartmentsTab | Criar, editar, excluir departamentos; gerenciar membros |
| Backup | BackupModule | Exportar tabelas em XLSX |
| Documentação | DocumentationTab | PRDs dos módulos |

### 7.2 Gestão de Usuários (\`/dashboard/users\`)
Página dedicada com:
- Grid de cards com avatar, email, role badge
- Contagem de instâncias atribuídas com chips de nomes
- Botão para gerenciar instâncias (\`ManageUserInstancesDialog\`)
- Botão para excluir com confirmação
- Busca por nome/email

### 7.3 Gestão de Equipe (\`/dashboard/inbox-users\`)
Página dedicada com:
- Listagem de usuários com memberships em inboxes
- Badges coloridos por role (admin/gestor/agente)
- Criação de atendente (\`CreateInboxUserDialog\`)
- Edição de perfil e memberships
- Remoção de membership individual

### 7.4 Gestão de Inboxes (\`/dashboard/inbox-management\`)
Página dedicada com:
- Criação de inbox vinculada a instância
- Configuração de webhook URL e webhook outgoing URL
- IDs copiáveis (inbox_id, instance_id)
- Gerenciamento de membros (\`ManageInboxUsersDialog\`)
- Exclusão com limpeza de inbox_users e labels

---

## 8. Fluxos Operacionais

### 8.1 Criar Usuário
1. Super admin acessa Painel Admin → aba Usuários → "Novo Usuário"
2. Preenche: nome, email, senha, papel (super_admin/gerente/user)
3. Sistema chama Edge Function \`admin-create-user\`
4. Trigger \`handle_new_user()\` cria \`user_profiles\` e role padrão
5. Edge Function substitui role padrão pelo selecionado
6. Usuário aparece na listagem

### 8.2 Atribuir Instâncias a Usuário
1. Super admin clica em "Gerenciar Instâncias" no card do usuário
2. \`ManageUserInstancesDialog\` exibe todas as instâncias com checkboxes
3. Ao salvar, insere/remove registros em \`user_instance_access\`
4. Mudança reflete imediatamente (RLS baseado nesta tabela)

### 8.3 Criar Caixa de Entrada
1. Super admin acessa Gestão de Inboxes → "Nova Caixa de Entrada"
2. Seleciona instância, define nome e webhooks opcionais
3. Insert em \`inboxes\` com \`created_by = auth.uid()\`
4. Inbox aparece na listagem para configuração de equipe

### 8.4 Adicionar Atendente à Inbox
1. Super admin abre \`ManageInboxUsersDialog\` da inbox
2. Seleciona usuário da lista e define papel (admin/gestor/agente)
3. Insert em \`inbox_users\` com unique constraint (user_id, inbox_id)
4. Atendente ganha acesso às conversas da inbox conforme papel

### 8.5 Criar Departamento
1. Super admin acessa aba Departamentos
2. Seleciona inbox, define nome e descrição
3. Opcionalmente marca como "Departamento Padrão"
4. Trigger \`ensure_single_default_department\` garante unicidade
5. Adiciona membros ao departamento

### 8.6 Atribuir Atendente a Departamento
1. Na aba Departamentos, seleciona departamento
2. Adiciona membro via \`department_members\`
3. Agente passa a ver conversas vinculadas àquele departamento
4. Admins e gestores continuam vendo TODAS as conversas

---

## 9. Herança de Acesso — Fluxo Completo

\`\`\`
INSTÂNCIA (instances)
  │
  ├── user_instance_access (M:N) ─── Usuário vê a instância
  │
  └── INBOX (inboxes) ─── vinculada a 1 instância
        │
        ├── inbox_users (M:N) ─── Usuário é membro com inbox_role
        │     │
        │     ├── admin ── vê TUDO na inbox
        │     ├── gestor ── vê TUDO na inbox
        │     └── agente ── vê APENAS seus departamentos
        │
        ├── DEPARTAMENTO (departments)
        │     │
        │     └── department_members (M:N) ─── Agente vinculado
        │           │
        │           └── CONVERSA (conversations)
        │                 │
        │                 ├── department_id = dept ── agente vê
        │                 └── department_id = NULL ── todos veem
        │
        └── LABELS (labels)
              └── Gerenciadas por admin/gestor
\`\`\`

### Regras de Visibilidade de Conversas (RLS)
Uma conversa é visível para um usuário se:
1. **É super_admin** → vê tudo (bypass)
2. **É membro da inbox** E:
   a. \`department_id IS NULL\` → todos os membros veem
   b. \`inbox_role IN (admin, gestor)\` → vê todas do inbox
   c. \`inbox_role = agente\` → vê apenas se \`department_members\` inclui o agente naquele departamento

---

## 10. Configurações e Variáveis

### Secrets necessárias
| Secret | Uso |
|--------|-----|
| SUPABASE_URL | URL do projeto Supabase |
| SUPABASE_ANON_KEY | Chave pública para cliente |
| SUPABASE_SERVICE_ROLE_KEY | Chave admin para Edge Functions |

### Config (supabase/config.toml)
Todas as Edge Functions administrativas estão com \`verify_jwt = false\` pois fazem validação manual do token para extrair o usuário e verificar o papel.

\`\`\`toml
[functions.admin-create-user]
verify_jwt = false

[functions.admin-update-user]
verify_jwt = false

[functions.admin-delete-user]
verify_jwt = false
\`\`\`

---

## 11. Trigger de Criação de Usuário

### \`handle_new_user()\` (trigger em \`auth.users\` AFTER INSERT)
1. Insere registro em \`user_profiles\` com id, email e full_name (do metadata)
2. Insere role padrão \`user\` em \`user_roles\`
3. Edge Function \`admin-create-user\` substitui o role padrão pelo selecionado

---

## 12. Componentes Reutilizáveis

| Componente | Arquivo | Uso |
|-----------|---------|-----|
| ManageUserInstancesDialog | dashboard/ManageUserInstancesDialog.tsx | Atribuir instâncias a usuários |
| ManageInstanceAccessDialog | dashboard/ManageInstanceAccessDialog.tsx | Atribuir usuários a instâncias |
| ManageInboxUsersDialog | dashboard/ManageInboxUsersDialog.tsx | Gerenciar membros de inbox |
| CreateInboxUserDialog | dashboard/CreateInboxUserDialog.tsx | Criar atendente com instância+inbox+role |
| DepartmentsTab | dashboard/DepartmentsTab.tsx | CRUD de departamentos e membros |
| BackupModule | dashboard/BackupModule.tsx | Exportação de dados |
| DocumentViewer | admin/DocumentViewer.tsx | Visualização de PRDs |

---

## 13. Regras de Negócio

1. **Auto-exclusão proibida** — Super admin não pode excluir a si mesmo
2. **Unicidade de role por inbox** — UNIQUE(user_id, inbox_id) em inbox_users
3. **Departamento padrão único** — Trigger garante apenas 1 por inbox
4. **Políticas PERMISSIVE** — Todas as políticas RLS são PERMISSIVE (não RESTRICTIVE)
5. **Super admin não precisa de user_instance_access** — Bypass via is_super_admin() nas políticas
6. **Exclusão cascata parcial** — Deletar usuário remove: user_instance_access, user_roles, user_profiles, auth.user. NÃO remove inbox_users ou department_members automaticamente
7. **Webhook configurável por inbox** — webhook_url (entrada) e webhook_outgoing_url (saída), editáveis apenas por admin/gestor ou super_admin