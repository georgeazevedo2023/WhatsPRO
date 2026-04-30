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

## 2. Mapa de Uso — Onde Enquetes Entram

### 2.1 Broadcast / Disparador (M3)

**Nova aba "Enquete" ao lado de Texto, Midia, Carrossel.**

| Caso | Exemplo Concreto |
|------|-----------------|
| Pesquisa de interesse pre-lancamento | `[Imagem Eletropiso] Qual desses produtos voce quer comprar em nossa live com descontos de ate 50%?` → Pisos / Luminarias / Casa / Tintas / "Ou me conta aqui" |
| Segmentacao de base por preferencia | "Qual causa voce mais apoia?" → 4 causas → tags automaticas |
| Confirmacao de presenca em evento | "Voce vem ao workshop?" → Sim / Talvez / Nao |
| Consulta de horario preferido | "Qual horario melhor para voce?" → Manha / Tarde / Noite |
| NPS pos-evento | "O que achou do evento?" → Excelente / Bom / Regular / Ruim |

**Fluxo completo do exemplo Eletropiso:**
```
Admin → Broadcast → aba Enquete
  → [x] Enviar imagem antes → seleciona logo Eletropiso
  → Pergunta: "Qual desses produtos voce quer comprar..."
  → Opcoes: Pisos, Luminarias, Casa, Tintas
  → [x] Auto-tags: Pisos→interesse:pisos, Luminarias→interesse:luminarias...
  → [x] Ativar IA apos resposta: SIM
  → [x] Vincular ao funil: "Live Eletropiso" (funil tipo venda)
  → Enviar para: Lead Group "Clientes Ativos" (500 leads)
```

Quando lead vota "Pisos e Porcelanatos":
1. Tag automatica: `interesse:pisos`
2. AI Agent ativado automaticamente (poll_update → ai-agent-debounce)
3. Agent: "Otimo! Ja registrei que voce esta interessado em Pisos e Porcelanatos! De qual cidade/bairro voce e?"
4. Se funil vinculado: lead entra no funil "Live Eletropiso" com tag `funil:live-eletropiso`

### 2.2 AI Agent / Helpdesk (M10)

**Nova tool `send_poll` — 9a ferramenta do agente.**

#### A) Qualificar interesse de produtos

```
Lead: "Voces tem tinta?"
Agent: "Ola [Nome], temos sim! Qual dessas voce procura?"
[send_poll] "Qual tipo de tinta?"
→ Latex (para paredes internas)
→ Acrilica (para areas externas)
→ Esmalte (para metais e madeira)
→ Outra / Quero que me explique

Lead toca "Latex"
→ auto_tag: interesse:latex
→ Agent: "Otimo! Temos varias opcoes de latex. Para que comodo seria?"
→ [send_poll] "Qual ambiente?"
→ Quarto / Sala / Cozinha / Banheiro / Area externa
```

O agente encadeia polls para qualificar progressivamente, sem depender de texto livre.

#### B) Transbordo com escolha de vendedor

```
Lead: "Otimo gostei desse esmalte sintetico da coral, qual o preco?"
Agent: "So um instante que vou te encaminhar para um de nossos vendedores!"

[send_poll] "Quem voce prefere?"
→ Joao (Tintas e Acabamentos)
→ Helena (Decoracao e Design)
→ Pedro (Grandes Volumes)
→ O que estiver mais disponivel

Lead toca "Helena"
→ handoff_to_human(assigned_to: helena_id, reason: "Lead escolheu Helena via poll")
→ Agent: "Pronto! A Helena ja esta a caminho. Ela esta pronta pra te atender :)"
```

**Logica:** Quando `poll_vendor_selection=true` e inbox tem 2+ atendentes, o agente consulta os atendentes online do departamento e monta as opcoes dinamicamente. Opcao "mais disponivel" = distribui via round-robin.

#### C) Pesquisa de satisfacao (NPS)

```
[Ticket resolvido via TicketResolutionDrawer]
→ 5 minutos depois, AI Agent ou sistema envia automaticamente:

[send_poll] "Como foi seu atendimento hoje?"
→ ⭐⭐⭐⭐⭐ Excelente - recomendaria
→ ⭐⭐⭐⭐ Bom - atendeu o esperado
→ ⭐⭐⭐ Regular - poderia melhorar
→ ⭐⭐ Ruim - fiquei insatisfeito
→ ⭐ Pessimo

Lead vota → poll_responses → update_lead_profile(satisfaction: N)
→ Dashboard: NPS medio por atendente
```

#### D) Vaga de emprego — triagem

```
Funil tipo "Vaga". Candidato chega pelo link.

Agent: "Ola! Que bom que se interessou pela vaga. Vamos comecar?"
[send_poll] "Qual area voce tem experiencia?"
→ Vendas e Atendimento
→ Logistica e Transporte
→ Administrativo
→ Tecnologia
→ Outra

Lead: "Vendas e Atendimento"
→ tag: area:vendas

[send_poll] "Qual sua disponibilidade?"
→ Integral (44h/semana)
→ Meio periodo
→ Fins de semana
→ Flexivel

Lead: "Integral"
→ tag: disponibilidade:integral
→ move_kanban("Triagem — Qualificados")
→ handoff para RH
```

### 2.3 Formularios WhatsApp (M12) — Campo tipo Poll

Novo `field_type: 'poll'` no form-bot. Em vez de pedir texto, envia enquete nativa.

**Antes (PROIBIDO — nunca mais):**
```
Bot: "Tipo do imovel? 1-Casa 2-Apto 3-Comercial"   ← NUNCA enviar assim
Lead: "apartamento"  ← bot nao entende
Lead: "2"            ← aceita na 2a tentativa
```

