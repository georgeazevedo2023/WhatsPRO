---
title: Roadmap — M10 Agente de IA (parte 2)
type: roadmap-detail
description: M10 Agente IA (parte 2) — T10.7 Métricas + T10.8 CRM Kanban + T10.9 Pause/Resume + T10.10 Fallback + T10.11 Delay + T10.12 Ações
updated: 2026-05-11
---

# M10 — Agente de IA WhatsApp (parte 2: T10.7-T10.12)

> Continuação de [[wiki/roadmap/m10-agente-ia-part1]].

##### T10.7 — Métricas por Etapa
**Descrição completa**: Dashboard analítico que mostra performance de cada step do funil em formato de "funil de conversão".

**Visualizações**:

1. **Funil de conversão visual** (gráfico de barras decrescente):
```
Step 1: Mensagem inicial      ████████████████████ 1.000 (100%)
Step 2: Pergunta interesse     ███████████████     750 (75%)
Step 3: Apresentação produto   ██████████          500 (50%)
Step 4: Oferta                 ██████              300 (30%)
Step 5: Fechamento             ███                 150 (15%)
```

2. **KPIs por funil**:
| Métrica | Valor |
|---------|-------|
| Total de execuções | 1.000 |
| Taxa de conclusão | 15% |
| Tempo médio total | 2h 34min |
| Drop-off principal | Step 2→3 (33% abandono) |
| Revenue atribuído | R$ 44.850,00 |
| Custo por conversão | R$ 0 (WhatsApp) |

3. **Heatmap de abandono**: Quais steps perdem mais contatos e em que horário
4. **Comparação entre funis**: Side-by-side de múltiplos funis
5. **Timeline**: Evolução da taxa de conversão ao longo do tempo

---

##### T10.8 — Integração com CRM Kanban
**Descrição completa**: Ações automáticas no CRM Kanban (M4) disparadas por eventos do funil.

**Ações disponíveis**:

| Evento no Funil | Ação no Kanban | Exemplo |
|----------------|----------------|---------|
| Funil iniciado | Criar card | Novo lead → card na coluna "Entrada" |
| Step concluído | Mover card | Respondeu interesse → mover para "Qualificado" |
| Funil concluído | Mover card + atualizar campo | Fechou venda → "Ganho" + valor preenchido |
| Funil abandonado | Mover card | Parou de responder → "Perdido" |
| Resposta específica | Atualizar campo | Disse orçamento "R$5k+" → campo valor = 5000 |
| Tag adicionada pelo funil | Atribuir responsável | Tag "vip" → atribuir para gerente |

**Configuração no builder**: No node ⚡ Ação, selecionar:
- Board destino
- Coluna destino
- Campos a preencher (mapeamento variável → campo)
- Responsável (fixo ou regra)

**Exemplo de fluxo completo**:
```
[Trigger: keyword "orçamento"]
  → [📨 Boas-vindas + pergunta]
  → [⚡ Criar card em "Novos Leads"]
  → [❓ Coleta de dados...]
  → [⚡ Mover card para "Qualificado" + preencher valor]
  → [📨 "Nosso consultor {{responsavel}} vai te atender!"]
  → [⚡ Atribuir card ao consultor]
```

---

##### T10.9 — Pause/Resume por Contato
**Descrição completa**: Quando um agente humano precisa intervir na conversa, o funil é automaticamente pausado para evitar conflito de mensagens.

**Regras de pause automático**:
- Agente envia mensagem manual na conversa → funil pausa
- Agente clica "Pausar funil" no painel do contato → funil pausa
- Contato digita keyword de escape (ex: "atendente", "humano") → funil pausa + alerta para agentes

**Regras de resume**:
- Agente clica "Retomar funil" → continua do step onde parou
- Agente clica "Retomar do início" → reinicia o funil
- Auto-resume após X minutos sem interação do agente (configurável)
- Agente resolve conversa → funil é cancelado

**Indicadores visuais no helpdesk**:
- Badge "🤖 Funil ativo" ou "⏸️ Funil pausado" na conversa
- Nome do funil e step atual visíveis no painel do contato
- Botões de controle: ⏸️ Pausar | ▶️ Retomar | ⏹️ Cancelar | ⏭️ Pular step

---

##### T10.10 — Fallback para Humano
**Descrição completa**: Detecção automática de quando o bot/funil não consegue atender e deve transferir para um agente humano.

**Triggers de fallback**:

| Trigger | Configuração | Exemplo |
|---------|-------------|---------|
| Keyword de escape | Lista de palavras | "atendente", "humano", "falar com alguém" |
| Respostas inválidas consecutivas | Número máximo | 3 respostas que não matcham nenhuma condição |
| Sentimento negativo (IA) | Threshold | Sentimento < -0.5 em 2 mensagens seguidas |
| Timeout sem resposta | Tempo + retries | Sem resposta após 2 tentativas de reenvio |
| Assunto complexo (IA) | Classificação | IA detecta assunto fora do escopo do funil |

**Ações ao fazer fallback**:
1. Enviar mensagem ao contato: "Vou te conectar com um de nossos atendentes. Um momento! 😊"
2. Criar/reabrir conversa no helpdesk (M2)
3. Atribuir a departamento ou agente específico (configurável)
4. Passar contexto: resumo das respostas coletadas no funil
5. Adicionar nota privada com transcript do funil na conversa
6. Notificar agente via push/desktop (quando implementado - R6)

---

##### T10.11 — Delay Inteligente entre Steps
**Descrição completa**: Controle granular do timing entre mensagens para simular conversa natural e respeitar horários.

**Tipos de delay**:

| Tipo | Configuração | Uso |
|------|-------------|-----|
| Fixo | 5 segundos | Entre mensagens sequenciais (simular digitação) |
| Aleatório | 3-8 segundos | Parecer mais humano |
| Minutos/horas | 30 min, 2h | Follow-up após reflexão |
| Dias | 1 dia, 3 dias | Drip campaign |
| Horário específico | "amanhã às 9h" | Enviar no melhor horário |
| Janela de envio | 8h-20h, seg-sex | Não enviar fora de horário comercial |
| Typing indicator | 1-3s antes do envio | Mostrar "digitando..." antes de enviar |
| Condicional | "Se respondeu em < 1min, delay 3s; senão, delay 0s" | Adaptar ao ritmo do contato |

**Exemplo de drip campaign**:
```
Dia 0, 10h: [📨] "Bem-vindo ao mini-curso de Marketing Digital! 🎓"
Dia 0, 10h05: [📨] "Aula 1: Os 3 pilares do marketing..." [📎 PDF]
Dia 1, 9h: [📨] "Bom dia {{nome}}! Aula 2 já está disponível..."
Dia 2, 9h: [📨] "Última aula! Aula 3: Como escalar..."
Dia 3, 10h: [📨] "Gostou do mini-curso? Temos o curso completo com 50% OFF..."
```

---

##### T10.12 — Ações de Step
**Descrição completa**: Cada step do funil pode executar múltiplas ações além de enviar mensagens.

**Ações disponíveis**:

| Ação | Parâmetros | Exemplo |
|------|-----------|---------|
| Adicionar tag | tag_name | Adicionar "qualificado" ao contato |
| Remover tag | tag_name | Remover "lead_frio" |
| Atualizar custom attribute | key, value | Setar `orcamento = "R$5000"` |
| Criar card Kanban | board, coluna, dados | Card "João - R$5k" na coluna "Negociação" |
| Mover card Kanban | board, coluna | Mover para "Proposta Enviada" |
| Criar pedido (M11) | produto, variante | Criar pedido com produto selecionado |
| Inscrever em curso (M13) | curso_id | Inscrever no curso "Marketing Digital" |
| Enviar webhook | url, payload | POST para n8n/Zapier/Make com dados |
| Atribuir agente | user_id / regra | Atribuir conversa ao vendedor responsável |
| Enviar email | template, dados | Email de confirmação de agendamento |
| Aguardar pagamento | order_id, timeout | Pausar até pagamento confirmado ou timeout |
| Iniciar outro funil | funnel_id | Encadear funis (ex: pós-venda após checkout) |
| Enviar para grupo | group_id, mensagem | Notificar grupo interno "Novo lead qualificado!" |

**Tabelas planejadas**: `funnels`, `funnel_steps`, `funnel_step_actions`, `funnel_conditions`, `funnel_triggers`, `funnel_executions`, `funnel_execution_steps`, `funnel_ab_variants`, `funnel_step_metrics`

**Edge Functions planejadas**: `execute-funnel-step`, `evaluate-funnel-condition`, `funnel-trigger-listener`, `funnel-metrics-aggregate`

**Componentes planejados**: `FunnelBuilder`, `FunnelCanvas`, `NodePalette`, `NodeEditor`, `ConditionBuilder`, `FunnelSimulator`, `FunnelMetrics`, `FunnelTemplateGallery`, `FunnelExecutionLog`, `TriggerConfig`

---

