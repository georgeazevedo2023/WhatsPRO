---
title: Enquetes e NPS — Respostas, Auto-Tags e Renderizacao
tags: [enquetes, polls, webhook, poll_update, auto-tags, helpdesk, renderizacao, votos]
sources: [supabase/functions/whatsapp-webhook/index.ts, src/components/helpdesk/MessageBubble.tsx]
updated: 2026-05-04
---

# Enquetes e NPS — Respostas, Auto-Tags e Renderizacao

> O que acontece **depois** que a enquete sai: como o webhook recebe o voto, como auto-tags sao aplicadas por opcao escolhida, e como a enquete + voto sao renderizados no chat do helpdesk.

Sub-funcionalidades cobertas: **12.4** Rastreamento de Respostas (poll_update), **12.5** Auto-Tags por Opcao (D2), **12.6** Exibicao no Helpdesk.

Ver tambem: [[wiki/casos-de-uso/enquetes-nps-detalhado]] (indice), [[wiki/casos-de-uso/enquetes-nps-criacao-canais]] (criacao), [[wiki/casos-de-uso/enquetes-nps-metricas-admin]] (NPS + dashboard)

---

## 12.4 Rastreamento de Respostas (Webhook poll_update)

**O que e:** Quando o lead vota na enquete, o WhatsApp envia um evento `poll_update` para o webhook. O sistema registra o voto e executa acoes automaticas.

**O que acontece quando o lead vota:**
1. UAZAPI envia evento `poll_update` com: messageId, voter (JID), selectedOptions[]
2. Webhook busca a enquete original por messageId na tabela `poll_messages`
3. Upsert do voto em `poll_responses` (se ja votou, atualiza opcoes)
4. Se a enquete tem **auto-tags (D2)**, aplica tags na conversa baseado na opcao escolhida
5. Se a enquete pertence a um funil, dispara **motor de automacao** (trigger poll_answered)
6. Se a IA esta ativa na conversa, dispara **debounce do AI Agent** para a IA reagir ao voto
7. Insere mensagem no helpdesk para historico ("Lead votou: Manha")

**Cenario completo:** Enquete "Qual horario prefere?" enviada. Lead toca "Manha". Webhook recebe → salva voto → aplica tag `horario:manha` (auto-tag) → dispara automacao "quando poll respondida → mover card para Agendamento" → IA ve o voto e diz "Otimo! Anotei que voce prefere manha. Vamos confirmar o dia?"

> **Tecnico:** Webhook event `poll_update` em whatsapp-webhook/index.ts (linhas 256-429). Parse: `eventType === 'poll_update'`, extract messageId/voter/selectedOptions. Lookup: `poll_messages WHERE message_id = X`. Upsert: `poll_responses` com `onConflict: 'poll_message_id,voter_jid'`. Auto-tags D2: `poll_messages.auto_tags` JSONB map (option→tag), replace same-key via Map. Automacao: `executeAutomationRules(funnel_id, 'poll_answered', {poll_id, options})`. AI debounce: se status_ia ligada/shadow, POST para ai-agent-debounce fire-and-forget. Helpdesk msg: INSERT conversation_messages direction='incoming' content=options.join(', ').

---

## 12.5 Auto-Tags por Opcao (D2)

**O que e:** Ao criar a enquete, o admin pode configurar: "se o lead escolher opcao X, aplicar tag Y automaticamente". Isso permite segmentacao automatica baseada nas respostas.

**Exemplo de configuracao:**
```
Opcao "Excelente" → tag "sentimento:positivo"
Opcao "Ruim" → tag "sentimento:negativo"
Opcao "Causa Animal" → tag "tema:animal"
```

**Como funciona:** Quando o voto chega, o webhook verifica se a enquete tem auto_tags. Se tiver, busca a tag correspondente a opcao votada e aplica na conversa (substituindo tags com mesma chave).

> **Tecnico:** Campo `poll_messages.auto_tags` JSONB (map: string→string). No webhook poll_update: `const autoTags = pollMsg.auto_tags || {}`. Para cada opcao votada, busca tag no map. Aplica via tag Map dedup (replace same key prefix). UPDATE conversations.tags.

---

## 12.6 Exibicao no Helpdesk (Renderizacao)

**O que e:** Quando uma enquete e enviada ou votada, ela aparece no chat do helpdesk com visual proprio — nao como texto, mas com icone de grafico + pergunta + opcoes em cards.

**Visual:**
- Icone de grafico de barras (BarChart3) ao lado da pergunta
- Pergunta em negrito
- Opcoes como cards individuais com borda e fundo sutil
- Indicador: circulo vazio (○) para escolha unica, quadrado vazio (☐) para multipla
- Texto "Selecao multipla" abaixo das opcoes quando aplicavel

> **Tecnico:** MessageBubble.tsx: `media_type === 'poll'` → parse `media_url` como JSON (question, options, selectable_count). Render: BarChart3 icon 3.5x3.5, options em div bg-muted/30 border, selectable_count===0 → '☐', else → '○'. Memo: `useMemo` para parse do JSON.

---

## Links Relacionados

- [[wiki/casos-de-uso/enquetes-nps-detalhado]] — Indice das 10 sub-funcionalidades
- [[wiki/casos-de-uso/enquetes-nps-criacao-canais]] — PollEditor + 4 canais + endpoint UAZAPI
- [[wiki/casos-de-uso/enquetes-nps-metricas-admin]] — NPS automatico + dashboard + config admin
- [[wiki/casos-de-uso/helpdesk-detalhado]] — Renderizacao no chat + TicketResolutionDrawer agenda NPS
- [[wiki/casos-de-uso/motor-automacao-detalhado]] — Trigger poll_answered

---

*Rev 1 (2026-05-04): Sub-wiki criada a partir do particionamento de enquetes-nps-detalhado.md (regra 14).*
