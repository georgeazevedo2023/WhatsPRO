---
title: Agendamentos — Documentacao Detalhada
tags: [agendamentos, scheduling, recorrente, mensagens, detalhado]
sources: [src/components/group/ScheduleMessageDialog.tsx, supabase/functions/process-scheduled-messages/]
updated: 2026-04-10
---

# Agendamentos — Mensagens Programadas e Recorrentes (6 Sub-Funcionalidades)

> O modulo de Agendamentos permite **programar mensagens** para serem enviadas automaticamente em data/hora especificas. Pode ser uma unica vez ("enviar amanha as 8h") ou recorrente ("toda segunda as 9h"). Funciona como um despertador de mensagens — voce programa e o sistema envia sozinho, sem ninguem precisar estar no computador.
>
> Ver tambem: [[wiki/casos-de-uso/broadcast-detalhado]] (broadcast com agendamento), [[wiki/modulos]]

---

## 13.1 Agendamento Unico (One-Time)

**O que e:** Programa uma mensagem para ser enviada uma unica vez numa data e hora especificas.

**Como funciona:** Seleciona data e hora (formato dd/MM/yyyy HH:mm) → escolhe grupo destino → mensagem fica salva com status "pendente" → no horario programado, a edge function `process-scheduled-messages` envia automaticamente.

**Cenario:** Gerente prepara aviso "Reuniao amanha as 14h" na quinta → agenda para sexta 8h → sexta de manha a mensagem e enviada sem ninguem clicar.

> **Tecnico:** Dialog `ScheduleMessageDialog.tsx`. Campo `scheduled_at` TIMESTAMPTZ. Status: 'pending' ate envio → 'completed' ou 'failed'. Tabela `scheduled_messages` com `is_recurring=false`. Edge function `process-scheduled-messages` roda via pg_cron, busca `next_run_at <= now() AND status='pending'` (limit 50).

---

## 13.2 Agendamento Recorrente

**O que e:** Programa mensagens que se repetem automaticamente — diariamente, semanalmente ou mensalmente.

**Tipos de recorrencia:**
- **Diario** — a cada N dias (ex: todo dia, a cada 3 dias)
- **Semanal** — em dias especificos da semana (ex: toda segunda e quarta)
- **Mensal** — a cada N meses (ex: todo mes, a cada 2 meses)

**Condicoes de parada:**
- **Nunca** — repete indefinidamente ate ser cancelada
- **Data especifica** — para numa data (ex: ate 31/12/2026)
- **Apos N execucoes** — para apos X envios (ex: apos 10 vezes)

**Cenario:** "Todo domingo as 18h, enviar 'Bom domingo!' para o grupo VIP" → recorrencia semanal, dia domingo, hora 18:00, nunca para.

> **Tecnico:** Campos: `is_recurring` BOOL, `recurrence_type` (daily/weekly/monthly), `recurrence_interval` INT (1-99), `recurrence_days` INT[] (0=dom...6=sab), `recurrence_end_at` TIMESTAMPTZ, `recurrence_count` INT, `end_type` (never/date/count). Calculo proximo envio: `calculateNextRun()` — daily: +N dias, weekly: proximo dia da semana no array, monthly: +N meses. `shouldContinueRecurrence()` checa end_at/count. Apos envio, status volta para 'pending' com `next_run_at` atualizado (nao 'completed').

---

## 13.3 Delay Aleatorio (Anti-Ban)

**O que e:** Intervalo aleatorio entre cada envio quando a mensagem vai para multiplos destinatarios (modo excluir admins). Evita bloqueio pelo WhatsApp.

**Opcoes:** Nenhum (350ms fixo), 5-10 segundos, 10-20 segundos.

> **Tecnico:** Campo `random_delay` ('none'|'5-10'|'10-20'). Funcao `getRandomDelay()` retorna ms aleatorio no range. Aplicado entre cada recipient na edge function.

---

## 13.4 Tipos de Mensagem Agendavel

**Texto e midia** podem ser agendados. Carrossel e enquete ainda nao suportam agendamento.

| Tipo | Agendavel? | Via |
|------|-----------|-----|
| Texto | ✅ | `scheduleText()` |
| Imagem | ✅ | `scheduleMedia()` |
| Video | ✅ | `scheduleMedia()` |
| Audio | ✅ | `scheduleMedia()` |
| Documento | ✅ | `scheduleMedia()` |
| Carrossel | ❌ | Toast "nao suportado ainda" |
| Enquete | ❌ | Toast "nao suportado ainda" |

> **Tecnico:** Hooks `scheduleText()` e `scheduleMedia()` em `useBroadcastSend.ts`. Edge function `process-scheduled-messages` envia via UAZAPI `/send/text` ou `/send/media`. Media types: image, video, audio, ptt, document com caption e filename opcionais.

---

## 13.5 Gestao de Agendamentos

**O que e:** Pagina para ver, pausar, retomar e cancelar mensagens agendadas.

**Status possiveis:** Pendente (aguardando), Processando (enviando), Concluido, Falhou, Cancelado, Pausado.

**Acoes:** Pausar (pendente→pausado), Retomar (pausado→pendente), Cancelar (→cancelado).

**Exibe:** Preview da mensagem, proximo envio, info de recorrencia, delay anti-ban, historico de execucoes com sucesso/parcial/falha.

> **Tecnico:** Pagina `ScheduledMessages.tsx`. Historico: tabela `scheduled_message_logs` (scheduled_message_id FK CASCADE, executed_at, status success/partial/failed, recipients_total/success/failed, error_message, response_data JSONB). Campos: `executions_count`, `last_executed_at`, `last_error`.

---

## 13.6 Edge Function de Processamento

**O que e:** Funcao que roda automaticamente (via pg_cron) e verifica se existem mensagens prontas para enviar.

**Fluxo:**
1. Busca ate 50 mensagens com `next_run_at <= agora` e status 'pending'
2. Marca como 'processing'
3. Para cada mensagem: envia via UAZAPI, registra log
4. Se unica: marca 'completed'. Se recorrente: calcula proximo envio e volta para 'pending'

> **Tecnico:** Edge function `process-scheduled-messages/index.ts`. Query: `scheduled_messages WHERE next_run_at <= now() AND status = 'pending' LIMIT 50`. Send: `sendTextMessage()` ou `sendMediaMessage()` via UAZAPI. Log: INSERT `scheduled_message_logs`. Recorrencia: `calculateNextRun()` + `shouldContinueRecurrence()`. Status management: processing → completed/failed (unico) ou pending com next_run_at atualizado (recorrente).

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `scheduled_messages` | Mensagens programadas (tipo, conteudo, data, recorrencia, status, delay) |
| `scheduled_message_logs` | Historico de execucoes (status, recipients, erros) |

---

## Links Relacionados

- [[wiki/casos-de-uso/broadcast-detalhado]] — Broadcast com agendamento
- [[wiki/modulos]] — Todos os 17 modulos

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico)*
