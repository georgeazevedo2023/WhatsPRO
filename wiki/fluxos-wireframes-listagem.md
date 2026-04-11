---
title: G5 Wireframes — Listagem + Seleção de Modo
tags: [wireframes, ux, fluxos, listagem, g5]
updated: 2026-04-11
---

# Wireframes: `/flows` + `/flows/new` Seleção

---

## Tela 1 — `/flows` Listagem

### Header
```
[ Fluxos ]                              [ + Criar Fluxo ]
Gerencie seus fluxos de atendimento
```

### Filter Bar
```
[ 🔍 Buscar fluxo... ] [ Modo ▾ ] [ Status ▾ ] [ Template ▾ ]

Tabs: Todos (12) | Ativos (7) | Rascunho (3) | Shadow (2) | Arquivados (0)
```

### Card Anatomy (por fluxo)
```
┌─────────────────────────────────────────────────┐
│ [ATIVO] [FORMULÁRIO]          ● Publicado 3d    │
│ SDR Comercial                                   │
│ Qualifica leads e agenda demo                   │
│                                                 │
│ 3 gatilhos · 5 steps · 127 leads este mês       │
│ Custo médio: R$0,12/conversa                    │
│                                     [Editar] [⋮]│
└─────────────────────────────────────────────────┘
```

### Badges de Modo (4 variantes)
| Badge | Cor | Descrição |
|-------|-----|-----------|
| `[ATIVO]` | Verde | IA Ativa — responde leads |
| `[ASSISTENTE]` | Azul | IA Assistente — sugere para atendente |
| `[SHADOW]` + borda amarela | Amarelo | Shadow — observa sem responder |
| `[RASCUNHO]` | Cinza | Não publicado |

### Shadow Banner (quando shadow ativo)
```
⚠ MODO SHADOW ATIVO — A IA está observando mas NÃO está respondendo aos leads
```
Banner amarelo sticky no topo da página.

### Estados Especiais
- **Vazio:** Ícone + "Nenhum fluxo criado ainda" + botão "Criar primeiro fluxo"
- **Loading:** 3 skeleton cards
- **Erro:** Toast destrutivo + botão Tentar novamente

### Menu `⋮` por card
- Editar · Duplicar · Publicar/Pausar · Testar (Playground) · Ver métricas · Arquivar

---

## Tela 2 — `/flows/new` Seleção de Modo

### Header
```
[ ← Voltar ]  Criar novo fluxo
              Escolha como quer construir
```

### 3 Cards de Modo
```
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│ 📋 Formulário          │  │ ⚡ Templates            │  │ 💬 Conversa Guiada     │
│                        │  │                        │  │         [Em breve]     │
│ Configure cada etapa   │  │ Comece com um template │  │ A IA monta o fluxo     │
│ manualmente com total  │  │ pré-configurado e       │  │ em uma conversa        │
│ controle               │  │ customize depois        │  │ interativa             │
│                        │  │                        │  │                        │
│ Melhor para: equipes   │  │ Melhor para: começar   │  │ Melhor para: usuários  │
│ com processo definido  │  │ rápido com boas         │  │ que preferem descrever │
│                        │  │ práticas prontas        │  │ em linguagem natural   │
│      [ Selecionar ]    │  │      [ Selecionar ]    │  │  [ Disponível em S11 ] │
└────────────────────────┘  └────────────────────────┘  └────────────────────────┘
```

**Notas de implementação:**
- Conversa Guiada desabilitada até S11 (badge "Em breve" + botão desativado)
- Templates carrega galeria antes de wizard (permite preview antes de escolher)
- Formulário vai direto ao wizard de 4 etapas

---

## Componentes Reutilizáveis

| Componente | Props |
|-----------|-------|
| `FlowCard` | flow, onEdit, onDuplicate, onArchive |
| `FlowModeBadge` | mode: 'active'\|'assistant'\|'shadow'\|'draft' |
| `ShadowBanner` | message, dismissible? |
| `FlowModeSelector` | onSelect, disabledModes? |

---

[[wiki/fluxos-wireframes-admin]] | [[wiki/fluxos-wireframes-wizard]] | [[wiki/fluxos-wireframes-guiada]]
