---
title: Plano Enquetes/Polls (parte 1)
type: plano-historico
description: M17 Enquetes/Polls (parte 1) — decisões + especificação técnica
updated: 2026-05-11
---

# Plano Enquetes/Polls — parte 1/5

> Plano shipado. Read-only.

---
title: Plano M17 — Plataforma Inteligente (Automacao + Funis Agenticos + Tags + Enquetes)
tags: [polls, enquete, automacao, funis-agenticos, tags, motor, plano, ai-agent, broadcast, qualificacao, nps, transbordo]
updated: 2026-04-08
---

# Plano M17 — Plataforma Inteligente

> **4 Pilares:** Motor de Automacao | Funis Agenticos | Tags & Integracao | Enquetes (Polls)
> Status: **Em discussao** — decisoes sendo tomadas com o usuario.
> Fases: 5 (F1: Motor, F2: Funis Agenticos, F3: Tags & Integracao, F4: Enquetes, F5: NPS + Metricas)
> Modulos afetados: AI Agent, Broadcast, Forms, Funis, Webhook, Helpdesk, Dashboard, Kanban/CRM

### Visao Geral — Por que essa ordem

```
F1 Motor de Automacao    ← sistema nervoso autonomo (reflexos)
F2 Funis Agenticos       ← instintos (comportamento por situacao)
F3 Tags & Integracao     ← sinapses (conexoes entre orgaos)
F4 Enquetes (Polls)      ← novo sentido (tato — botoes clicaveis)
F5 NPS + Metricas        ← exame de sangue (medir saude do corpo)

Logica: reflexos primeiro, features depois. Cada feature nova vira
apenas mais um reflexo/instinto — sem codigo especifico.
```

**Arquitetura de UI aprovada (D9):**
```
AI Agent (cerebro) = config GLOBAL, 1x
  Personalidade, catalogo, regras gerais, voz, validator

Funil (esqueleto) = config POR FUNIL, Nx
  Tab Canais      — de onde o lead vem
  Tab Formulario  — o que o lead preenche
  Tab Automacoes  — reflexos (QUANDO/SE/ENTAO)
  Tab IA          — instintos (roteiro + transbordo)
  Tab Config      — ajustes gerais do funil
```

### Dependencias entre fases

```
F1 (Motor) ──→ F2 (Funis Agenticos) ──→ F3 (Tags & Integracao)
                                              │
                                              ▼
                                         F4 (Enquetes)
                                              │
                                              ▼
                                         F5 (NPS + Metricas)
```

---

## DECISOES APROVADAS (sessao 2026-04-08)

