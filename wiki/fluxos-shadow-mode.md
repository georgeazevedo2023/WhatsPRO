---
title: Fluxos — Shadow Mode (Inteligencia Passiva + 7 Dimensoes)
tags: [shadow-mode, metricas, vendedor, objecoes, follow-up, resgate, gestor]
sources: [discussao-chat-2026-04-11]
updated: 2026-04-11
---

# Shadow Mode — Inteligencia Passiva

> IA observa conversas vendedor↔cliente sem intervir. Extrai dados, mede performance, detecta objecoes, rastreia follow-ups, resgata leads abandonados.
> 5o servico: Shadow Analyzer. Modo de operacao do orquestrador (nao subagente).
> Docs relacionados: [[wiki/fluxos-visao-arquitetura]], [[wiki/fluxos-servicos]]

---

## Pipeline Shadow

```
Msg (cliente↔vendedor) → STT → Memory → Shadow Analyzer → Metrics → FIM (nao responde)
Excecao: resgate automatico (msg quando vendedor nao responde)
```

## 7 Dimensoes de Inteligencia

### D1 — Lead Intelligence
- Perfil auto-extraido: nome, telefone, cidade, bairro, tipo (pintor/sindico/cliente_final/arquiteto/empreiteiro/lojista)
- Resumo ultima conversa + resumo historico (LLM)
- Intencoes detectadas, sentimento, proxima acao provavel
- Midia: imagens+audios enviados/recebidos, transcricao audios
- Tags automaticas, temperatura, score, etapa
- Produtos mencionados: nome, quantidade, preco, desconto, status
- Historico compras com valor total
- Potencial mensal estimado, frequencia, dia/horario preferido
- Follow-ups pendentes com data e contexto

### D2 — Vendedor Intelligence
- Volume: leads/dia, conversas/dia, msgs/dia, novos vs recorrentes
- Tempo: resposta medio, por periodo (manha/tarde), primeira resposta do dia
- Conversao: taxa, sinais detectados ("pix"=98%, "vou pensar"=15%), ticket medio
- Faturamento: diario, mensal, por produto
- Produtividade por hora (grafico, pico vs vale)
- Frases que mais convertem (aprendido por IA)

### D3 — Objecao Intelligence
- 7 tipos: preco(34%), decisao(28%), prazo(22%), concorrencia(18%), estoque(15%), qualidade(8%), desistencia(5%)
- Como CADA vendedor lida com CADA objecao + taxa de superacao
- Frases que funcionam vs frases que nao funcionam
- Concorrentes mencionados + produtos comparados + diferenca de preco
- Insight: "Volume discount converte 4x mais que justificar preco"

### D4 — Produto Intelligence
- Mais procurados (mencoes/mes), mais vendidos, complementares
- Produtos EM FALTA: quantos pediram + receita perdida estimada
- Marcas mais pedidas (%). Tendencias (subindo/descendo)
- Cross-sell detectado: "quem compra tinta pede rolo+bandeja"

### D5 — Gestor Intelligence
- Comparativo vendedores: conversao, tempo, ticket, objecao win rate
- Dinheiro na mesa: falta estoque + desistencia preco + sem follow-up
- Acoes sugeridas: treinar Pedro, estocar Suvinil, programa fidelidade
- Insights IA: segmentacao clientes, dias fracos, oportunidades

### D6 — Resposta Intelligence (fila de espera)
**Escalada progressiva quando cliente sem resposta:**

| Tempo | Acao |
|---|---|
| 5min | Badge amarelo no painel (so gestor ve) |
| 15min | Notificacao pro vendedor ("Carlos esperando") |
| 30min | Alerta pro gestor ("VIP sem resposta 30min") |
| 1h | RESGATE: msg automatica + redireciona vendedor |
| 2h | Lead marcado "abandonado" + score -10 |

**Tempos configuraveis** por admin. Prioridade por score: VIP(5/10/15/30min), Normal(15/30/60min), Frio(30/60/120min).
**Inteligencia:** distingue "cliente esperando" vs "conversa encerrada" vs "msg generica".
**Intervalo:** detecta almoco/pausa → msg automatica + cobertura por outro vendedor ou IA temporaria.

### D7 — Follow-up Intelligence
**Deteccao automatica de necessidade:**
- "Vou pensar" → 48h | "Tá caro" → 24h | "Consultar marido" → 48-72h
- "Semana que vem" → dia combinado | "Quando chegar" → webhook estoque
- Compromissos: "passo sexta" → lembrete sexta 8h

**Rastreamento:**
- Lista de follow-ups pendentes por vendedor com data e contexto
- IA gera sugestao de mensagem por tipo de objecao
- Vendedor copia, edita e envia (Shadow registra como feito)

**Escalada se nao fizer:**
- D+0: badge no painel | D+1: notifica vendedor | D+2: alerta gestor | D+3: resgate automatico
- Score decai mais rapido sem follow-up (normal -2/dia, sem follow-up -5/dia)

**Metricas:** follow-ups feitos vs necessarios, tempo medio, taxa conversao com(45%) vs sem(12%).

---

## Processamento

| Tipo | Quando | LLM? | Custo |
|---|---|---|---|
| Armazenar texto+midia | Cada msg | Nao | R$0 |
| Transcrever audio | Cada audio | STT | ~R$0,01 |
| Detectar intencao compra | Cada msg | Nao (keywords) | R$0 |
| Medir tempo resposta | Cada msg | Nao | R$0 |
| Extrair perfil lead | Batch 5min | LLM | ~R$0,005 |
| Detectar produtos | Batch 5min | LLM+catalogo | ~R$0,003 |
| Gerar resumo conversa | Batch 5min | LLM | ~R$0,005 |
| Detectar objecoes | Batch 5min | LLM | ~R$0,003 |
| Total/batch | ~5min | | ~R$0,016 |
| Total/dia (por vendedor) | ~100 batches | | ~R$1,60 |

---

## Configuracao Admin

```
Modo operacao: Shadow (IA observa, vendedor conversa)
Coleta: perfil, audios, imagens, produtos, objecoes, resumos
Resposta pendente: notifica 15min, gestor 30min, resgate 60min
Follow-up: detectar+sugerir+escalar 2 dias+resgate 3 dias
Intervalo: detectar auto + msg cobertura + redirecionar urgentes
Objecoes: 7 tipos + rastrear superacao + insights gestor
```

---

## Modos de Operacao do Sistema (4)

| Modo | IA fala? | IA coleta? | Quem atende |
|---|---|---|---|
| IA Ativa | Sim | Sim | IA (subagentes) |
| IA Assistente | Sugere | Sim | Vendedor (IA sugere msgs) |
| Shadow | Nao | Sim | Vendedor (IA observa) |
| Desligado | Nao | Nao | Vendedor (sem IA) |
