---
title: Plano de Testes Sandbox v2 — Blocos F/G/H/J (expansão)
tags: [sandbox, testes, e2e, ai-agent, qualidade, leads, helpdesk, metricas]
sources: [wiki/plano-testes-sandbox, wiki/sandbox-ia-instancia, wiki/casos-de-uso/ai-agent-detalhado]
updated: 2026-05-06
---

# Plano de Testes Sandbox v2 — Expansão

> Continuação do [[wiki/plano-testes-sandbox]] (v1 = blocos A/B/C/D/E). v2 adiciona blocos focados em **coleta de dados de lead, objeções, conversão e métricas agregadas** que o usuário pediu em 2026-05-06.

> **Bloco I (limites de interação)** e **K1-K10 (extras)** ficam para v3 — não estão neste documento por escolha do usuário.

---

## Pré-requisitos aplicados (2026-05-06)

| Fix | Estado anterior | Estado atual |
|---|---|---|
| Catálogo `ai_agent_products` | 0 produtos | **7 produtos clonados do Eletropiso** (tintas, vernizes, manta, cuba, telha) |
| `handoff_message` | NULL | "Tudo bem! Vou chamar um vendedor agora pra te atender 😊 Aguarde só um momento." |
| `business_info` | sem `name` | + `name: "Eletropiso (Sandbox)"`, address, phone, hours, payment_methods |

---

## Bloco F — Tipo de Cliente (perfil profissional)

> **Pergunta a responder:** A IA detecta e tagueia profissão (pintor, eletricista, cliente final)? O dado vai pra `lead_profiles` ou só fica em `conversations.tags`?

### F1. Pintor profissional

| | |
|---|---|
| **Você manda** | `Sou pintor, preciso de tinta acrílica branca pra pintar uma obra de 200m²` |
| **IA esperada** | Tagueia profissão + considera escala de obra na resposta |
| **Valido tags** | `profissao:pintor` em `conversations.tags` |
| **Valido lead_profiles** | tem coluna `profession` ou similar? Se sim, populada |
| **Pass criteria** | tag presente OU lead_profiles populado. Se nenhum dos dois → **gap de feature** (registrar) |

### F2. Eletricista em obra

| | |
|---|---|
| **Você manda** | `Sou eletricista, tô numa obra grande, preciso de cabo flexível 2.5mm em rolo de 100m` |
| **IA esperada** | Tagueia profissão + reconhece "rolo 100m" como unidade especificada |
| **Valido tags** | `profissao:eletricista`, `quantidade:100m` |

### F3. Cliente final (DIY)

| | |
|---|---|
| **Você manda** | `Tô reformando minha casa e preciso de uma tinta pra parede da sala` |
| **IA esperada** | NÃO tagueia profissão (cliente final). Foca em qualificação por ambiente |
| **Valido** | sem tag `profissao:*`. Tag `ambiente:sala` deve aparecer |

### F4. Auditoria pós-bloco F

```sql
-- Profissão coletada nas conversas teste?
SELECT id, tags 
FROM conversations 
WHERE instance_id = 'rb84e079eeab167' 
  AND tags && ARRAY['profissao:pintor', 'profissao:eletricista']::text[];

-- lead_profiles tem campo profession?
SELECT column_name FROM information_schema.columns 
WHERE table_name='lead_profiles' AND column_name LIKE '%prof%';
```

---

## Bloco G — Objeções (motivos de não-compra)

> **Pergunta a responder:** A IA captura razão pela qual o cliente recusa/hesita? Essa info chega pro vendedor humano no handoff?

### G1. Objeção de preço

| | |
|---|---|
| **Setup** | conversa com produto já apresentado (após C1 ou H1) |
| **Você manda** | `Achei muito caro, não tenho como pagar isso agora` |
| **IA esperada** | tag `objecao:preco` + handoff (palavra "preço/caro" pode ser trigger) |
| **Valido tags** | `objecao:preco` em `conversations.tags` |
| **Valido handoff** | `status_ia → shadow` se preço estava em handoff_triggers |

### G2. Objeção de indecisão ("vou pensar")

| | |
|---|---|
| **Você manda** | `Vou pensar e te respondo depois` |
| **IA esperada** | tag `objecao:indecisao` + agendar follow-up (se `follow_up_enabled=true`) |
| **Valido** | tag presente. Se `follow_up_enabled=true`, registro em `follow_up_queue` (ou similar) |

### G3. Objeção de concorrência

| | |
|---|---|
| **Você manda** | `Achei mais barato em outra loja por R$ 80` |
| **IA esperada** | tag `objecao:concorrencia` + handoff pro humano negociar |
| **Valido** | tag presente. Vendedor que pegar handoff vê motivo no painel direito |

### G4. Auditoria pós-bloco G

```sql
SELECT 
  jsonb_array_elements_text(to_jsonb(tags)) AS tag,
  COUNT(*)
FROM conversations 
WHERE instance_id = 'rb84e079eeab167'
  AND tags && ARRAY['objecao:preco', 'objecao:indecisao', 'objecao:concorrencia']::text[]
GROUP BY 1
ORDER BY 2 DESC;
```

