---
title: G5 Wireframes — Wizard Formulário 4 Etapas + Galeria Templates
tags: [wireframes, ux, fluxos, wizard, templates, g5]
updated: 2026-04-11
---

# Wireframes: Wizard Formulário + Galeria Templates

---

## Wizard Formulário — 4 Etapas

### Progress Header (fixo)
```
[ 1 Identidade ] ──── [ 2 Configuração ] ──── [ 3 Gatilhos ] ──── [ 4 Publicar ]
```

---

### Etapa 1 — Identidade
```
Nome do fluxo *
[ SDR Comercial                                    ]

Slug (URL) *                              [↺ Gerar]
[ sdr-comercial                                    ]

Descrição
[ Qualifica leads e agenda demonstração do produto ]

Instância *
[ ▾ wsmart-principal                               ]
```
- Slug gerado automaticamente ao digitar nome (kebab-case)
- Instância puxa de `instances` da conta

---

### Etapa 2 — Configuração
```
Modo de operação *

  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ IA Ativa     │  │ IA Assistente│  │ Shadow       │  │ Desligado    │
  │ ✓ Selecionado│  │              │  │ ⚠ Observa    │  │              │
  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘

Template base (opcional)
[ ▾ Nenhum — começar do zero ]

☐ Fluxo padrão da instância (leads sem fluxo específico usam este)

Funil vinculado (opcional)
[ ▾ Selecionar funil... ]
```
- Selecionar "Shadow" exibe aviso: "Neste modo a IA observa mas NÃO responde"
- Template base pré-popula steps na Etapa 3+

---

### Etapa 3 — Gatilhos
```
Gatilhos ativos                                    [ + Adicionar gatilho ]

┌─────────────────────────────────────────────────┐
│ ● Palavra-chave: "oi", "olá", "bom dia"  P:10  │
│                                      [Editar][✕]│
└─────────────────────────────────────────────────┘

[ + Adicionar gatilho ]
```

**Modal Adicionar Gatilho — 16 tipos em 4 grupos:**
```
Entrada:      Palavra-chave | Intent | QR Code | UTM | Bio Link
Mensagem:     Primeira mensagem | Mensagem recebida | Áudio recebido | Mídia recebida
CRM:          Lead criado | Tag adicionada | Status mudou | Campo alterado
Externo:      Webhook | Cron | API
```

**Configuração do gatilho:**
- Prioridade: slider 1-100 (default: 10)
- Cooldown: `[ 0 ] minutos` (0 = sem cooldown)
- Ativação: Sempre / Horário comercial / Personalizado

---

### Etapa 4 — Publicar
```
Resumo do fluxo:

  Nome: SDR Comercial
  Modo: IA Ativa
  Instância: wsmart-principal
  Gatilhos: 1 gatilho configurado
  Steps: 0 (pode adicionar depois no editor)

  ┌──────────────────────────────────────────┐
  │ ○ Salvar como rascunho                   │
  │ ● Publicar agora                         │
  └──────────────────────────────────────────┘

            [ ← Voltar ]  [ Criar Fluxo ]
```
- "Publicar agora" seta `published_at = now()`
- Após criar → redireciona para `/flows/:id` (aba Subagentes)

---

## Galeria de Templates

### Layout
```
[ ← Voltar ]  Escolher template

Categorias: Todos · Vendas · Captação · Atendimento · Nicho

┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ 🛒 Vitrine       │ │ 🎯 SDR BANT      │ │ 🎪 Lançamento    │
│ Apresenta        │ │ Qualifica e       │ │ Sequência de     │
│ produtos e       │ │ agenda demos      │ │ aquecimento      │
│ captura leads    │ │                  │ │ + vendas         │
│ [Pré-visualizar] │ │ [Pré-visualizar] │ │ [Pré-visualizar] │
│ [Usar template]  │ │ [Usar template]  │ │ [Usar template]  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

**12 templates:** Vitrine | Lançamento | Carrinho Abandonado | Cardápio | Sorteio | SDR | Evento | Suporte | Agendamento | Pós-venda | Política | Imobiliária

**Drawer de Preview (lateral):**
- Nome + descrição do template
- Steps incluídos (badges visuais)
- Gatilhos pré-configurados
- Aviso de compatibilidade (ex: "Requer catálogo ativo")
- [ Usar este template ] → vai para Etapa 1 do Wizard com steps pré-populados

---

[[wiki/fluxos-wireframes-admin]] | [[wiki/fluxos-wireframes-listagem]] | [[wiki/fluxos-wireframes-guiada]]
