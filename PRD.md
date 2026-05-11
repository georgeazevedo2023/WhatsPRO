# WhatsPRO — PRD

> **Plataforma multi-tenant de atendimento WhatsApp**: helpdesk, CRM Kanban, AI Agent, Leads, Campanhas, Funis e Automação. React + Supabase + UAZAPI. Produção: `crm.wsmart.com.br`.

Este arquivo é o **índice da documentação do produto**. Conteúdo distribuído em arquivos especializados (regra hard limit 300 linhas — ver `CLAUDE.md`).

---

## 📚 Mapa da documentação

| Quando você precisa de... | Vá para |
|---|---|
| Releases recentes (últimos ~14 dias) | [[CHANGELOG]] |
| Histórico completo de releases | [[wiki/changelog/]] (particionado por mês) |
| Lista de tasks shipadas por módulo | [[wiki/modulos]] |
| Stack, edge functions, segurança, storage | [[wiki/infraestrutura]] |
| Milestones top-level (M1-M19) shipados | [[wiki/roadmap]] |
| Itens planejados (resumo) | [[wiki/roadmap/planejado-resumo]] |
| Detalhe de módulos planejados (M10-M13) | [[wiki/roadmap/m10-agente-ia-part1]], [[wiki/roadmap/m11-ecommerce-part1]], [[wiki/roadmap/m12-formularios]], [[wiki/roadmap/m13-cursos-part1]] |
| Melhorias planejadas em módulos existentes (R18-R30) | [[wiki/roadmap/melhorias-existentes]] |
| Regras de implementação obrigatórias | `RULES.md` |
| Padrões de código por área | `PATTERNS.md` |
| Arquitetura técnica | `ARCHITECTURE.md` |
| Pipeline de áudio (helpdesk) | [[wiki/audio-pipeline]] |
| Erros e lições aprendidas | [[wiki/erros-e-licoes]] |

---

## Visão Geral

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + shadcn/ui + Tailwind + react-query
- **Backend**: Supabase (Postgres + Edge Functions Deno + Realtime + Storage + Vault)
- **WhatsApp**: UAZAPI (proxy oficial sobre WhatsApp Web — `https://wsmart.uazapi.com`)
- **AI**: OpenAI gpt-4.1-mini (primary), Gemini/Groq (fallback/specialized — transcrição usa Groq Whisper)
- **Hospedagem**: Vercel (frontend) + Supabase Cloud (backend) + Portainer (Docker self-hosted opcional)

Detalhes completos em [[wiki/infraestrutura]].

### Arquitetura

Mensagens WhatsApp → UAZAPI → webhook → DB → Realtime → UI. Detalhe end-to-end por área:
- Áudio: [[wiki/audio-pipeline]]
- Geral: `ARCHITECTURE.md`

### Roles de Usuário

| Role | Permissões |
|---|---|
| `super_admin` | Tudo. CRUD users, configs globais, audit logs |
| `gerente` | Acesso multi-inbox, métricas, gerencia agentes |
| `user` (atendente) | Acesso à(s) inbox(es) atribuída(s), responde conversas, fila de handoff |

Política RLS detalhada em [[wiki/modulos]] (M5).

---

## Como manter este PRD

Após shipar uma feature:

1. **Nova entrada no `CHANGELOG.md`** (raiz, releases recentes) com versão semver
2. Se a feature adicionou tasks a um módulo existente, atualizar `wiki/modulos.md`
3. Se mudou infraestrutura (nova edge function, bucket, etc), atualizar `wiki/infraestrutura.md`
4. Se passou >14 dias, mover release antiga do `CHANGELOG.md` para o arquivo do mês em `wiki/changelog/`
5. **Manter este arquivo curto** — adicionar só ponteiros, não conteúdo