| # | Topico | Decisao | Impacto |
|---|--------|---------|---------|
| D1 | Enquete com imagem | **Opcao C — Checkbox no broadcast** ("Enviar imagem antes"). Admin decide caso a caso. Sistema envia send/media + 1.5s + send/poll. | UI do broadcast precisa de checkbox + campo de upload de imagem + campo de legenda. Proxy precisa de action `send-poll-with-image`. |
| D2 | Tags automaticas | **Opcao B — IA gera tag automatica + admin pode editar**. Sistema sugere tag baseado no texto da opcao (ex: "Pisos e Porcelanatos" → `interesse:pisos`). Admin pode sobrescrever. Se nao mexer, tag automatica funciona. | PollEditor precisa de campo auto-tag pre-preenchido por opcao (editavel). Backend precisa de funcao `generateAutoTag(optionText)` que normaliza texto → tag. |
| D3 | Roteamento de fluxos | **Gap identificado + solucao aprovada.** (1) Criar funcao `activateFunnel()` centralizada (mergeTags + kanbanCard + triggerForm). (2) Componente `ActionSelector` reutilizavel (5 acoes: IA/funil/form/handoff/nada). (3) Plugar em enquete, broadcast, bio link, campanha. 90% das pecas ja existem. | Sprint 1: activateFunnel() shared. Sprint 2: ActionSelector na UI da enquete. Sprint futuro: plugar em broadcast texto/midia/carrossel, bio link, campanha. |
| D4 | Prompt dedicado por funil | **Usuario quer roteiro passo-a-passo por funil que a IA segue obrigatoriamente.** Admin escreve prompt no FunnelDetail (tab Config ou nova tab "IA"). IA recebe `<funnel_instructions>` com PRIORIDADE sobre prompt geral do agente. Inclui regra de transbordo por funil (so_se_pedir / apos_n_msgs / nunca) e departamento. | Novos campos na tabela funnels: `funnel_prompt` TEXT + `handoff_rule` TEXT. UI: textarea no FunnelDetail. Backend: ai-agent injeta `<funnel_instructions>` quando detecta tag funil:SLUG. Prioridade: funnel_prompt > prompt_sections do agente. |
| D5 | Transbordo com vendedor | **(A) Nomes vem do departamento** — Departamento > Vendas > lista atendentes. Sem especialidade visivel, so nome. **(B) Fallback com timeout** — se escolhido nao responde em X min (config), redistribui automaticamente e avisa lead. **(C) Opcao "mais disponivel" sempre presente** — round-robin. **Regra: so enquete se 2+ vendedores no dept.** Se 1 so, handoff direto por texto. | Tool send_poll consulta dept atendentes. Se >=2: envia enquete. Se 1: handoff texto. poll_vendor_fallback_timeout campo novo em ai_agents. Fallback redistribui via round-robin. |
| D6 | NPS Automatico | **(A) Apos resolver ticket** — delay configuravel (5min default). NAO envia se conversa teve handoff por frustracao. **(B) Escala 5 opcoes** — Excelente/Bom/Regular/Ruim/Pessimo com estrelas. **(C) Nota ruim (1-2) = registra + notifica gerente** — toast/alerta ao gerente para agir rapido. | Trigger: conversa status→resolved. Job queue agenda envio apos poll_nps_delay_minutes. Guard: nao enviar se tags contem `sentimento:negativo` ou handoff por frustracao. Nota <=2: insert notificacao para gerentes da inbox. Dashboard: NPS medio por atendente + ranking. |
| D7 | Campo enquete no formulário WhatsApp | **Opcao A — Novo tipo "enquete"**. Quando formulario chega em campo de multipla escolha, bot envia enquete nativa (botoes clicaveis) em vez de texto numerado. **Regra absoluta: NUNCA enviar opcoes numeradas (1-Casa, 2-Apto).** Sempre listar nomes limpos (Casa, Apartamento). | Novo `field_type: 'poll'` no form-bot. form-bot detecta tipo, chama send/poll em vez de sendText. Opcoes vem do campo `options[]`. Resposta do lead via poll_update preenche o campo e avanca. Campos `select` existentes tambem devem listar nomes sem numeros. |
| D8 | Motor de Automação MVP | **Opcao B — Motor simplificado (Gatilho > Condicao > Acao).** Admin configura regras visuais dentro do funil. Começa com gatilhos essenciais e expande depois. UI = tab "Automacoes" dentro do FunnelDetail (3 selects: Gatilho + Condicao + Acao). NAO e drag-and-drop complexo. | Tabela `automation_rules` (trigger, condition, action, funnel_id). UI: FunnelDetail nova tab "Automacoes". Backend: `automation-engine` processa regras. **7 gatilhos iniciais:** card movido, enquete respondida, formulario completo, lead criado, conversa resolvida, tag adicionada, etiqueta aplicada. **4 condicoes:** tag contem, funil e, horario comercial, sempre. **5 acoes:** enviar enquete, enviar mensagem, mover card, adicionar tag, ativar IA/transbordo. |
| D9 | UI: Motor + Agêntico dentro do Funil | **Opcao A — Tudo no Funil.** Motor de Automação (reflexos) e Funis Agênticos (instintos) ficam AMBOS dentro do FunnelDetail. AI Agent page = config global (personalidade, catalogo, regras gerais). Funil = config por contexto. Analogia: cerebro (AI Agent) e unico, mas cada situacao (funil) tem seus proprios instintos e reflexos. | FunnelDetail ganha 2 tabs novas: "Automacoes" (Gatilho>Condicao>Acao) + "IA" (roteiro + regra de transbordo). Admin configura tudo em 1 pagina por funil. AI Agent page nao precisa de seção "por funil". |

---

