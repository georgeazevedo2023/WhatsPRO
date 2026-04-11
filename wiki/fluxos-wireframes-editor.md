---
title: G5 Wireframes — FlowEditor 5 Tabs + Métricas
tags: [wireframes, ux, fluxos, editor, metricas, g5]
updated: 2026-04-11
---

# Wireframes: FlowEditor + Dashboard Métricas

---

## `/flows/:id` — FlowEditor

### Header + Shadow Banner
```
[SHADOW] SDR Comercial     ● Ativo · v3 · Editado há 2h     [⋯ Opções]

⚠ MODO SHADOW ATIVO — A IA está observando mas NÃO está respondendo aos leads
```
Banner amarelo persistente quando `mode='shadow'`.

### 5 Tabs
```
[ Identidade ] [ Gatilhos ] [ Subagentes ] [ Inteligência ] [ Publicar ]
```

---

## Tab 1 — Identidade

```
Nome          [ SDR Comercial                    ] (inline edit)
Slug          [ sdr-comercial                    ]
Descrição     [ Qualifica leads para consultoria ]
Instância     [ wsmart-principal ] (readonly)

Modo de operação:
  ● IA Ativa  ○ IA Assistente  ○ Shadow ⚠  ○ Desligado

Funil vinculado:    [ ▾ Nenhum ]
Fluxo padrão:       ☑ Sim
```
- Mudar para Shadow → modal confirmação + banner aparece imediatamente

---

## Tab 2 — Gatilhos

```
Gatilhos                                          [ + Adicionar ]

≡  ● Palavra-chave: "oi", "olá"      P:10  ∞    [Editar] [✕]
≡  ● Intent: lead_created            P:5   ∞    [Editar] [✕]

Fluxo fallback (sem gatilho ativo):
[ ▾ Nenhum — lead não entra em nenhum fluxo ]
```
- Drag ≡ para reordenar prioridade
- P = prioridade, ∞ = sem cooldown

---

## Tab 3 — Subagentes

### Lista de Steps (drag-and-drop)
```
≡ Step 1: Saudação (greeting)           [Configurar] [↓] [✕]
≡ Step 2: Qualificação (qualification)  [Configurar] [↓] [✕]
≡ Step 3: Vendas (sales)               [Configurar] [↓] [✕]

[ + Adicionar step ]
```

### Painel de Configuração por Step (formulário dinâmico)

**Saudação:**
```
Extrair nome:      ● Ativo ○ Passivo
Profundidade:      ○ Minimal ● Standard ○ Deep
Mensagem retorno:  [ Bem-vindo de volta, {nome}! ]
Contagem sessões:  ☑ Diferenciar novo vs retornante
```

**Qualificação:**
```
Perguntas (drag p/ reordenar):
  1. [ Qual seu cargo? ] Tipo: [text ▾] Obrigatória: ☑
  2. [ Quantos colaboradores? ] Tipo: [select ▾] Obrigatória: ☑
  [ + Adicionar pergunta ]

Max perguntas:     [ 5  ]
Smart Fill:        ☑ Pular perguntas já conhecidas (90 dias)
Modo:              ● Fixo  ○ Adaptativo
Após conclusão:    [ ▾ Avançar para próximo step ]
```

**Vendas:**
```
Modo exibição:     ● Carrossel  ○ Produto único
Recomendação:      ● Exact  ○ Smart  ○ Upsell
Max produtos:      [ 10 ]
                   [⚙ Avançado (JSON)]
```

**Exit Rules (todos os steps):**
```
REGRAS DE SAÍDA
┌─────────────────────────────────────────────────────┐
│ ☑ Máx. mensagens: após [ 10 ] msgs → Handoff humano│
│ ☑ Sem resposta: após [ 60 ] min → Followup auto    │
│ ☑ Intent cancelamento → Optout LGPD + fechar       │
│ ☐ Qualificação concluída → Próximo step            │
│ ☐ Timeout sessão → Fechar conversa                  │
│                      [ + Regra personalizada (JSON)]│
└─────────────────────────────────────────────────────┘
```

---

## Tab 4 — Inteligência (Parâmetros Globais)

```
P3 Audio         Entrada: ● Mirror ○ Always ○ Never ○ Ask
                 Saída: ● Never ○ Always ○ Mirror

P4 Idioma        ● Auto-detectar  ○ Fixar: [▾ pt-BR]

P5 Validador     ☑ Detectar prompt leak
                 ☑ Bloquear PII em resposta
                 ☑ Verificar preço vs catálogo
                 Score mínimo: [ 6 ] /10
                 Falhas consecutivas: [ 3 ] → Handoff

P8 Lead Score    ☑ Ativo  Peso cargo: [30%] empresa: [40%] intent: [30%]
```
- Configurações de Memory (TTL) ficam em P1 (Qualificação), não aqui

---

## Tab 5 — Publicar

```
Status atual: ● Publicado (v3)  [Despublicar]

Histórico de versões:
  v3 · 2026-04-11 14:32 · "Adicionou step de Vendas"    [Restaurar]
  v2 · 2026-04-10 09:15 · "Ajuste nas perguntas"        [Restaurar]
  v1 · 2026-04-09 17:00 · "Publicação inicial"          [Restaurar]

Checklist antes de publicar:
  ✅ Tem pelo menos 1 gatilho
  ✅ Tem pelo menos 1 step
  ✅ Step 1 tem exit rule configurada
  ⚠ Modo Shadow: banner habilitado?

Zona de perigo:
  [ Arquivar fluxo ]  [ Excluir fluxo ]
```

---

## `/flows/:id/metrics` — Dashboard

### KPI Cards
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 342          │ │ 67%          │ │ 12%          │ │ R$41,04      │
│ Iniciados    │ │ Concluídos   │ │ Handoff      │ │ Custo total  │
│ este mês     │ │ com sucesso  │ │ humano       │ │ (R$0,12/conv)│
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### Timing Breakdown (pizza)
```
Reconhecimento  50ms  ██ 3%
Memória        100ms  ████ 6%
LLM            800ms  ████████████████████████████ 49%
Validador      200ms  ████████ 12%
TTS            500ms  ████████████████████ 30%
```

### Top 10 Intents + Funil de Conversão
```
Top Intents:                    Funil:
1. produto    (38%)             Iniciados    342  ████████████
2. orcamento  (21%)             Qualificados 229  ████████
3. suporte    (15%)             Vendas       156  ██████
4. generico   (11%)             Concluídos   229  ████████
5. agendamento (8%)             Handoff       41  ██
```

### Compartilhar
```
[ 🔗 Gerar link público (30 dias) ]
→ https://app.whatspro.com.br/reports/abc123
```
Diferencial: George pode compartilhar métricas com clientes sem dar acesso ao admin.

---

[[wiki/fluxos-wireframes-admin]] | [[wiki/fluxos-wireframes-guiada]] | [[wiki/fluxos-roadmap-sprints]]