**Depois (campo tipo enquete):**
```
[send_poll] "Tipo do imovel?"
→ Casa
→ Apartamento
→ Sala Comercial
→ Outro
Lead toca "Apartamento" → campo preenchido → proximo campo
```

**REGRA D7:** NUNCA enviar opcoes numeradas ("1-Casa, 2-Apto"). Mesmo para campos `select` sem enquete, listar nomes limpos: "Casa, Apartamento, Sala Comercial". Numeros antes de opcoes confundem o cliente e parecem roboticos.

Zero erro de digitacao. Taxa de conclusao estimada: 45% → 78%.

### 2.4 Funis (M16) — Poll por Etapa + Motor de Automação (D8)

**SUBSTITUIDO pela decisao D8:** Em vez de polls fixos por etapa, o admin configura **regras de automacao** no funil. Cada regra segue o formato **Gatilho > Condicao > Acao**.

**UI: Tab "Automacoes" dentro do FunnelDetail** (ao lado de Canais, Formulário, Config).

#### Gatilhos disponíveis (7 — MVP)

| Gatilho | Quando dispara | Exemplo |
|---------|---------------|---------|
| Card movido para coluna | Lead avanca/retrocede no Kanban | "Quando card mover para Qualificado" |
| Enquete respondida | Lead vota em qualquer poll | "Quando lead responder enquete de interesse" |
| Formulário completo | Lead termina formulário WhatsApp | "Quando formulario de cadastro for preenchido" |
| Lead criado | Novo lead entra no funil | "Quando um novo lead entrar neste funil" |
| Conversa resolvida | Ticket marcado como resolvido | "Quando conversa for resolvida" |
| Tag adicionada | Qualquer tag é aplicada na conversa | "Quando tag interesse:tintas for adicionada" |
| Etiqueta aplicada | Label/etiqueta é aplicada na conversa | "Quando etiqueta Urgente for aplicada" |

#### Condições disponíveis (4 — MVP)

| Condição | O que verifica | Exemplo |
|----------|---------------|---------|
| Sempre | Executa sem filtro | (padrao) |
| Tag contém | Conversa tem tag específica | "Se tag contém interesse:tintas" |
| Funil é | Lead pertence a funil específico | "Se funil é Venda Tintas" |
| Horário comercial | Dentro/fora do expediente | "Se for horário comercial" |

#### Ações disponíveis (5 — MVP)

| Ação | O que faz | Exemplo |
|------|----------|---------|
| Enviar enquete | Manda poll nativo pro lead | "Enviar enquete Faixa de Orçamento" |
| Enviar mensagem | Manda texto pro lead | "Enviar Bem-vindo ao nosso funil!" |
| Mover card | Move card no Kanban | "Mover para coluna Qualificado" |
| Adicionar tag | Aplica tag na conversa | "Adicionar tag qualificado:sim" |
| Ativar IA / Transbordo | Liga IA ou transfere pra humano | "Ativar IA com prompt do funil" |

#### Exemplo visual — Funil "Venda Tintas" com 4 regras

```
Tab: [Canais] [Formulário] [Automações ✨] [Config]

┌──────────────────────────────────────────────────────────┐
│ Regras de Automação                        [+ Nova Regra]│
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Regra 1: Qualificação na entrada                         │
│ QUANDO: [Lead criado              ▾]                     │
│ SE:     [Sempre                   ▾]                     │
│ ENTÃO:  [Enviar enquete           ▾] → "O que busca?"    │
│                                              [Editar] [🗑]│
│                                                          │
│ Regra 2: Orçamento após qualificação                     │
│ QUANDO: [Card movido para coluna  ▾] → "Qualificado"    │
│ SE:     [Tag contém               ▾] → "interesse:tintas"│
│ ENTÃO:  [Enviar enquete           ▾] → "Faixa de preço?" │
│                                              [Editar] [🗑]│
│                                                          │
│ Regra 3: IA após responder enquete                       │
│ QUANDO: [Enquete respondida       ▾]                     │
│ SE:     [Sempre                   ▾]                     │
│ ENTÃO:  [Ativar IA                ▾] → prompt do funil   │
│                                              [Editar] [🗑]│
│                                                          │
│ Regra 4: NPS após venda                                  │
│ QUANDO: [Card movido para coluna  ▾] → "Vendido"        │
│ SE:     [Sempre                   ▾]                     │
│ ENTÃO:  [Enviar enquete           ▾] → NPS (5 estrelas)  │
│                                              [Editar] [🗑]│
│                                                          │
└──────────────────────────────────────────────────────────┘
```

#### Exemplos por tipo de funil

| Tipo Funil | Regras típicas |
|------------|---------------|
| Venda | Lead criado→enquete "O que busca?", Card→Qualificado→enquete "Orçamento?", Card→Vendido→NPS |
| Captação | Lead criado→enquete "Como nos conheceu?", Enquete respondida→ativar IA, Tag adicionada→mover card |
| Vaga | Lead criado→enquete "Área?", Formulário completo→mover card "Triagem", Card→Entrevista→msg "RH vai te ligar" |
| Evento | Lead criado→enquete "Confirma presença?", Conversa resolvida→NPS |
| Atendimento | Etiqueta "Urgente"→transbordo imediato, Conversa resolvida→NPS, Tag "reclamacao"→notificar gerente |

### 2.5 Campanhas UTM (M7) — Poll como primeira interacao

Quando lead chega pelo link UTM e `poll_qualification_enabled=true`, AI Agent dispara poll de qualificacao como primeira mensagem (apos boas-vindas).

### 2.6 Campanha Politica — Pesquisa de Opiniao

Broadcast para eleitores com auto-segmentacao:
```
[Imagem: Anderson na comunidade]
"Qual problema mais afeta o seu bairro?"
→ Animais abandonados
→ Filas nos postos
→ Seguranca publica
→ Escolas precarias
→ Ruas esburacadas
```
Votos → tags automaticas → mapa de calor por bairro no dashboard.

