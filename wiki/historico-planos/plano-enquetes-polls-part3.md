---
title: Plano Enquetes/Polls (parte 3)
type: plano-historico
updated: 2026-05-11
---

# Plano Enquetes/Polls — parte 3/5

> Plano shipado. Read-only.

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

