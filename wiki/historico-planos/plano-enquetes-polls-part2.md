---
title: Plano Enquetes/Polls (parte 2)
type: plano-historico
updated: 2026-05-11
---

# Plano Enquetes/Polls — parte 2/5

> Plano shipado. Read-only.

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