---

## 3. Configuracao no Admin — Tudo Configuravel

### 3.1 Novos Campos em `ai_agents`

| Campo | Tipo | Default | Descricao |
|-------|------|---------|-----------|
| `poll_enabled` | BOOLEAN | false | Habilita tool send_poll |
| `poll_qualification_enabled` | BOOLEAN | true | Usa polls para qualificacao SDR |
| `poll_nps_enabled` | BOOLEAN | false | NPS automatico pos-ticket |
| `poll_nps_delay_minutes` | INT | 5 | Delay antes de enviar NPS |
| `poll_nps_question` | TEXT | "Como foi seu atendimento?" | Pergunta do NPS |
| `poll_nps_options` | JSONB | ["Excelente","Bom","Regular","Ruim","Pessimo"] | Opcoes |
| `poll_vendor_selection` | BOOLEAN | false | Transbordo com escolha de vendedor |
| `poll_vendor_fallback_option` | TEXT | "O que estiver mais disponivel" | Ultima opcao do poll de vendedor |
| `poll_image_before` | BOOLEAN | false | Envia imagem antes do poll (workaround) |
| `poll_templates` | JSONB | [] | Templates de enquete reutilizaveis |
| `poll_auto_trigger_ai` | BOOLEAN | true | Ativa IA automaticamente apos voto |

### 3.2 Templates de Polls (poll_templates JSONB)

```json
[
  {
    "id": "qualificacao_compra",
    "name": "Qualificacao de Compra",
    "question": "Qual e o seu momento?",
    "options": ["Quero comprar agora", "Estou pesquisando", "Quero orcamento", "Sou revendedor"],
    "selectableCount": 1,
    "auto_tags": {
      "Quero comprar agora": ["motivo:compra", "urgencia:alta"],
      "Estou pesquisando": ["motivo:pesquisa"],
      "Quero orcamento": ["motivo:orcamento"],
      "Sou revendedor": ["perfil:revendedor"]
    },
    "auto_kanban": {
      "Quero comprar agora": "Hot Leads"
    },
    "auto_trigger_ai": true,
    "context": "qualificacao"
  },
  {
    "id": "tipo_produto",
    "name": "Tipo de Produto",
    "question": "Qual tipo de produto voce busca?",
    "options": ["Tintas", "Pisos e Porcelanatos", "Luminarias", "Utilidades"],
    "selectableCount": 1,
    "auto_tags": {
      "Tintas": ["interesse:tintas"],
      "Pisos e Porcelanatos": ["interesse:pisos"],
      "Luminarias": ["interesse:luminarias"],
      "Utilidades": ["interesse:utilidades"]
    },
    "auto_trigger_ai": true,
    "context": "qualificacao"
  },
  {
    "id": "nps",
    "name": "NPS Pos-Atendimento",
    "question": "Como foi seu atendimento?",
    "options": ["Excelente", "Bom", "Regular", "Ruim", "Pessimo"],
    "selectableCount": 1,
    "auto_tags": {
      "Excelente": ["nps:5"], "Bom": ["nps:4"], "Regular": ["nps:3"],
      "Ruim": ["nps:2"], "Pessimo": ["nps:1"]
    },
    "auto_trigger_ai": false,
    "context": "satisfacao"
  },
  {
    "id": "selecao_vendedor",
    "name": "Escolha de Vendedor",
    "question": "Quem voce prefere para te atender?",
    "options": [],
    "dynamic_options_from": "inbox_users",
    "selectableCount": 1,
    "auto_trigger_ai": false,
    "context": "transbordo"
  },
  {
    "id": "triagem_vaga",
    "name": "Triagem de Vaga",
    "question": "Qual area voce tem experiencia?",
    "options": ["Vendas", "Logistica", "Administrativo", "Tecnologia", "Outra"],
    "selectableCount": 1,
    "auto_tags": {
      "Vendas": ["area:vendas"], "Logistica": ["area:logistica"],
      "Administrativo": ["area:administrativo"], "Tecnologia": ["area:tecnologia"]
    },
    "context": "vaga"
  }
]
```

### 3.3 UI do Admin — Secao "Enquetes" na aba Inteligencia

```
┌──────────────────────────────────────────────────────────┐
│ 📊 Enquetes (Polls)                          [🟢 Ativo] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Qualificacao                                             │
│ ☑ Usar enquetes para qualificar leads                   │
│   (em vez de perguntas em texto livre — clique > digitar)│
│                                                          │
│ Transbordo Inteligente                                   │
│ ☑ Lead escolhe o vendedor via enquete                   │
│   Opcao fallback: [O que estiver mais disponivel    ]   │
│                                                          │
│ NPS Automatico                                           │
│ ☑ Enviar NPS apos resolver ticket                       │
│   Delay: [5] minutos                                    │
│   Pergunta: [Como foi seu atendimento?             ]    │
│   Opcoes: [Excelente] [Bom] [Regular] [Ruim] [+]      │
│                                                          │
│ Opcoes Avancadas                                         │
│ ☐ Enviar imagem antes do poll (workaround visual)       │
│ ☑ Ativar IA automaticamente apos voto                   │
│                                                          │
│ Templates de Enquete                     [+ Novo]       │
│ ┌──────────────────────────────────────────────────┐    │
│ │ 📋 Qualificacao de Compra          [Editar] [🗑] │    │
│ │ 📋 Tipo de Produto                 [Editar] [🗑] │    │
│ │ ⭐ NPS Pos-Atendimento             [Editar] [🗑] │    │
│ │ 👤 Escolha de Vendedor (dinamico)  [Editar] [🗑] │    │
│ │ 💼 Triagem de Vaga                 [Editar] [🗑] │    │
│ └──────────────────────────────────────────────────┘    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 3.4 UI do Broadcast — Aba Enquete

```
Tabs: [ Texto | Midia | Carrossel | 📊 Enquete ]