---

## Bloco H — Venda Fechada (conversão)

> **Pergunta crítica:** A IA detecta "venda fechada"? Hoje tem heurística pra "manda o pix", "paguei", "comprovante"? Se não, precisa criar.

### H1. Cliente pede pix

| | |
|---|---|
| **Setup** | após produto + handoff (vendedor humano negociou no chat) |
| **Você manda** | `Pode mandar o pix` |
| **IA esperada** | tag `venda:fechada` (ou similar) + IA fica passiva (status_ia já é shadow após handoff) |
| **Valido** | tag `venda:*` presente. Notificação pro gerente (se configurado) |
| **Gap potencial** | se IA não detecta, registrar como **feature pendente** + criar plan |

### H2. Cliente confirma pagamento

| | |
|---|---|
| **Você manda** | `Já efetuei o pagamento, segue o comprovante` (pode mandar foto qualquer) |
| **IA esperada** | tag `venda:fechada` + reconhece imagem como comprovante |
| **Valido** | tag presente. Se tem extração de imagem, OCR/vision processa |

### H3. Cliente menciona compra finalizada

| | |
|---|---|
| **Você manda** | `Combinado, fechei` |
| **IA esperada** | tag `venda:fechada` |

### H4. Auditoria pós-bloco H

```sql
-- Taxa de conversão simulada
WITH stats AS (
  SELECT 
    COUNT(*) AS total_conversas,
    COUNT(*) FILTER (WHERE tags && ARRAY['venda:fechada']) AS vendas_fechadas
  FROM conversations 
  WHERE instance_id = 'rb84e079eeab167'
)
SELECT 
  total_conversas,
  vendas_fechadas,
  ROUND(100.0 * vendas_fechadas / NULLIF(total_conversas, 0), 1) AS taxa_conversao_pct
FROM stats;
```

---

## Bloco J — Métricas Agregadas (dashboard pós-testes)

> Não é um cenário — é o **relatório final** que vai consolidar tudo que foi testado. Após rodar A-H, gerar este dashboard em `wiki/relatorio-testes-sandbox.md`.

### Métricas obrigatórias

| # | Métrica | Query base |
|---|---|---|
| J1 | Total de leads coletados (com nome) | `SELECT COUNT(*) FROM lead_profiles WHERE...` |
| J2 | Top 10 produtos PERGUNTADOS (mesmo sem catálogo) | `ai_agent_logs.tool_calls` filtrando `search_products` |
| J3 | Top 10 produtos NÃO encontrados (oportunidade de cadastro) | `tool_calls` com result vazio |
| J4 | Atendimentos por vendedor (round-robin/handoff) | `GROUP BY assigned_to` |
| J5 | % conversas dentro/fora horário | comparar `created_at` com `business_hours` |
| J6 | Distribuição de profissões | `tags LIKE 'profissao:%'` |
| J7 | Distribuição de objeções | `tags LIKE 'objecao:%'` |
| J8 | Vendas fechadas detectadas | `tags && ['venda:fechada']` |
| J9 | Tempo médio até handoff (em minutos) | diff entre 1ª msg e mudança status_ia → shadow |
| J10 | Latência média IA (ms) | `AVG(latency_ms)` em `ai_agent_logs` |
| J11 | Tokens consumidos (input/output) | `SUM(input_tokens + output_tokens)` |
| J12 | Custo OpenAI estimado | tokens × preço gpt-4.1-mini |

### Gaps esperados (hipóteses a confirmar)

- **G1**: pode não existir tag `objecao:preco` se não estiver no prompt do agente — feature nova
- **H1**: pode não existir tag `venda:fechada` — heurística não implementada
- **F1-F3**: profissão pode estar em `extraction_fields` mas não em `lead_profiles`

---

## Workflow de execução (1 sessão = 1 bloco)

```
Sessão 1 (HOJE — 2026-05-06): A1 + A2 + handoff (D1) — valida pipeline básico
Sessão 2: B1 + B2 + B3 + B4 — qualificação por categoria (R103)
Sessão 3: C1 + C2 + C3 — produtos (catálogo agora populado)
Sessão 4: F1 + F2 + F3 — perfil profissional
Sessão 5: G1 + G2 + G3 — objeções
Sessão 6: H1 + H2 + H3 — conversão
Sessão 7: relatório J (consolidação)
```

A cada cenário Claude:
1. Roteiriza personagem fictício (nome, profissão, query)
2. Pede msg específica pro usuário enviar
3. Monitora `conversation_messages` + `ai_agent_logs` + `conversations.tags` em tempo real
4. Reporta PASS/FAIL com dados concretos
5. Se FAIL: diagnostica + corrige + redeploya
6. Documenta achados no log + `erros-e-licoes` (se bug novo)

---

## Cross-refs

- [[wiki/plano-testes-sandbox]] — v1 (blocos A/B/C/D/E)
- [[wiki/sandbox-ia-instancia]] — refs técnicas
- [[wiki/erros-e-licoes]] — R103, R104, R105, R106
