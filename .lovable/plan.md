

## PRD do Modulo Broadcast (Grupos)

### Objetivo
Criar um PRD completo do modulo Broadcast de Grupos do WsmartQR, documentando o fluxo de envio em massa para grupos WhatsApp: wizard de 3 etapas, selecao de grupos com participantes, composicao de mensagens (texto, midia, carrossel), templates, delay anti-bloqueio, progresso com pause/cancel, agendamento, persistencia de logs, integracao com HelpDesk, e criacao de base de leads a partir de grupos.

### Arquivos a Modificar

1. **Criar** `src/data/docs/broadcast-groups-prd.ts` -- PRD completo (~450 linhas) exportando `broadcastGroupsPrdContent`
2. **Editar** `src/components/admin/DocumentationTab.tsx` -- Atualizar modulo "Broadcast (Grupos)" de `coming_soon` para `complete`, importar e vincular conteudo

### Estrutura do PRD

1. **Visao Geral**
   - Envio em massa para **grupos WhatsApp** (envio direto ao grupo ou aos membros individuais nao-admin)
   - Wizard de 3 etapas: Instancia -> Grupos -> Mensagem
   - Suporte a reenvio a partir do historico e agendamento com recorrencia

2. **Modelo de Dados** -- Tabelas envolvidas:
   - `broadcast_logs` (id, user_id, instance_id, instance_name, message_type, content, media_url, carousel_data, group_names[], groups_targeted, recipients_targeted/success/failed, exclude_admins, random_delay, status, error_message, started_at, completed_at, duration_seconds)
   - `scheduled_messages` (id, user_id, instance_id, group_jid, group_name, message_type, content, media_url, filename, recipients, scheduled_at, next_run_at, is_recurring, recurrence_type/interval/days/end_at/count, executions_count, last_executed_at, random_delay, exclude_admins, status, last_error)
   - `message_templates` (templates reutilizaveis com nome, categoria, tipo, conteudo, media_url, carousel_data)

3. **Politicas RLS**:
   - `broadcast_logs`: owner INSERT/SELECT/DELETE; super_admin SELECT/DELETE
   - `scheduled_messages`: owner ALL; super_admin SELECT
   - `message_templates`: owner CRUD completo

4. **Interface do Usuario -- Componentes**:
   - `Broadcaster.tsx`: Pagina principal com wizard de 3 etapas, gestao de estado, reenvio via sessionStorage
   - `InstanceSelector.tsx`: Grid de instancias com status online/offline, auto-selecao quando unica
   - `GroupSelector.tsx`: Busca grupos via uazapi-proxy, lista com busca, selecao multipla, contagem admin/regular, select all/clear
   - `BroadcastMessageForm.tsx`: Compositor principal com 3 abas (texto, midia, carrossel), excluir admins com ParticipantSelector, templates, delay, agendamento, progresso com pause/resume/cancel
   - `ParticipantSelector.tsx`: Selecao granular de membros regulares (nao-admin) com deduplicacao, busca, deteccao de LID-only
   - `BroadcasterHeader.tsx`: Header compacto com instancia selecionada e botao trocar
   - `MessagePreview.tsx`: Preview formatado da mensagem com WhatsApp-style bold/italic/strike
   - `CarouselEditor.tsx` / `CarouselPreview.tsx`: Editor visual de carrossel com cards, imagens, botoes (URL/REPLY/CALL)
   - `TemplateSelector.tsx`: Dropdown com busca, categorias, salvar/editar/excluir templates
   - `ScheduleMessageDialog.tsx`: Dialog de agendamento com data/hora, recorrencia (diaria/semanal/mensal/custom), delay anti-bloqueio
   - `CreateLeadDatabaseDialog.tsx`: Criar base de leads a partir dos membros nao-admin dos grupos selecionados
   - `BroadcastHistoryPage.tsx` / `BroadcastHistory.tsx`: Historico com filtros, detalhes expandiveis, reenvio, exclusao
   - `ResendOptionsDialog.tsx`: Escolher destino do reenvio (grupos ou leads) e excluir admins

5. **Modos de Envio**:
   - **Envio ao grupo**: Envia mensagem diretamente ao JID do grupo (todos os membros recebem)
   - **Envio individual (excluir admins)**: Ativa ParticipantSelector, envia para cada membro regular individualmente, deduplicado por JID entre grupos
   - Delay configuravel entre envios: presets de delay (nenhum, 5-10s, 10-20s) para anti-bloqueio