┌──────────────────────────────────────────────────────────┐
│ Criar Enquete                                            │
│                                                          │
│ Template: [Selecione ou crie do zero...          ▾]     │
│                                                          │
│ ☐ Enviar imagem antes da enquete                        │
│   [📷 Selecionar imagem...]                             │
│   Legenda: [Eletropiso - Live com ate 50% off!    ]     │
│                                                          │
│ Pergunta: (max 255 chars)                                │
│ [Qual desses produtos voce quer comprar em nossa li]    │
│                                                          │
│ Opcoes: (min 2, max 12)                                  │
│ [1. Pisos e Porcelanatos              ] [🗑]            │
│ [2. Luminarias e Lustres              ] [🗑]            │
│ [3. Casa e Utilidades                 ] [🗑]            │
│ [4. Tintas                            ] [🗑]            │
│ [+ Adicionar opcao]                                      │
│                                                          │
│ Modo: (●) Escolha unica  (○) Multipla escolha           │
│                                                          │
│ ☑ Auto-aplicar tags baseado na resposta                 │
│   Pisos → [interesse:pisos             ]                │
│   Luminarias → [interesse:luminarias   ]                │
│   Casa → [interesse:utilidades         ]                │
│   Tintas → [interesse:tintas           ]                │
│                                                          │
│ ☑ Ativar IA automaticamente apos resposta               │
│ ☐ Vincular ao funil: [Selecione...           ▾]        │
│                                                          │
│ Preview:                                                 │
│ ┌────────────────────────────────┐                      │
│ │ [🖼 Imagem Eletropiso]         │                      │
│ │ Eletropiso - Live com ate 50%! │                      │
│ ├────────────────────────────────┤                      │
│ │ 📊 Qual desses produtos voce   │                      │
│ │    quer comprar em nossa live?  │                      │
│ │ ○ Pisos e Porcelanatos         │                      │
│ │ ○ Luminarias e Lustres         │                      │
│ │ ○ Casa e Utilidades            │                      │
│ │ ○ Tintas                       │                      │
│ └────────────────────────────────┘                      │
│                                                          │
│     [Enviar Agora]   [Agendar]   [Salvar Template]      │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Schema do Banco

### 4.1 poll_messages

```sql
CREATE TABLE poll_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES whatsapp_instances(id),
  message_id TEXT NOT NULL,              -- ID retornado pela UAZAPI
  question TEXT NOT NULL,
  options JSONB NOT NULL,                -- ["Pisos", "Luminarias", "Tintas"]
  selectable_count INT DEFAULT 1,        -- 1=unica | 0=multipla
  context TEXT DEFAULT 'manual',         -- 'ai_agent' | 'broadcast' | 'manual' | 'nps' | 'form' | 'funnel'
  auto_tags JSONB,                       -- {"Pisos":["interesse:pisos"], "Tintas":["interesse:tintas"]}
  image_url TEXT,                        -- URL da imagem enviada antes (workaround)
  funnel_id UUID REFERENCES funnels(id), -- se vinculado a funil
  template_id TEXT,                      -- ID do template usado (se aplicavel)
  created_by UUID REFERENCES auth.users(id),
  tenant_id UUID NOT NULL,
  total_votes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_poll_messages_conversation ON poll_messages(conversation_id);
CREATE INDEX idx_poll_messages_message_id ON poll_messages(message_id);
CREATE INDEX idx_poll_messages_tenant ON poll_messages(tenant_id);
CREATE INDEX idx_poll_messages_context ON poll_messages(context);
```

### 4.2 poll_responses

```sql
CREATE TABLE poll_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_message_id UUID REFERENCES poll_messages(id) ON DELETE CASCADE,
  voter_jid TEXT NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  selected_options JSONB NOT NULL,       -- ["Pisos e Porcelanatos"]
  previous_options JSONB,                -- opcoes anteriores (se mudou voto)
  tags_applied JSONB,                    -- tags que foram auto-aplicadas
  voted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_message_id, voter_jid)     -- upsert quando muda voto
);

CREATE INDEX idx_poll_responses_poll ON poll_responses(poll_message_id);
CREATE INDEX idx_poll_responses_voter ON poll_responses(voter_jid);
CREATE INDEX idx_poll_responses_contact ON poll_responses(contact_id);
```

### 4.3 RLS

```sql
ALTER TABLE poll_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_poll_messages" ON poll_messages
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_poll_responses" ON poll_responses
  FOR ALL USING (
    poll_message_id IN (SELECT id FROM poll_messages WHERE tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()))
  );
```

### 4.4 automation_rules (Motor de Automação — D8)

```sql
CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                          -- "Qualificação na entrada"
  enabled BOOLEAN DEFAULT true,
  position INT DEFAULT 0,                      -- ordem de execução
  -- GATILHO (QUANDO)
  trigger_type TEXT NOT NULL,                  -- 'card_moved' | 'poll_answered' | 'form_completed' | 'lead_created' | 'conversation_resolved' | 'tag_added' | 'label_applied'
  trigger_config JSONB DEFAULT '{}',           -- {"column_id":"uuid"} | {"tag":"interesse:tintas"} | {"label":"Urgente"}
  -- CONDIÇÃO (SE)
  condition_type TEXT DEFAULT 'always',        -- 'always' | 'tag_contains' | 'funnel_is' | 'business_hours'
  condition_config JSONB DEFAULT '{}',         -- {"tag":"interesse:tintas"} | {"funnel_id":"uuid"} | {"inside":true}
  -- AÇÃO (ENTÃO)
  action_type TEXT NOT NULL,                   -- 'send_poll' | 'send_message' | 'move_card' | 'add_tag' | 'activate_ai' | 'handoff'
  action_config JSONB DEFAULT '{}',            -- {"poll_template_id":"qualificacao"} | {"message":"Bem-vindo!"} | {"column_id":"uuid"} | {"tag":"qualificado:sim"}
  -- Meta
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_automation_rules_funnel ON automation_rules(funnel_id);
CREATE INDEX idx_automation_rules_trigger ON automation_rules(trigger_type);
CREATE INDEX idx_automation_rules_tenant ON automation_rules(tenant_id);

-- RLS
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_automation_rules" ON automation_rules
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
```