### Analogia do Corpo Humano

```
🧠 Cerebro (AI Agent)         = pensa, decide, responde — config GLOBAL, 1x
💀 Esqueleto (Funis)          = estrutura, organiza caminho — config POR FUNIL
❤️ Coracao (Banco de Dados)    = bombeia dados para todos os orgaos
🫁 Pulmoes (Broadcast)         = alcança muita gente de uma vez
⚡ Sist. Nervoso (Webhook)     = leva sinais de um lugar pro outro
👄 Boca (WhatsApp/UAZAPI)     = ponto de contato com o mundo
✋ Maos (Tools)                = cerebro decide, maos executam
👁️ Olhos (Helpdesk)            = admin enxerga tudo em tempo real
🧬 Memoria (Lead Profiles)     = lembra de quem ja veio

🆕 Sist. Nervoso Autonomo (Motor de Automacao)  = reflexos automaticos
   "Lead entrou → enviar enquete" (voce nao PENSA para respirar)
🆕 Instintos (Funis Agenticos)                  = comportamento por situacao
   "Funil de Venda → instinto de VENDER"
   "Funil de Vaga → instinto de RECRUTAR"

Cerebro = 1 (global). Instintos = N (1 por funil).
Reflexos ficam no esqueleto (funil), nao no cerebro.
```

---

## 1. Especificacao Tecnica

### 1.1 Endpoint UAZAPI

```
POST /send/menu
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999",
  "type": "poll",                                 // tipo de mensagem interativa
  "text": "Qual produto prefere?",                // max 255 chars (era "question")
  "choices": ["Opcao A", "Opcao B", "Opcao C"],   // 2-12 opcoes, max 100 chars cada (era "options")
  "selectableCount": 1                             // 1 = unica escolha | 0 = multipla
}
```
> **NOTA (2026-04-09):** Endpoint original documentado como `/send/poll` estava ERRADO. Corrigido para `/send/menu` com `type: 'poll'`. Campos renomeados: `question`→`text`, `options`→`choices`.

### 1.2 Limitacoes do Protocolo WhatsApp

| Limite | Valor |
|--------|-------|
| Opcoes por enquete | **2 a 12** |
| Chars por pergunta | **max 255** |
| Chars por opcao | **max 100** |
| Imagem embutida no poll | **NAO SUPORTADO** (limitacao do protocolo, campo nao existe no PollCreationMessage protobuf) |
| Voto anonimo | **NAO** — em grupos todos veem quem votou |
| Mudar voto | **SIM** — lead pode trocar voto, gera novo evento |
| Disponibilidade | WhatsApp pessoal + APIs nao-oficiais (Baileys/uazapiGO). **NAO** na Cloud API oficial |

### 1.3 Enquete com Imagem (Workaround)

O protocolo **NAO** permite imagem embutida na enquete. O PollCreationMessage no protobuf nao tem campo de midia.

**Workaround implementado no proxy:**
```
1. POST /send/media  → imagem com legenda (ex: logo da loja)
2. aguarda 1-2s
3. POST /send/menu (type=poll)  → enquete logo em seguida
```
No chat do lead: imagem em cima, enquete embaixo — experiencia visual integrada.

**Variante futura (WhatsApp beta):** Imagens por OPCAO do poll (nao no header) — disponivel apenas em Channels, ainda nao na API.

### 1.4 Webhook de Resposta de Voto

Quando lead vota, UAZAPI dispara webhook com resultados **agregados** (nao individuais):

```json
{
  "event": "poll_update",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": true,
      "id": "3EB0ABC123DEF456"
    },
    "pollResult": [
      { "name": "Pisos e Porcelanatos", "voters": ["5511999@s.whatsapp.net"] },
      { "name": "Luminarias e Lustres", "voters": [] },
      { "name": "Casa e Utilidades", "voters": [] },
      { "name": "Tintas", "voters": ["5521888@s.whatsapp.net"] }
    ]
  },
  "timestamp": 1753278982097
}
```

**Nota:** Nome exato do evento (`poll_update` vs `poll.vote`) precisa ser confirmado via teste ao vivo com UAZAPI. O webhook handler deve aceitar ambos.

---

