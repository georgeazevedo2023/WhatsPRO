# PRD — Modulo Agendamentos

## 1. Visao Geral

O modulo **Agendamentos** permite criar, gerenciar e monitorar **mensagens agendadas** para envio futuro a grupos WhatsApp. Suporta envios unicos (one-time) e **recorrentes** com multiplos tipos de recorrencia, alem de delay anti-bloqueio e exclusao de administradores.

### Caracteristicas Principais
- **Envio unico ou recorrente** para grupos WhatsApp
- **Recorrencia configuravel**: diaria, semanal (com dias da semana), mensal e custom
- **Delay anti-bloqueio** aleatorio entre envios (5-10s ou 10-20s)
- **Exclusao de admins**: envia individualmente apenas para membros regulares
- **Logs de execucao** com historico detalhado por agendamento
- **Gerenciamento completo**: pausar, retomar e cancelar agendamentos
- **Abas de status**: ativos, concluidos e falhas
- **Edge Function dedicada**: \`process-scheduled-messages\` para processamento automatico

### Rotas
- \`/dashboard/scheduled\` → \`ScheduledMessages.tsx\` (listagem e gerenciamento)
- Agendamento criado via \`ScheduleMessageDialog.tsx\` nos modulos Broadcast e Grupos

---

## 2. Modelo de Dados

### 2.1 scheduled_messages

Armazena cada agendamento criado pelo usuario.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | Identificador unico |
| user_id | UUID FK → auth.users | Dono do agendamento |
| instance_id | TEXT FK → instances | Instancia de envio |
| group_jid | TEXT | JID do grupo destino |
| group_name | TEXT | Nome do grupo (snapshot) |
| message_type | TEXT | \`text\`, \`image\`, \`video\`, \`audio\`, \`ptt\`, \`document\` |
| content | TEXT | Conteudo textual / caption |
| media_url | TEXT | URL da midia |
| filename | TEXT | Nome do arquivo (midia) |
| recipients | JSONB | Lista de destinatarios individuais (\`[{jid: "..."}]\`) quando excluir admins |
| scheduled_at | TIMESTAMPTZ | Data/hora do primeiro envio |
| next_run_at | TIMESTAMPTZ | Proxima execucao prevista |
| is_recurring | BOOLEAN | Se e recorrente |
| recurrence_type | TEXT | \`daily\`, \`weekly\`, \`monthly\`, \`custom\` |
| recurrence_interval | INT | Intervalo de recorrencia (ex: a cada N dias) |
| recurrence_days | INT[] | Dias da semana para weekly (0=dom, 6=sab) |
| recurrence_end_at | TIMESTAMPTZ | Fim da recorrencia por data |
| recurrence_count | INT | Fim da recorrencia por contagem maxima |
| executions_count | INT | Execucoes realizadas ate o momento |
| last_executed_at | TIMESTAMPTZ | Ultima execucao |
| random_delay | TEXT | Preset de delay: \`none\`, \`5-10\`, \`10-20\` |
| exclude_admins | BOOLEAN | Se exclui admins do envio |
| status | TEXT | \`pending\`, \`processing\`, \`paused\`, \`completed\`, \`cancelled\`, \`failed\` |
| last_error | TEXT | Ultimo erro de execucao |
| created_at | TIMESTAMPTZ | Data de criacao |

### 2.2 scheduled_message_logs

Registra cada execucao individual de um agendamento.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | Identificador unico |
| scheduled_message_id | UUID FK → scheduled_messages | Referencia ao agendamento |
| executed_at | TIMESTAMPTZ | Data/hora da execucao |
| status | TEXT | \`success\`, \`partial\`, \`failed\` |
| recipients_total | INT | Total de destinatarios |
| recipients_success | INT | Envios com sucesso |
| recipients_failed | INT | Envios com falha |
| error_message | TEXT | Mensagem de erro (se houver) |

---

## 3. Politicas RLS

### scheduled_messages
- **ALL**: \`auth.uid() = user_id\`
- **SELECT** (super_admin): \`is_super_admin(auth.uid())\`

### scheduled_message_logs
- **SELECT**: via join com \`scheduled_messages\` onde \`auth.uid() = user_id\`

---

## 4. Interface do Usuario — Componentes

### 4.1 ScheduledMessages.tsx (Pagina Principal)

Pagina de listagem e gerenciamento de todos os agendamentos do usuario.

- **Abas de status**:
  - **Ativos**: status \`pending\`, \`processing\`, \`paused\` — com contagem
  - **Concluidos**: status \`completed\` — com contagem
  - **Falhas**: status \`failed\`, \`cancelled\` — com contagem
- **Query**: \`scheduled_messages\` com join \`instances(name)\`, ordenado por \`next_run_at\` ascendente
- **Estado vazio**: icone de calendario com mensagem contextual por aba
- **Loading**: spinner centralizado

### 4.2 ScheduledMessageCard (Componente Interno)

Card individual para cada agendamento com informacoes detalhadas.

- **Header**: icone do tipo de mensagem + nome do grupo + badge de status
- **Descricao**: nome da instancia + info de recorrencia (quando aplicavel) + badge de delay
- **Preview**: conteudo textual com truncamento (2 linhas)
- **Info de agenda**: proxima execucao formatada + contagem de execucoes
- **Erro**: alerta visual com ultimo erro registrado
- **Acoes**:
  - **Pausar**: disponivel quando status = \`pending\`
  - **Retomar**: disponivel quando status = \`paused\` (volta para \`pending\`)
  - **Cancelar**: dialog de confirmacao, disponivel para \`pending\` e \`paused\`
- **Historico**: collapsible com ultimos 10 logs de execucao (\`scheduled_message_logs\`)
  - Cada log exibe: data/hora, icone de status (sucesso/parcial/falha), contagem de envios

### 4.3 ScheduleMessageDialog.tsx (Dialog de Configuracao)

Dialog reutilizavel para configurar um novo agendamento. Utilizado pelo Broadcast e pelo modulo de Grupos.

- **Data e hora**: calendar picker + input de hora
- **Recorrencia** (toggle):
  - **Diaria**: a cada N dias
  - **Semanal**: a cada N semanas + selecao de dias (Dom-Sab com botoes circulares)
  - **Mensal**: a cada N meses
- **Condicao de fim** (quando recorrente):
  - Nunca (checkbox)
  - Em uma data especifica (calendar picker)
  - Apos N execucoes (input numerico)
- **Delay anti-bloqueio**: 3 botoes — Desativado, 5-10 seg, 10-20 seg
- **Preview resumido**: mostra primeiro envio, recorrencia configurada e delay selecionado
- **Saida**: retorna \`ScheduleConfig\` com todos os parametros

#### Interface ScheduleConfig
\`\`\`typescript
interface ScheduleConfig {
  scheduledAt: Date;
  isRecurring: boolean;
  recurrenceType: "daily" | "weekly" | "monthly" | "custom";
  recurrenceInterval: number;
  recurrenceDays: number[];
  recurrenceEndAt?: Date;
  recurrenceCount?: number;
  endType: "never" | "date" | "count";
  randomDelay: "none" | "5-10" | "10-20";
}
\`\`\`

---

## 5. Edge Function: process-scheduled-messages

### Visao Geral
Edge Function executada periodicamente (via cron ou invocacao manual) para processar agendamentos pendentes.

### Autenticacao
- Aceita chamadas via cron/service (\`verifyCronOrService\`)
- Ou chamadas manuais de super_admin (\`verifySuperAdmin\`)

### Fluxo de Execucao
\`\`\`
1. Buscar scheduled_messages com status = 'pending' E next_run_at <= now()
2. Para cada mensagem pendente:
   a. Marcar status = 'processing'
   b. Obter token da instancia via join instances(token)
   c. Se exclude_admins E recipients existem:
      → Loop por cada recipient com delay entre envios
   d. Senao:
      → Enviar direto ao group_jid
   e. Registrar log em scheduled_message_logs
   f. Se recorrente:
      → Calcular next_run_at
      → Verificar se deve continuar (data fim / contagem)
      → Atualizar status: 'pending' (continua) ou 'completed' (fim)
   g. Se nao recorrente:
      → Status = 'completed' ou 'failed'
\`\`\`

### Calculo de Proxima Execucao (calculateNextRun)

| Tipo | Logica |
|------|--------|
| daily | \`current + N dias\` |
| weekly | Proximo dia da semana na lista \`recurrence_days\`; se nenhum restante na semana, pula para o primeiro dia da proxima semana + (intervalo - 1) semanas |
| monthly | \`current + N meses\` |
| custom | \`current + N dias\` (equivalente a daily com intervalo customizado) |

### Condicoes de Fim da Recorrencia (shouldContinueRecurrence)
- \`recurrence_end_at\`: para se \`next_run_at > end_date\`
- \`recurrence_count\`: para se \`executions_count + 1 >= count\`
- Ambos nulos: executa indefinidamente

### Envio de Mensagens

#### Texto
\`\`\`
POST {UAZAPI_SERVER_URL}/send/text
Headers: { token }
Body: { number, text }
\`\`\`

#### Midia (imagem, video, audio, documento, ptt)
\`\`\`
POST {UAZAPI_SERVER_URL}/send/media
Headers: { token }
Body: { number, type, file, text, docName? }
\`\`\`

### Delay Anti-Bloqueio
| Config | Delay |
|--------|-------|
| \`none\` | 350ms (base) |
| \`5-10\` | Aleatorio entre 5.000ms e 10.000ms |
| \`10-20\` | Aleatorio entre 10.000ms e 20.000ms |

### Log de Execucao
Cada execucao gera um registro em \`scheduled_message_logs\`:
- \`success\`: todos os envios com sucesso
- \`partial\`: alguns envios falharam
- \`failed\`: todos os envios falharam ou erro na execucao

### Resposta da Edge Function
\`\`\`json
{
  "success": true,
  "processed": 3,
  "timestamp": "2026-03-21T10:00:00.000Z"
}
\`\`\`

---

## 6. Fluxos Operacionais

### 6.1 Criar Agendamento (via Broadcast)
\`\`\`
Broadcast → Compor Mensagem → Botao "Agendar"
→ ScheduleMessageDialog (data/hora + recorrencia + delay)
→ INSERT scheduled_messages (status: 'pending', recipients: JSON)
→ Redirect para /dashboard/scheduled
\`\`\`

### 6.2 Criar Agendamento (via Grupo)
\`\`\`
Pagina do Grupo → SendMessageForm / SendMediaForm → Botao "Agendar"
→ ScheduleMessageDialog (data/hora + recorrencia + delay)
→ INSERT scheduled_messages (status: 'pending')
→ Toast de confirmacao
\`\`\`

### 6.3 Processamento Automatico
\`\`\`
Cron/Service → process-scheduled-messages
→ Busca pendentes (next_run_at <= now)
→ Para cada: processing → envio → log → calculo proximo run
→ Retorna contagem de processados
\`\`\`

### 6.4 Pausar e Retomar
\`\`\`
ScheduledMessages → Botao "Pausar" → UPDATE status = 'paused'
→ Edge Function ignora mensagens com status != 'pending'
→ Botao "Retomar" → UPDATE status = 'pending'
→ Proximo ciclo do cron processa normalmente
\`\`\`

### 6.5 Cancelar Agendamento
\`\`\`
ScheduledMessages → Botao "Cancelar" → Dialog de confirmacao
→ UPDATE status = 'cancelled'
→ Agendamento movido para aba "Falhas"
\`\`\`

---

## 7. Tipos de Mensagem Suportados

| Tipo | Icone | Descricao |
|------|-------|-----------|
| text | MessageSquare | Mensagem de texto simples |
| image | Image | Imagem com caption opcional |
| video | Video | Video com caption opcional |
| audio | Music | Arquivo de audio |
| ptt | Mic | Audio PTT (push-to-talk) |
| document | FileText | Documento/arquivo generico |

---

## 8. Status do Agendamento

| Status | Label | Badge | Descricao |
|--------|-------|-------|-----------|
| pending | Pendente | default | Aguardando proxima execucao |
| processing | Processando | secondary | Em execucao pela Edge Function |
| paused | Pausado | secondary | Pausado pelo usuario |
| completed | Concluido | outline | Todas as execucoes finalizadas |
| failed | Falhou | destructive | Falha na execucao |
| cancelled | Cancelado | outline | Cancelado pelo usuario |

---

## 9. Regras de Negocio

### Delays
- Delay base entre envios individuais: **350ms**
- Delay anti-bloqueio configuravel: nenhum, 5-10s, 10-20s (aleatorio dentro do range)
- Delay aplicado entre envios quando \`exclude_admins = true\` e ha multiplos recipients

### Recorrencia
- Recorrencia semanal permite selecionar multiplos dias da semana
- O calculo de proximo dia na semana e inteligente: busca o proximo dia selecionado ou pula para a proxima semana
- Custom funciona como daily com intervalo personalizado
- Condicoes de fim sao verificadas APOS cada execucao

### Limites
- Maximo de 50 agendamentos processados por ciclo do cron
- Cada execucao individual respeita o delay configurado entre recipients
- Logs armazenam os ultimos resultados de execucao (ate 10 exibidos na UI)

### Tratamento de Erros
- Erro em envio individual: conta como \`recipients_failed\`, proximos continuam
- Erro geral (exception): status = \`failed\`, log registrado com mensagem de erro
- Mensagem recorrente com falha total: mantem recorrencia (proximo ciclo tenta novamente)

---

## 10. Seguranca

- **RLS**: Todas as tabelas possuem politicas por \`user_id\`
- **Edge Function**: aceita apenas cron/service ou super_admin autenticado
- **Token da instancia**: resolvido server-side via join \`instances(token)\`, nunca exposto ao frontend
- **Service Role Key**: usada pela Edge Function para operacoes administrativas no banco
- **CORS**: configuracao padrao compartilhada via \`_shared/cors.ts\`