### 4.5 Campos em ai_agents

```sql
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_enabled BOOLEAN DEFAULT false;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_qualification_enabled BOOLEAN DEFAULT true;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_nps_enabled BOOLEAN DEFAULT false;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_nps_delay_minutes INT DEFAULT 5;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_nps_question TEXT DEFAULT 'Como foi seu atendimento?';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_nps_options JSONB DEFAULT '["Excelente","Bom","Regular","Ruim","Pessimo"]';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_vendor_selection BOOLEAN DEFAULT false;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_vendor_fallback_option TEXT DEFAULT 'O que estiver mais disponivel';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_image_before BOOLEAN DEFAULT false;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_templates JSONB DEFAULT '[]';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_auto_trigger_ai BOOLEAN DEFAULT true;
```

---

## 5. Fases e Tasks Detalhados

### Fase 1 — Motor de Automacao (a estrada)

**Objetivo:** Construir o motor Gatilho > Condicao > Acao. Ao final: admin cria regras no funil, engine executa automaticamente. Tudo que vier depois (enquetes, NPS, mensagens) e apenas um tipo de acao/gatilho.

| # | Task | Arquivo(s) | O que fazer |
|---|------|-----------|-------------|
| 1.1 | **Migration: automation_rules** | `supabase/migrations/2026XXXX_automation.sql` | Tabela automation_rules conforme schema 4.4. RLS. Indices. Campos `funnel_prompt` TEXT + `handoff_rule` TEXT na tabela `funnels`. |
| 1.2 | **Types.ts: regenerar** | `src/integrations/supabase/types.ts` | `npx supabase gen types typescript` — NUNCA editar manual. |
| 1.3 | **automationEngine.ts (backend)** | `supabase/functions/_shared/automationEngine.ts` | Funcao `executeAutomationRules(funnelId, triggerType, triggerData, supabaseClient)`. Carrega regras ativas do funil, filtra por trigger_type, avalia condicoes, executa acoes. Retorna log de execucao. |
| 1.4 | **Acoes do engine** | mesmo arquivo | Implementar 5 acoes: `send_message` (texto via proxy), `move_card` (update kanban_cards), `add_tag` (mergeTags), `activate_ai` (set status_ia + debounce), `handoff` (assign + notify). Acao `send_poll` fica como placeholder (implementada na F4). |
| 1.5 | **Condicoes do engine** | mesmo arquivo | 4 avaliadores: `always` (true), `tag_contains` (checa tags da conversa), `funnel_is` (checa funnel_id), `business_hours` (checa horario semanal do agente). |
| 1.6 | **Integrar engine nos triggers** | webhook + form-bot + kanban hooks | Ao mover card: `executeAutomationRules(funnelId, 'card_moved', {column_id})`. Ao completar form: `'form_completed'`. Ao resolver conversa: `'conversation_resolved'`. Ao adicionar tag: `'tag_added'`. Ao aplicar etiqueta: `'label_applied'`. Lead criado no funil: `'lead_created'`. |
| 1.7 | **useAutomationRules hook** | `src/hooks/useAutomationRules.ts` | CRUD React Query: list by funnel_id, create, update, delete, reorder (position). |
| 1.8 | **AutomationRulesTab component** | `src/components/funnels/AutomationRulesTab.tsx` | Tab "Automacoes" no FunnelDetail. Lista regras com cards visuais (QUANDO/SE/ENTAO). Botao "+ Nova Regra". Toggle enable/disable. Reorder via drag ou setas. |
| 1.9 | **AutomationRuleEditor component** | `src/components/funnels/AutomationRuleEditor.tsx` | Dialog para criar/editar regra. 3 selects cascateados: Gatilho (7 opcoes) → config dinamica, Condicao (4 opcoes) → config dinamica, Acao (5 opcoes) → config dinamica. Preview textual: "Quando X, se Y, entao Z". |
| 1.10 | **FunnelDetail: tab Automacoes** | `src/pages/dashboard/FunnelDetail.tsx` | Adicionar 4a tab "Automacoes" com AutomationRulesTab. |
| 1.11 | **Testes** | `src/lib/__tests__/automationEngine.test.ts` | Testes do engine: regra com cada trigger, cada condicao, cada acao. Edge cases: regra desabilitada, condicao falsa, acao falhando. |

**Criterio de aceite F1:** Admin cria regras no funil (ex: "Quando card mover para Qualificado, se tag contem interesse:tintas, entao enviar mensagem 'Otimo!'"). Engine executa automaticamente ao evento ocorrer. 4 das 5 acoes funcionais (send_poll = placeholder).

---

### Fase 2 — Funis Agenticos (o GPS)

**Objetivo:** Cada funil ganha seu proprio "roteiro" que a IA segue obrigatoriamente. A IA se comporta diferente em cada funil.

