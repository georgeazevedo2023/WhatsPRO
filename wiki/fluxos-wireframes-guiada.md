---
title: G5 Wireframes — Conversa Guiada
tags: [wireframes, ux, fluxos, conversa-guiada, g5]
updated: 2026-04-11
---

# Wireframes: Conversa Guiada (Split-Screen)

> Admin descreve o fluxo em linguagem natural → IA monta em tempo real.
> Split-screen: chat admin 48% / preview live 52%.

---

## Layout Geral

```
┌───────────────────────────────────────────────────────────────────────┐
│ [ ← Voltar ]  Conversa Guiada                  [Mudar para Formulário]│
├─────────────────────────────────────┬─────────────────────────────────┤
│ CHAT (48%)                          │ PREVIEW (52%)                   │
│                                     │                                 │
│  [histórico de mensagens]           │  [estrutura do fluxo em tempo  │
│                                     │   real via Supabase Realtime]  │
│  [input area]                       │                                 │
└─────────────────────────────────────┴─────────────────────────────────┘
```

---

## Painel Esquerdo — Chat

### Header do Chat
```
● IA Construtora de Fluxos            [Sessão salva · Retoma em 24h]
Descreva o fluxo que você quer criar
```
- Indicador de status: Verde (respondendo) / Amarelo (processando) / Vermelho (erro)

### Mensagens
```
IA  Olá! Vou ajudar a criar seu fluxo. Para começar: qual é o
    objetivo principal? (qualificar leads, vender produtos,
    dar suporte, agendar...)

Você  Quero qualificar leads para minha consultoria de RH

IA  Perfeito! Criei a estrutura base. Vou fazer algumas perguntas
    para personalizar:
    ✓ Etapa de Saudação adicionada
    ✓ Etapa de Qualificação adicionada
    Qual o nome e cargo que você precisa coletar dos leads?
```

### Chips de Sugestão (dinâmicos)
```
[ Nome + Cargo ]  [ Nome + Empresa + Cargo ]  [ Nome + Email + Telefone ]
```
Chips mudam contextualmente com base na conversa.

### Input Area
```
┌────────────────────────────────────────────────────┐
│ Descreva uma mudança ou responda a pergunta...      │
│                                          [Enviar ↵] │
└────────────────────────────────────────────────────┘
```

---

## Painel Direito — Preview Live

### Seção Gatilhos
```
GATILHOS
┌──────────────────────────────────┐
│ ● Palavra-chave: "oi", "olá"    │
│                         [Editar] │
└──────────────────────────────────┘
[ + Sugerido: Intent "Lead criado" ]
```

### Seção Steps (drag-and-drop)
```
STEPS
┌──────────────────────────────────┐
│ ≡  1. Saudação                  │
│    greeting · extract_name ON   │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ ≡  2. Qualificação              │
│    qualification · 3 perguntas  │
└──────────────────────────────────┘
[ + Step sugerido ]
```

### Botões de Ação
```
[ Mudar para Formulário ]    [ Criar Fluxo ▸ ]
                              (desabilitado até ter 1 step + 1 gatilho)
```

---

## 10 Estados Especiais

| Estado | Trigger | UX |
|--------|---------|-----|
| Recuperação de sessão | Admin volta em <24h | Banner "Sessão anterior encontrada — Continuar?" |
| IA timeout | >10s sem resposta | Spinner + "A IA está processando..." |
| Feature impossível | Pede algo fora do escopo | IA explica limite + sugere alternativa |
| Mudança grande (>3 steps) | Admin pede reestruturação | Confirmação: "Isso vai reorganizar X etapas. Confirmar?" |
| Mudar para formulário | Clique em botão | Modal: "Seu progresso será preservado no formulário" |
| Reset de sessão | Admin pede recomeçar | Confirmação destrutiva com nome digitado |
| Finalização | Clique "Criar Fluxo" | Resumo + botão confirmar → redireciona ao Editor |
| Modo Shadow detectado | IA percebe no contexto | Aviso proativo: "Lembre: neste modo IA não responderá" |
| Sugestão proativa | `has_catalog=true` | "Vi que você tem catálogo. Adicionar etapa de Produtos?" |
| has_bio_page=true | IA detecta bio page | "Quer usar seu Bio Link como gatilho de entrada?" |

---

## 10 Edge Cases Documentados

1. Admin fecha aba acidentalmente → sessão persiste 24h via `guided_sessions`
2. Admin e IA divergem sobre estrutura → IA pergunta "Como prefere resolver?"
3. Fluxo muito grande (>12 steps) → IA avisa complexidade + sugere dividir
4. Template escolhido como base → IA parte do template, não do zero
5. Instância sem catálogo → IA não sugere etapa de Produtos
6. Conflito de gatilho com outro fluxo → IA alerta e sugere ajustar prioridade
7. Admin muda idioma da conversa → IA segue o idioma do admin
8. Resposta ambígua do admin → IA pede clarificação com exemplos
9. Session expirada (>24h) → IA inicia nova sessão, antigo draft arquivado
10. Erro na `guided-flow-builder` edge function → fallback para Formulário com dados preservados

---

## Arquitetura Técnica

| Componente | Detalhe |
|-----------|---------|
| Edge function | `guided-flow-builder` → GPT-4.1-mini → JSON `flow_patch` |
| Realtime | Supabase Realtime → preview atualiza sem polling |
| Persistência | `guided_sessions` (messages JSONB, draft_flow JSONB, expires_at 24h) |
| `flow_patch` | Diff incremental — não regenera fluxo inteiro |
| Cleanup | Cron remove `guided_sessions` expiradas (DT5) |

---

[[wiki/fluxos-wireframes-admin]] | [[wiki/fluxos-wireframes-wizard]] | [[wiki/fluxos-wireframes-editor]]