6. **Tipos de Mensagem**:
   - **Texto**: Textarea com max 4096 caracteres, emoji picker, formatacao WhatsApp (*bold*, _italic_, ~strike~)
   - **Midia**: Upload ou URL; image (jpeg/png/gif/webp), video (mp4), audio (mpeg/ogg/mp3/wav), document; max 10MB; caption opcional
   - **Carrossel**: Cards com imagem (upload para bucket carousel-images), texto, e ate 3 botoes por card (URL, REPLY, CALL); upload de imagens via `uploadCarouselImage`

7. **Templates (TemplateSelector)**:
   - Carregar template salvo (texto, midia, carrossel) com auto-preenchimento dos campos
   - Salvar mensagem atual como novo template com nome e categoria opcional
   - Editar nome/categoria de template existente
   - Excluir template
   - Busca e filtro por categoria/tipo no dropdown

8. **Agendamento (ScheduleMessageDialog)**:
   - Data e hora futura
   - Recorrencia: diaria, semanal (dias da semana selecionaveis), mensal, custom (intervalo em dias)
   - Condicao de fim: nunca, por data, por contagem
   - Delay anti-bloqueio: nenhum, 5-10s, 10-20s (aleatorio)
   - Persistencia: insere em `scheduled_messages` com status "pending", recipients como JSON

9. **Progresso de Envio**:
   - Card modal com barra de progresso, grupo/membro atual, tempo decorrido e estimado
   - Controles: Pausar (aguarda envio atual), Retomar, Cancelar
   - Resultados por grupo: sucesso/erro com detalhes
   - Auto-fechamento apos conclusao

10. **Persistencia**:
    - `saveBroadcastLog`: Salva log com upload de imagens de carrossel (base64 -> Storage -> URL publica)
    - `saveToHelpdesk`: Persiste cada mensagem enviada como mensagem de saida na conversa do contato no HelpDesk
    - Dados do log: tipo, conteudo, midia, carrossel, grupos, destinatarios (targeted/success/failed), duracao, delay, status

11. **Reenvio (via BroadcastHistoryPage)**:
    - Historico lista broadcast_logs com filtros (status, tipo, alvo, instancia, data, busca)
    - Botao "Reenviar" -> ResendOptionsDialog -> escolher destino (grupos ou leads) e excluir admins
    - sessionStorage armazena resendData -> Broadcaster ou LeadsBroadcaster restaura dados
    - Banner visual indica reenvio ativo com tipo de mensagem

12. **Criacao de Base de Leads (CreateLeadDatabaseDialog)**:
    - No Step 2 (selecao de grupos), botao "Criar Base"
    - Extrai membros nao-admin dos grupos selecionados
    - Deduplicacao por telefone
    - Salva como nova lead_database + entries
    - Disponivel para uso no modulo Broadcast (Leads)

13. **Edge Functions Utilizadas**:
    - `uazapi-proxy` com actions: `groups` (listar grupos), `send-message` (texto), `send-media` (midia), `send-carousel` (carrossel com retry em missing-field), `send-audio` (audio PTT)
    - Autenticacao: JWT + resolucao de token via `resolveInstanceToken` (verifica user_roles + user_instance_access)

14. **Fluxos Operacionais**:
    - Envio completo: Instancia -> Grupos -> Compor -> Enviar (loop com delay) -> Log salvo
    - Envio individual: Instancia -> Grupos -> Excluir Admins (ParticipantSelector) -> Compor -> Loop por membro regular -> Log salvo
    - Agendamento: Instancia -> Grupos -> Compor -> Agendar -> scheduled_messages -> Edge Function processa na hora
    - Reenvio: Historico -> Reenviar -> Wizard pre-preenchido
    - Criar base: Step 2 -> Criar Base -> Extrai nao-admins -> Salva lead_database

15. **Regras de Negocio**:
    - Delay padrao entre envios: 350ms (grupo), 500ms entre grupos
    - Carrossel: retry automatico em erro "missing field" com campo title adicionado
    - Deduplicacao de participantes: mesmo JID em multiplos grupos conta uma vez
    - LID-only: participantes sem numero de telefone real identificados com badge
    - Numeros mascarados (00000000000) sao ignorados na normalizacao
    - Upload de carrossel: imagens base64 convertidas para File e uploadadas para carousel-images bucket

### Detalhes de Implementacao

- `broadcast-groups-prd.ts` exporta `broadcastGroupsPrdContent` como template literal Markdown
- `DocumentationTab.tsx`: importar `broadcastGroupsPrdContent`, mudar status para `complete`, versao `v1.0`, data `2026-03-03`
- Seguir mesmo padrao de formatacao dos PRDs existentes (admin-prd, helpdesk-prd, kanban-prd, broadcast-leads-prd)