| # | Task | Arquivo(s) | O que fazer |
|---|------|-----------|-------------|
| 2.1 | **FunnelDetail: UI de roteiro** | `src/pages/dashboard/FunnelDetail.tsx` | Tab Config: textarea "Roteiro da IA" (funnel_prompt). Placeholder com exemplo. Textarea "Regra de transbordo" (handoff_rule) com select: so_se_pedir / apos_n_msgs / nunca + campo departamento. |
| 2.2 | **AI Agent: injetar funnel_instructions** | `supabase/functions/ai-agent/index.ts` | Quando tag `funil:SLUG` detectada: carregar funnels WHERE slug=SLUG. Se `funnel_prompt` preenchido → injetar `<funnel_instructions>` no system prompt com PRIORIDADE sobre prompt_sections do agente. Se `handoff_rule` → sobrescrever regra de handoff do agente. |
| 2.3 | **AI Agent: handoff por funil** | mesmo arquivo | `handoff_rule = 'apos_n_msgs'` → usar `max_messages_before_handoff` do funil (nao do agente). `handoff_rule = 'nunca'` → desativar handoff automatico. `handoff_department` → transbordo pro dept especifico. |
| 2.4 | **useFunnelConfig hook** | `src/hooks/useFunnelConfig.ts` | Hook para ler/salvar funnel_prompt + handoff_rule + handoff_department. |
| 2.5 | **Templates de roteiro por tipo** | `src/lib/funnelPromptTemplates.ts` | 7 templates default: venda ("qualifique interesse, apresente produtos, feche venda"), vaga ("pergunte area, disponibilidade, encaminhe RH"), captacao, evento, sorteio, lancamento, atendimento. Admin pode editar. |
| 2.6 | **Wizard: pre-preencher roteiro** | `src/components/funnels/FunnelWizard.tsx` | Passo do wizard oferece template de roteiro baseado no tipo de funil escolhido. Admin pode aceitar ou customizar. |
| 2.7 | **Testes** | `src/lib/__tests__/funnelPrompt.test.ts` | Teste de injecao de funnel_instructions. Teste de prioridade funil > agente. Teste de handoff_rule override. |

**Criterio de aceite F2:** Admin escreve roteiro no funil "Venda Tintas": "1) Pergunte o que o lead busca. 2) Se tinta, pergunte cor e ambiente. 3) Apresente opcoes. 4) Tente fechar." IA segue esse roteiro quando lead entra nesse funil — mesmo que o prompt geral do agente diga outra coisa.

---

### Fase 3 — Tags & Integracao (as placas)

**Objetivo:** Tags e etiquetas viram linguagem universal entre modulos. activateFunnel() centralizado. ActionSelector reutilizavel.

| # | Task | Arquivo(s) | O que fazer |
|---|------|-----------|-------------|
| 3.1 | **activateFunnel() centralizado** | `supabase/functions/_shared/funnelActivator.ts` | Funcao unica: mergeTags(`funil:SLUG`), criar kanban card na primeira coluna, disparar `executeAutomationRules(funnelId, 'lead_created')`. Chamada por form-public, bio-public, webhook (utm match), ai-agent. Substitui logica duplicada. |
| 3.2 | **Integrar activateFunnel nos modulos** | form-public, bio-public, whatsapp-webhook | Substituir logica manual de tag funil:SLUG + kanban card por chamada a activateFunnel(). Garante consistencia: todo lead que entra em funil passa pelo mesmo caminho. |
| 3.3 | **Tag trigger no engine** | `_shared/automationEngine.ts` + webhook/ai-agent | Quando mergeTags() e chamado em qualquer lugar: detectar se algum funil tem regra com trigger 'tag_added' para aquela tag. Se sim, executar. Idem para 'label_applied'. |
| 3.4 | **Auto-tag function** | `supabase/functions/_shared/autoTag.ts` | `generateAutoTag(text)`: normaliza texto → tag. "Pisos e Porcelanatos" → `interesse:pisos`. Usado por enquetes (D2), broadcasts, forms. |
| 3.5 | **ActionSelector component** | `src/components/shared/ActionSelector.tsx` | Componente reutilizavel: select com 5 acoes (IA/funil/form/handoff/nada) + config por acao. Plugavel em enquete, broadcast, bio link, campanha. |
| 3.6 | **Integrar ActionSelector** | BroadcastMessageForm, PollEditor, BioLinkEditor | Cada modulo que dispara acao ganha ActionSelector para definir o que acontece apos interacao do lead. Unifica UX. |
| 3.7 | **Testes** | `src/lib/__tests__/funnelActivator.test.ts` | Testes de activateFunnel, auto-tag, tag trigger no engine. |

**Criterio de aceite F3:** Lead submete formulario → activateFunnel() cria card + taga + dispara automacoes do funil. Admin configura no broadcast: "apos responder, ativar funil X" via ActionSelector. Auto-tags funcionam em todos os modulos.

---

### Fase 4 — Enquetes / Polls (um veiculo na estrada)

**Prerequisito OBRIGATORIO:** Task 4.1 (teste ao vivo do endpoint UAZAPI).

**Objetivo:** Enquetes nativas do WhatsApp. Ao final: admin envia polls pelo broadcast, IA usa polls para qualificar/transbordar, form-bot usa campo poll, helpdesk renderiza. Tudo plugado no motor de automacao (F1).

