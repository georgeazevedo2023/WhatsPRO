---
title: Bio Link — Documentacao Detalhada (Indice)
tags: [bio, link, linktree, captacao, leads, analytics, detalhado, indice]
sources: [src/components/bio/, src/pages/BioPage.tsx, supabase/functions/bio-public/]
updated: 2026-05-04
---

# Bio Link — Pagina de Links Estilo Linktree (Indice das 10 Sub-Funcionalidades)

> O Bio Link e uma **pagina publica de links** — como o Linktree, mas integrada ao CRM. Voce cria uma pagina bonita com logo, descricao e botoes que direcionam para WhatsApp, formularios, redes sociais, produtos do catalogo ou qualquer URL. O lead acessa, clica num botao, e o sistema registra tudo: de onde veio, o que clicou, e cria o lead automaticamente.
>
> Pense no link que voce coloca na bio do Instagram: "linktr.ee/suaempresa". Aqui, em vez de usar Linktree (que so tem links), voce tem uma pagina que **captura leads**, **injeta contexto na IA**, e **rastreia cliques** — tudo integrado ao seu CRM.
>
> Ver tambem: [[wiki/casos-de-uso/campanhas-detalhado]], [[wiki/casos-de-uso/formularios-detalhado]], [[wiki/casos-de-uso/leads-detalhado]]
>
> **Galeria de referencia (design):** `docs/referencia/bio-link-galeria-10-modelos.html` — 10 modelos profissionais (Corretor de Imoveis, Advocacia, Personal Trainer, etc.) gerados como inspiracao para futuros templates por nicho. Pode servir de ponto de partida para implementar templates customizaveis por nicho.

---

## Sub-paginas (organizadas por area)

A documentacao das 10 sub-funcionalidades foi particionada em 2 wikis tematicas (cada uma sob 200 linhas, regra 14 do CLAUDE.md). Use o indice abaixo para navegar:

| Sub-pagina | Sub-funcionalidades cobertas |
|------------|------------------------------|
| [[wiki/casos-de-uso/bio-link-configuracao]] | **9.1** Criacao e Edicao de Pagina, **9.2** Os 5 Tipos de Botao, **9.3** Pagina Publica (Renderizacao), **9.10** Gestao e Status |
| [[wiki/casos-de-uso/bio-link-operacao]] | **9.4** Captacao de Leads (Formulario Inline), **9.5** Analytics (Visualizacoes, Cliques, Leads), **9.6** Contexto IA (Bio Context), **9.7** Integracao com Funis, **9.8** Integracao com Formularios, **9.9** Integracao com Catalogo |

---

## Como navegar pelo bio-link-detalhado

- Construindo a pagina (templates, botoes, status, renderizacao)? → `bio-link-configuracao`
- Capturando leads, medindo desempenho, injetando contexto na IA ou ligando a funis/forms/catalogo? → `bio-link-operacao`

---

## Arvore de Componentes

```
BioLinksPage.tsx (admin — /dashboard/bio)
+-- Tab Paginas: lista + search + novo
|   +-- BioLinkCard.tsx (cada pagina)
|   +-- BioLinkEditor.tsx (Sheet — criacao/edicao)
|       +-- TemplateSelector.tsx (3 templates)
|       +-- BioButtonEditor.tsx (modal por botao)
|       +-- Captacao config (campos, titulo, botao)
|       +-- AI Context config (toggle + template)
|       +-- BioLinkPreview.tsx (preview live)
+-- Tab Analytics: KPIs + tabela por pagina

BioPage.tsx (publica — /bio/:slug)
+-- Capa + avatar + titulo + descricao
+-- Icones sociais (topo)
+-- Botoes (stack/featured/social_icon)
+-- BioLeadCaptureModal.tsx (formulario inline)
```

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `bio_pages` | Paginas (slug, titulo, template, cores, captacao, ai_context, view_count) |
| `bio_buttons` | Botoes (tipo, label, url/phone/form_slug/catalog, scheduling, click_count) |
| `bio_lead_captures` | Leads captados (contact_id, name, phone, email, extra_data) |

---

## Links Relacionados

- [[wiki/casos-de-uso/campanhas-detalhado]] — Campanhas que usam Bio Link
- [[wiki/casos-de-uso/formularios-detalhado]] — Formularios embutidos no Bio Link
- [[wiki/casos-de-uso/leads-detalhado]] — Leads criados com badge "Bio" (verde)
- [[wiki/casos-de-uso/ai-agent-detalhado]] — IA recebe bio_context no prompt
- [[wiki/modulos]] — Todos os 17 modulos

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico)*
*Rev 1 (2026-05-04): Particionado em 2 sub-wikis tematicas para respeitar regra 14 (max 200 linhas/MD). Este arquivo virou indice.*
