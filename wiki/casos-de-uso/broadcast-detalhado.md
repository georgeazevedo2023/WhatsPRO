---
title: Broadcast — Documentacao Detalhada (Indice)
tags: [broadcast, disparador, mensagens, carrossel, enquete, leads, grupos, detalhado, indice]
sources: [src/pages/dashboard/Broadcaster.tsx, src/components/broadcast/, src/hooks/useBroadcastSend.ts]
updated: 2026-05-04
---

# Broadcast — Disparador de Mensagens em Massa (Indice das 12 Sub-Funcionalidades)

> O Broadcast (ou "Disparador") e a ferramenta para enviar **mensagens em massa** — a mesma mensagem para dezenas, centenas ou milhares de contatos ao mesmo tempo. Pense nele como um "mala direta" pelo WhatsApp: em vez de enviar mensagem 1 por 1, voce escreve uma unica vez e dispara para uma lista inteira.
>
> Serve para: promocoes ("10% off essa semana"), avisos ("Mudamos de endereco"), lancamentos ("Novo produto chegou"), enquetes ("Como foi seu atendimento?"), e qualquer comunicacao que precisa alcancar muitas pessoas.
>
> A grande diferenca de um broadcast simples e que aqui voce pode enviar **4 tipos de conteudo** (texto, midia, carrossel de produtos, e enquetes nativas do WhatsApp), para **2 tipos de destinatario** (grupos do WhatsApp ou lista de leads individual), com **agendamento**, **delay aleatorio** entre envios (para nao ser bloqueado pelo WhatsApp), e **historico completo** de tudo que foi enviado.
>
> Ver tambem: [[wiki/casos-de-uso/ai-agent-detalhado]] (IA responde quando lead reage ao broadcast), [[wiki/casos-de-uso/leads-detalhado]] (base de leads usada como destinatario)

---

## Sub-paginas (organizadas por area)

A documentacao das 12 sub-funcionalidades foi particionada em 3 wikis tematicas (cada uma sob 200 linhas, regra 14 do CLAUDE.md). Use o indice abaixo para navegar:

| Sub-pagina | Sub-funcionalidades cobertas |
|------------|------------------------------|
| [[wiki/casos-de-uso/broadcast-conteudo]] | **6.1** Os 4 Tipos de Conteudo (texto, midia, carrossel, enquete), **6.8** Templates de Mensagem, **6.12** Construtor de Carrossel |
| [[wiki/casos-de-uso/broadcast-audiencia]] | **6.2** Dois Modos de Envio (grupos vs leads), **6.3** Importador de Leads (4 formas), **6.4** Lead Databases (listas salvas), **6.11** Verificacao de Numeros |
| [[wiki/casos-de-uso/broadcast-execucao]] | **6.5** Agendamento, **6.6** Delay Aleatorio (anti-ban), **6.7** Progresso em Tempo Real, **6.9** Selecao de Instancia, **6.10** Historico de Broadcasts + Arvore de Componentes + Tabelas do Banco |

---

## Como navegar pelo broadcast-detalhado

- Procurando **o que voce envia** (tipos de conteudo, carrossel, templates)? → `broadcast-conteudo`
- Trabalhando com **para quem enviar** (grupos, leads, importacao, listas salvas, verificacao)? → `broadcast-audiencia`
- Precisa entender **como o disparo acontece** (agendamento, delay, progresso, instancia, historico)? → `broadcast-execucao`

---

## Links Relacionados

- [[wiki/casos-de-uso/ai-agent-detalhado]] — IA responde quando lead reage ao broadcast
- [[wiki/casos-de-uso/leads-detalhado]] — Base de leads usada como destinatario
- [[wiki/casos-de-uso/helpdesk-detalhado]] — Respostas ao broadcast aparecem no helpdesk
- [[wiki/modulos]] — Todos os 17 modulos
- [[wiki/uazapi-polls-interativos]] — Endpoints UAZAPI para enquetes

---

*Documentado em: 2026-04-10 — Sessao de documentacao detalhada com George Azevedo*
*Padrao dual: didatico (leigos) + tecnico (devs) em cada secao*
*Rev 1 (2026-05-04): Particionado em 3 sub-wikis tematicas para respeitar regra 14 (max 200 linhas/MD). Este arquivo virou indice.*