| # | Task | Arquivo(s) | O que fazer |
|---|------|-----------|-------------|
| 4.1 | **Teste ao vivo: confirmar endpoint** | manual | Enviar POST /send/poll via curl pra UAZAPI. Confirmar que funciona. Ter alguem votar e capturar payload do webhook. Confirmar nome do evento (poll_update vs poll.vote). |
| 4.2 | **Migration: poll_messages + poll_responses + campos ai_agents** | `supabase/migrations/2026XXXX_polls.sql` | Tabelas conforme schema 4.1, 4.2, 4.3. ALTER TABLE ai_agents conforme 4.5. 11 campos poll_* novos. |
| 4.3 | **Types.ts: regenerar** | types.ts | Regenerar com novas tabelas + campos. |
| 4.4 | **uazapi-proxy: send-poll + send-poll-with-image** | `supabase/functions/uazapi-proxy/index.ts` | 2 novos cases. Validar: 2-12 opcoes, question, selectableCount. send-poll-with-image: send/media → 1.5s → send/poll. Salvar em poll_messages. |
| 4.5 | **webhook: handler poll_update** | `supabase/functions/whatsapp-webhook/index.ts` | Detectar poll_update/poll.vote. UPSERT poll_response. Aplicar auto_tags. broadcastEvent. Chamar `executeAutomationRules(funnelId, 'poll_answered', {poll_id, options})`. Se poll_auto_trigger_ai → ai-agent-debounce. |
| 4.6 | **Engine: acao send_poll** | `_shared/automationEngine.ts` | Implementar acao 'send_poll' (placeholder da F1). Envia poll via proxy usando poll_template_id da action_config. |
| 4.7 | **AI Agent: tool send_poll** | `supabase/functions/ai-agent/index.ts` | 9a tool. Def + exec. POST /send/poll. Salvar em conversation_messages + poll_messages. broadcastEvent. sideEffectTools. |
| 4.8 | **AI Agent: transbordo com poll** | mesmo arquivo | poll_vendor_selection=true + 2+ atendentes → poll com nomes do dept. Resposta → handoff com assigned_to. Se 1 atendente → handoff direto texto. |
| 4.9 | **AI Agent: prompt poll_rules** | mesmo arquivo | Instrucoes: "Usar enquete para qualificacao, opcoes claras. NAO usar para perguntas abertas." |
| 4.10 | **Broadcast: aba Enquete** | BroadcastMessageForm + LeadMessageForm | 4a aba. PollEditor + PollTemplateSelector + ActionSelector. |
| 4.11 | **PollEditor component** | `src/components/broadcast/PollEditor.tsx` | Pergunta + opcoes (add/remove, 2-12) + unica/multipla + auto-tags editaveis + checkbox imagem + preview. |
| 4.12 | **form-bot: field_type poll** | `supabase/functions/form-bot/index.ts` | Quando field_type='poll': send/poll, aguardar poll_update, mapear voto ao campo. NUNCA opcoes numeradas. |
| 4.13 | **MessageBubble: render poll** | `src/components/helpdesk/MessageBubble.tsx` | media_type='poll' → card com pergunta, opcoes, checkmarks. media_type='poll_response' → "Lead votou: X". |
| 4.14 | **Hooks + Types frontend** | `src/hooks/usePolls.ts`, `src/types/polls.ts` | React Query hooks + interfaces TS. broadcastSender: sendPollToNumber(). |
| 4.15 | **Testes** | `src/lib/__tests__/polls.test.ts` | Validacao opcoes, AI Agent tool, broadcast, render, form-bot. |

**Criterio de aceite F4:** Admin envia enquete pelo broadcast. IA usa poll para qualificar e transbordar. Form-bot envia enquete nativa. Helpdesk mostra polls. Votos disparam automacoes do motor (F1). NUNCA opcoes numeradas.

---

### Fase 5 — NPS + Metricas + Polish (painel de controle)

**Objetivo:** NPS automatico, dashboard de metricas, config admin, templates, CSV. Camada de inteligencia sobre tudo que foi construido.

| # | Task | Arquivo(s) | O que fazer |
|---|------|-----------|-------------|
| 5.1 | **NPS automatico via motor** | Regra default no motor | Ao resolver ticket: engine executa regra `'conversation_resolved' → send_poll(nps_template)`. Delay via job_queue (poll_nps_delay_minutes). Guard: nao enviar se tags contem sentimento:negativo. |
| 5.2 | **NPS nota ruim → notifica gerente** | webhook + notifications | Poll response com nota <=2: insert notificacao para gerentes da inbox. Toast/alerta no painel. |
| 5.3 | **PollConfigSection** | `src/components/admin/PollConfigSection.tsx` | Toggle geral + qualificacao + transbordo + NPS (pergunta, opcoes, delay). Conforme wireframe secao 3.3. |
| 5.4 | **PollTemplateEditor** | `src/components/admin/PollTemplateEditor.tsx` | Editor modal: nome, pergunta, opcoes, auto-tags, auto-kanban, context. Salva em poll_templates JSONB. |
| 5.5 | **AIAgentTab: ALLOWED_FIELDS + integrar** | `src/components/admin/AIAgentTab.tsx` | 11 campos poll_* no ALLOWED_FIELDS. PollConfigSection na aba Inteligencia. |
| 5.6 | **PollMetricsCard** | `src/components/dashboard/PollMetricsCard.tsx` | Total polls, total votos, taxa de resposta, top opcao. |
| 5.7 | **PollNpsChart** | `src/components/dashboard/PollNpsChart.tsx` | NPS medio, distribuicao, ranking por atendente. |
| 5.8 | **Dashboard: integrar** | DashboardHome ou Intelligence | PollMetricsCard + PollNpsChart. |
| 5.9 | **usePollMetrics hook** | `src/hooks/usePollMetrics.ts` | React Query: metricas agregadas de polls. |
| 5.10 | **Exportar CSV** | PollDetailChart | Botao CSV: pergunta, opcoes, votos, %, tags. |
| 5.11 | **Testes finais** | `src/lib/__tests__/` | NPS flow, metricas, config admin, CSV. |
| 5.12 | **Documentacao final** | CLAUDE.md, PRD.md, vault | Atualizar tudo com padroes de poll, automation engine, funis agenticos. |

