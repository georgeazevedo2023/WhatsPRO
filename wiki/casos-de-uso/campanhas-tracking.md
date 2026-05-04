---
title: Campanhas — Tracking, Atribuicao & Contexto IA
tags: [campanhas, utm, tracking, atribuicao, tags, ia, visitas, detalhado]
sources: [src/components/campaigns/, supabase/functions/whatsapp-webhook/, supabase/functions/ai-agent/]
updated: 2026-05-04
---

# Campanhas — Tracking, Atribuicao & Contexto IA

> Esta sub-wiki cobre o que acontece **depois do clique**: como o lead que converte recebe tags automaticas identificando a campanha de origem, como o agente IA recebe o contexto da campanha no prompt para personalizar o atendimento, e como o sistema armazena visitas detalhadas com metadados de dispositivo.
>
> Ver tambem: [[wiki/casos-de-uso/campanhas-detalhado]] (indice), [[wiki/casos-de-uso/campanhas-criacao]], [[wiki/casos-de-uso/campanhas-operacao]]

---

## 7.6 Atribuicao Automatica (Tags)

**O que e:** Quando um lead converte (manda mensagem apos clicar no link), a conversa recebe automaticamente tags que identificam de qual campanha veio.

**Tags aplicadas:**
- `campanha:promo-agosto` — nome da campanha
- `formulario:orcamento` — se veio pelo formulario
- `origem:campanha` — canal de origem
- `funil:venda-agosto` — se a campanha faz parte de um funil

**Guards de atribuicao (protecoes):**
- So atribui se campanha esta `active` (pausadas/arquivadas nao tagueiam)
- So atribui se `expires_at` nao passou (expiradas nao tagueiam)
- Previne atribuicao retroativa a campanhas inativas

**Cenario real:** Campanha "Promo Agosto" foi pausada por estoque acabado. Lead que tinha o link salvo clica e manda mensagem 2 dias depois → webhook detecta ref_code → ve `status='paused'` → NAO aplica tag de campanha → lead chega como organico, sem distorcer metricas.

> **Tecnico:** Tags aplicadas em form-public (POST submission) e whatsapp-webhook (match ref_code). Guards no webhook: `campaign.status === 'active' AND (!expires_at OR expires_at > now())`. Tags via `mergeTags()` em agentHelpers.ts. NUNCA tags vazias `[]` (regra 11 do CLAUDE.md).

---

## 7.7 Contexto IA da Campanha

**O que e:** Quando o lead chega pela campanha, o agente IA recebe automaticamente o **contexto daquela campanha** no seu prompt. Assim, a IA sabe qual promocao mencionar, qual codigo de desconto usar, e qual tom adotar.

**O que a IA recebe:**
```
<campaign_context>
Este lead chegou pela campanha "Promo Dia Pais" (tipo: promocao).
Origem: instagram / social
Instrucao: Destaque a oferta, crie urgencia, apresente o combo especial.
Detalhes: Combo Dia dos Pais 20% OFF. Codigo PAIS20. Valido ate 15/08.
Adapte seu atendimento ao contexto desta campanha.
</campaign_context>
```

**Cenario:** Lead clica no link da campanha "Dia dos Pais" → manda "oi" → IA responde: "Ola! Vi que voce se interessou pela nossa promocao do Dia dos Pais! Temos um combo especial com 20% de desconto usando o codigo PAIS20. Quer ver os produtos?"

> **Tecnico:** AI Agent detecta tag `campanha:NAME` → query `utm_campaigns` por name + instance_id → monta bloco `<campaign_context>` com campaign_type, utm_source, utm_medium, ai_template, ai_custom_text → injeta no system prompt. Componente admin: `CampaignAiTemplate.tsx` com template auto-load por tipo + textarea custom. Ver [[wiki/casos-de-uso/ai-agent-detalhado]] para integracao completa no prompt.

---

## 7.9 Visitas com Paginacao e Metadados

**O que e:** Lista detalhada de todas as visitas da campanha, com dados do dispositivo do lead.

**Dados de cada visita:**
- Data e hora da visita
- Status: Visitou / Converteu / Expirou
- IP do visitante
- Navegador e sistema operacional (User-Agent)
- De onde veio (Referrer — Instagram, Google, etc.)
- **Metadados do dispositivo:** largura e altura da tela, idioma, timezone

**Paginacao:** 50 visitas por pagina com botoes anterior/proximo.

**Cenario:** Gerente quer entender quem clicou na campanha mas nao converteu → abre lista de visitas → filtra por `status='visited'` → ve que 80% acessou de Android, idioma pt-BR, timezone America/Sao_Paulo → confirma que publico-alvo bateu, mas mensagem de welcome pode nao estar atraente o suficiente.

> **Tecnico:** Hook `useCampaignVisits` com paginacao por range query (page * 50, from + 50). Tabela `utm_visits` (campaign_id, ref_code UNIQUE, visitor_ip, user_agent, referrer, contact_id FK, conversation_id FK, matched_at, status, visited_at, metadata JSONB). Metadata: screen_width, screen_height, language, timezone, form_started, form_started_at.

---

## Links Relacionados

- [[wiki/casos-de-uso/campanhas-detalhado]] — Indice geral
- [[wiki/casos-de-uso/campanhas-criacao]] — Criacao, landing, redirect, templates
- [[wiki/casos-de-uso/campanhas-operacao]] — Metricas, clone, leads, status
- [[wiki/casos-de-uso/ai-agent-detalhado]] — Contexto campanha injetado no prompt
- [[wiki/casos-de-uso/helpdesk-detalhado]] — Conversas tagueadas no helpdesk
