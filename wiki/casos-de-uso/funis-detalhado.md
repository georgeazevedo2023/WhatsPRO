---
title: Funis — Documentacao Detalhada (Indice)
tags: [funis, wizard, automacao, agentico, perfis, metricas, detalhado, indice]
sources: [src/pages/dashboard/FunnelWizard.tsx, src/pages/dashboard/FunnelDetail.tsx, src/hooks/useCreateFunnel.ts]
updated: 2026-05-04
---

# Funis — Orquestrador Completo de Vendas (Indice das 13 Sub-Funcionalidades)

> O Funil e o **maestro** que orquestra todos os outros modulos. Em vez de configurar campanha, bio link, formulario e kanban separadamente, voce cria um funil e ele **monta tudo automaticamente em 1 clique**: gera o link da campanha, cria a pagina de links, configura o formulario, cria o quadro kanban com as colunas certas, e conecta tudo.
>
> Pense assim: voce quer fazer um sorteio para captar leads. Sem funil, teria que: (1) criar campanha UTM, (2) criar Bio Link com botao de formulario, (3) criar formulario com campos nome/CPF, (4) criar board Kanban com colunas Inscrito->Confirmado->Sorteado, (5) configurar IA para esse contexto. Com funil, voce escolhe "Sorteio" no wizard e **tudo isso e criado em 30 segundos**.
>
> Alem de orquestrar, o funil tem seu proprio **motor de automacao** (gatilho -> condicao -> acao) e **instrucoes para a IA** especificas por contexto (perfis de atendimento).
>
> Ver tambem: [[wiki/casos-de-uso/campanhas-detalhado]], [[wiki/casos-de-uso/bio-link-detalhado]], [[wiki/casos-de-uso/formularios-detalhado]], [[wiki/casos-de-uso/crm-kanban-detalhado]], [[wiki/casos-de-uso/ai-agent-detalhado]]

---

## Sub-paginas (organizadas por area)

A documentacao das 13 sub-funcionalidades foi particionada em 3 wikis tematicas (cada uma sob 200 linhas, regra 14 do CLAUDE.md). Use o indice abaixo para navegar:

| Sub-pagina | Sub-funcionalidades cobertas |
|------------|------------------------------|
| [[wiki/casos-de-uso/funis-wizard-tipos]] | **10.1** Wizard de Criacao (4 passos), **10.2** Os 7 Tipos de Funil, **10.12** Importar Recursos Existentes, **10.13** Sidebar Unificada (3->1) |
| [[wiki/casos-de-uso/funis-operacao-visualizacao]] | **10.3** Pagina de Funis (Lista + KPIs), **10.4** Detalhe do Funil (KPIs + Kanban + 5 Tabs), **10.5** Tag funil:SLUG (Propagacao), **10.10** LeadFunnelCard, **10.11** OriginBadge Funil |
| [[wiki/casos-de-uso/funis-inteligencia-metricas]] | **10.6** Motor de Automacao (M17 F1), **10.7** Funis Agenticos (M17 F2), **10.8** Perfis de Atendimento (M17 F3), **10.9** Metricas do Funil |

---

## Como navegar pelo funis-detalhado

- Vai **criar um funil novo** (wizard, escolher tipo, importar existente)? -> `funis-wizard-tipos`
- Vai **operar funis ja criados** (lista, detalhe, ver lead num funil)? -> `funis-operacao-visualizacao`
- Configurando **automacao, IA personalizada, perfis ou metricas**? -> `funis-inteligencia-metricas`

---

## Links Relacionados

- [[wiki/casos-de-uso/campanhas-detalhado]] — Campanhas orquestradas pelo funil
- [[wiki/casos-de-uso/bio-link-detalhado]] — Bio Links orquestrados pelo funil
- [[wiki/casos-de-uso/formularios-detalhado]] — Formularios orquestrados pelo funil
- [[wiki/casos-de-uso/crm-kanban-detalhado]] — Boards Kanban criados pelo funil
- [[wiki/casos-de-uso/ai-agent-detalhado]] — IA com contexto do funil + perfis
- [[wiki/modulos]] — Todos os 17 modulos
- [[wiki/decisoes-chave]] — Decisoes M16/M17 (fusao funis, motor automacao, perfis)

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico)*
*Rev 1 (2026-05-04): Particionado em 3 sub-wikis tematicas para respeitar regra 14 (max 200 linhas/MD). Este arquivo virou indice.*