**Criterio de aceite F5:** NPS envia automaticamente apos resolver ticket (via motor). Nota ruim notifica gerente. Dashboard mostra metricas de polls e NPS. Admin configura tudo no painel. CSV exportavel.

---

## 6. Checklist SYNC RULE (8 locais)

Cada fase DEVE verificar:

| # | Local | Fase |
|---|-------|------|
| 1 | **Banco** — automation_rules (F1), funnels.funnel_prompt (F1), poll_messages/responses (F4), poll_* em ai_agents (F4) | F1, F4 |
| 2 | **Types.ts** — Row/Insert/Update de novas tabelas + campos | F1, F4 |
| 3 | **Admin UI** — AutomationRulesTab (F1), FunnelConfig roteiro (F2), PollConfigSection + PollTemplateEditor (F5) | F1, F2, F5 |
| 4 | **ALLOWED_FIELDS** — 11 campos poll_* | F5 |
| 5 | **Backend (ai-agent)** — funnel_instructions (F2), tool send_poll (F4), sideEffectTools, prompt | F2, F4 |
| 6 | **Backend (engine)** — automationEngine.ts + integracao nos triggers | F1, F3, F4 |
| 7 | **system_settings defaults** — defaults de poll_templates para novos agentes | F5 |
| 8 | **Documentacao** — CLAUDE.md + PRD.md + memory + vault | Todas |

---

## 7. Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|---------------|---------|-----------|
| Endpoint /send/poll nao existe na UAZAPI v2 | Media | Alto | Task 1.1: testar ANTES de tudo. Se falhar, contactar suporte UAZAPI ou enviar via Baileys direto |
| Webhook poll_update nao chega ou formato diferente | Media | Alto | Task 1.1: capturar webhook real. Handler aceita multiplos event names |
| Lead muda voto (duplicata) | Baixa | Baixo | UPSERT com ON CONFLICT (poll_message_id, voter_jid) |
| WhatsApp rate limit em polls em massa | Media | Medio | Respeitar delays de broadcast (5-20min entre lotes) |
| Poll nao funciona em WhatsApp Business Cloud API | Certa | Info | Documentar que funciona apenas via UAZAPI. NAO e limitacao do WhatsPRO |
| NPS enviado em momento ruim (lead irritado) | Baixa | Medio | Delay configuravel + nao enviar se conversa teve handoff por frustração |
| Transbordo: vendedor escolhido fica offline | Media | Medio | Fallback: se vendedor nao responde em 2min, redirecionar para disponivel |

---

## 8. Arquivos que Serao Criados/Modificados

### Novos (~22 arquivos)
```
# F1 — Motor de Automacao
supabase/migrations/2026XXXX_automation.sql
supabase/functions/_shared/automationEngine.ts
src/hooks/useAutomationRules.ts
src/components/funnels/AutomationRulesTab.tsx
src/components/funnels/AutomationRuleEditor.tsx
src/lib/__tests__/automationEngine.test.ts

# F2 — Funis Agenticos
src/hooks/useFunnelConfig.ts
src/lib/funnelPromptTemplates.ts
src/lib/__tests__/funnelPrompt.test.ts

# F3 — Tags & Integracao
supabase/functions/_shared/funnelActivator.ts
supabase/functions/_shared/autoTag.ts
src/components/shared/ActionSelector.tsx
src/lib/__tests__/funnelActivator.test.ts

# F4 — Enquetes
supabase/migrations/2026XXXX_polls.sql
src/types/polls.ts
src/hooks/usePolls.ts
src/components/broadcast/PollEditor.tsx
src/components/broadcast/PollTemplateSelector.tsx
src/lib/__tests__/polls.test.ts

# F5 — NPS + Metricas
src/hooks/usePollMetrics.ts
src/components/admin/PollConfigSection.tsx
src/components/admin/PollTemplateEditor.tsx
src/components/dashboard/PollMetricsCard.tsx
src/components/dashboard/PollNpsChart.tsx
```

### Modificados (~14 arquivos)
```
# F1
src/pages/dashboard/FunnelDetail.tsx           — 4a tab Automacoes

# F2
supabase/functions/ai-agent/index.ts           — funnel_instructions + handoff rule
src/components/funnels/FunnelWizard.tsx         — pre-preencher roteiro

# F3
supabase/functions/form-public/index.ts        — usar activateFunnel()
supabase/functions/bio-public/index.ts          — usar activateFunnel()
supabase/functions/whatsapp-webhook/index.ts    — usar activateFunnel() + poll_update + tag triggers
src/components/broadcast/BroadcastMessageForm.tsx — ActionSelector

# F4
supabase/functions/uazapi-proxy/index.ts       — case send-poll + send-poll-with-image
supabase/functions/ai-agent/index.ts           — tool send_poll + transbordo
supabase/functions/form-bot/index.ts           — field_type poll
src/components/helpdesk/MessageBubble.tsx       — render poll + poll_response
src/lib/broadcastSender.ts                     — sendPollToNumber
src/components/broadcast/BroadcastMessageForm.tsx — 4a aba Enquete
src/components/broadcast/LeadMessageForm.tsx    — 4a aba Enquete

# F5
src/components/admin/AIAgentTab.tsx             — ALLOWED_FIELDS + PollConfigSection
src/pages/dashboard/DashboardHome.tsx           — PollMetricsCard + PollNpsChart
src/integrations/supabase/types.ts              — regenerar via CLI (F1 e F4)
```

---

*Documentado em: 2026-04-08*
*Autor: Claude Code + George Azevedo*
*Status: Plano detalhado — 8 decisoes aprovadas, 5 fases definidas*
*Proximo passo: Fase 1 (Motor de Automacao) — nao depende de teste UAZAPI*
*Pre-requisito do UAZAPI: necessario apenas na Fase 4 (Task 4.1)*
