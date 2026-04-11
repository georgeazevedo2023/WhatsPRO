---
title: Caso de Uso — Campanha Deputado Estadual Anderson (Pernambuco)
tags: [caso-de-uso, politica, campanha, captacao, voluntarios, broadcast]
updated: 2026-04-08
---

# Caso de Uso — Campanha Deputado Anderson (PE)

## Contexto do Cliente

**Candidato:** Anderson — candidato a deputado estadual por Pernambuco
**Causa principal:** Causa animal
**Base territorial:** Caruaru e região
**Objetivo:** Alavancar campanha, captar eleitores, gerir voluntários e equipe, engajar base de apoiadores via WhatsApp

## Necessidades Mapeadas

| Necessidade | Funcionalidade WhatsPRO |
|-------------|------------------------|
| Captar leads via links no Instagram | Campanhas UTM + Bio Link + Funil Captação |
| Boas-vindas automáticas com materiais (vídeo, folder, áudio) | AI Agent (TTS + send_media) + Broadcast |
| Segmentar contatos por cidade/bairro de Caruaru | Tags estruturadas (cidade:X, bairro:X) + Leads Database |
| Atendimento automático inicial | AI Agent (SDR flow adaptado) |
| Disparos em massa segmentados | Broadcast + grupos por segmento |
| Gestão de voluntários e equipe | CRM Kanban + Helpdesk (roles: user/gerente) |
| Ações de captação complementares (sorteios, causas) | Funil tipo Sorteio/Captação |
| Base de dados estruturada | Leads Database + lead_profiles com campos custom |

## Funcionalidades Utilizadas (✅) vs Não Utilizadas (➖)

| Funcionalidade | Uso | Motivo |
|----------------|-----|--------|
| Campanhas UTM | ✅ | Links Instagram → rastreamento de origem |
| Bio Link | ✅ | Link único na bio do Instagram com múltiplos destinos |
| Formulários WhatsApp | ✅ | Captação estruturada no chat |
| Funis | ✅ | Orquestração completa de captação |
| AI Agent | ✅ | Boas-vindas automáticas + atendimento inicial |
| TTS (voz) | ✅ | Envio de áudios institucionais automáticos |
| send_media | ✅ | Vídeos, folders PDF, imagens |
| Broadcast | ✅ | Disparos segmentados por cidade/bairro/causa |
| Leads Database | ✅ | Base estruturada de eleitores |
| CRM Kanban | ✅ | Gestão de voluntários por etapa |
| Tags estruturadas | ✅ | Segmentação cidade:X, bairro:X, causa:X |
| Helpdesk | ✅ | Atendimento humano da equipe de campanha |
| Quick reply templates | ✅ | Respostas padronizadas para perguntas frequentes |
| Bulk actions | ✅ | Ações em massa no helpdesk |
| Agendamentos | ✅ | Mensagens programadas (dia de votação, eventos) |
| Catálogo de Produtos | ➖ | Sem produtos físicos — não aplicável |
| Quick Product Import | ➖ | Sem catálogo de produtos |
| Fuzzy product search | ➖ | Sem catálogo de produtos |
| Carrossel de produtos | ➖ | Pode ser adaptado para materiais, mas não é o foco |
| Agent QA Framework | ➖ | Uso interno de dev — não relevante para o cliente |

## Configuração do AI Agent para Campanha Política

### Identidade
- Nome: "Assistente da Campanha Anderson"
- Personalidade: "acolhedor, engajado, objetivo e próximo da comunidade"

### business_info
- Candidato: Anderson — Deputado Estadual PE
- Número: [número candidato TSE]
- Causa: Causa Animal, Proteção aos animais de rua, castração gratuita
- Canais: Instagram, WhatsApp
- Bairros de atuação: Caruaru e região

### Tags obrigatórias (VALID_KEYS adaptados)
- `cidade:X` — cidade do eleitor
- `bairro:X` — bairro em Caruaru
- `causa:animal` / `causa:saude` / `causa:educacao` — causa de interesse
- `perfil:eleitor` / `perfil:voluntario` / `perfil:doador` — tipo de apoiador
- `status:cadastrado` / `status:engajado` / `status:convertido`

### Fluxo SDR adaptado
1. Eleitor chega via campanha UTM ou Bio Link
2. Agente envia boas-vindas + material institucional (vídeo/folder via send_media)
3. Agente pergunta cidade e bairro → aplica tags
4. Agente pergunta causa de interesse → aplica `causa:X`
5. Agente pergunta interesse em voluntariado → se sim, `perfil:voluntario` + `move_kanban("Voluntários — Triagem")`
6. Handoff para coordenador de campanha quando necessário

## Kanban de Gestão de Voluntários

**Board: "Voluntários Anderson 2026"**
- Colunas: Cadastrado → Contatado → Treinamento → Ativo → Inativo

**Board: "Eleitores Estratégicos"**
- Colunas: Captado → Engajado → Apoiador Confirmado → Multiplicador

## Segmentação de Broadcasts

| Segmento | Tag/Critério | Conteúdo |
|----------|-------------|----------|
| Caruaru - Centro | `bairro:centro` | Eventos locais no Centro |
| Caruaru - Vassoural | `bairro:vassoural` | Ações no Vassoural |
| Causa Animal | `causa:animal` | Notícias sobre causa animal, PL de proteção |
| Voluntários Ativos | `perfil:voluntario` + kanban Ativo | Briefings internos, escalas |
| Eleitores Geral | `status:cadastrado` | Atualizações gerais da campanha |
| Multiplicadores | `status:convertido` | Materiais para compartilhamento |

## 10 Cenários de Uso

Ver seção abaixo no documento.

---

*Documentado em: 2026-04-08*
*Solicitante: George Azevedo (usuário)*
