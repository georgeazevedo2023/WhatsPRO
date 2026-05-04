---
title: Visao Geral — Os 19 Modulos da Plataforma
tags: [visao, modulos, funcionalidades, helpdesk, ai-agent, kanban, campanhas, funis]
sources: [wiki/modulos.md, wiki/visao-geral-completa.md]
updated: 2026-05-04
---

# WhatsPRO — Os 19 Modulos

> Catalogo completo dos modulos com resumo do que cada um faz e link para a wiki detalhada. Sub-wiki de [[wiki/visao-geral-completa]].

---

## Comunicacao (como a empresa fala com o lead)

**Helpdesk (25 sub-funcionalidades)** — A central de atendimento. Tela parecida com WhatsApp Web, mas profissional: lista de conversas a esquerda, chat no centro, perfil do lead a direita. Suporta etiquetas coloridas, notas privadas (so equipe ve), toggle IA liga/desliga, respostas rapidas com "/", acoes em massa (resolver 50 conversas de uma vez), transcricao automatica de audio, resumo IA de conversas longas, indicador de digitacao, busca global Ctrl+K, rascunhos automaticos, e finalizacao com categorizacao (venda/perdido/suporte/spam) + NPS.
→ [[wiki/casos-de-uso/helpdesk-detalhado]]

**Broadcast (12 sub-funcionalidades)** — Disparador de mensagens em massa. 4 tipos de conteudo (texto, midia, carrossel, enquete nativa). Pode enviar para grupos WhatsApp ou lista de leads individual. Importador de contatos (colar numeros, CSV, extrair de grupos, manual). Delay aleatorio anti-ban (5-10s ou 10-20s entre envios). Agendamento de envio. Progresso em tempo real com pause/resume. Templates reutilizaveis. Historico completo com filtros e reenvio.
→ [[wiki/casos-de-uso/broadcast-detalhado]]

**Formularios WhatsApp (13 sub-funcionalidades)** — Questionarios interativos DENTRO do chat. O bot faz uma pergunta, o lead responde, o bot valida e faz a proxima. 16 tipos de campo (texto, numero, email, CPF com checksum, CEP, telefone, selecao, sim/nao, escala, data, hora, arquivo, assinatura, enquete nativa). 12 templates prontos (NPS, sorteio, cadastro, orcamento, vaga, etc.). Maximo 3 tentativas por campo. Webhook externo ao completar. Lead criado automaticamente com os dados coletados.
→ [[wiki/casos-de-uso/formularios-detalhado]]

---

## Inteligencia (como o sistema pensa e decide)

**AI Agent (15 sub-funcionalidades)** — O vendedor robo. Usa OpenAI gpt-4.1-mini como cerebro (com fallback para Gemini → Mistral → templates estaticos se cair). 9 ferramentas: buscar produto, enviar carrossel, enviar foto, transferir para humano, aplicar etiqueta, aplicar tags, mover card no Kanban, atualizar perfil do lead, enviar enquete. Fluxo SDR inteligente: termos genericos → qualifica primeiro, termos especificos → busca imediata. Modo Sombra: apos transferir para humano, IA continua "ouvindo" e extraindo dados automaticamente. Validator Agent: supervisor de qualidade que audita cada resposta (score 0-10). TTS: resposta por voz (6 vozes). Prompt Studio: admin customiza comportamento em 9 secoes. Perfis de Atendimento: pacotes reutilizaveis de comportamento por contexto.
→ [[wiki/casos-de-uso/ai-agent-detalhado]]

**Motor de Automacao (9 sub-funcionalidades)** — Regras "SE acontecer X → ENTAO fazer Y" sem IA, pura logica. 7 gatilhos (formulario concluido, enquete respondida, card movido, lead criado, conversa resolvida, tag adicionada, etiqueta aplicada). 4 condicoes (sempre, tag contem, horario comercial, funil e). 6 acoes (enviar mensagem, mover card, adicionar tag, ativar IA, transferir, enviar enquete). Regras executam em ordem, erros isolados (uma nao quebra outra).
→ [[wiki/casos-de-uso/motor-automacao-detalhado]]

**Enquetes e NPS (10 sub-funcionalidades)** — Votacoes nativas WhatsApp (botoes clicaveis, nao "1, 2, 3"). 4 canais de envio (broadcast, IA, formulario, automacao). NPS automatico pos-atendimento com delay configuravel. Guard: nao envia se lead saiu irritado. Nota ruim notifica gerentes automaticamente. Dashboard com metricas (taxa de resposta, NPS medio, distribuicao).
→ [[wiki/casos-de-uso/enquetes-nps-detalhado]]

**Agent QA Framework (8 sub-funcionalidades)** — Testes automatizados do agente IA. 30+ cenarios de teste que enviam mensagens REAIS pelo WhatsApp e verificam se a IA respondeu certo. Score composto de 4 fatores (taxa E2E 40% + Validator 30% + ferramentas 20% + latencia 10%). Fila de aprovacao humana (falso positivo vs regressao real). Deteccao automatica de regressao. Ciclo agendado (a cada 6h por padrao).
→ [[wiki/casos-de-uso/agent-qa-detalhado]]

---

## CRM & Leads (como a empresa gerencia clientes)

**Leads Database (12 sub-funcionalidades)** — Cadastro inteligente com 25+ campos. Perfil completo: nome, cidade, email, interesses, ticket medio, objecoes — a maioria preenchida automaticamente pela IA. Badge de origem colorido (verde=Bio, azul=Campanha, roxo=Formulario, laranja=Funil). Timeline de jornada visual (clique no bio → formulario → conversa → kanban). Toggle IA por lead. Clear Context (reset total). Importacao CSV. Formularios respondidos. Card do funil ativo.
→ [[wiki/casos-de-uso/leads-detalhado]]

**CRM Kanban (11 sub-funcionalidades)** — Quadro visual de vendas com colunas personalizaveis. Drag & drop para mover cards entre etapas. 5 tipos de campo customizavel (texto, moeda R$, data, selecao, entidade). Entidades reutilizaveis (tabelas de valores compartilhadas). Controle de acesso (compartilhado/privado, editor/visualizador). A IA move cards automaticamente (tool move_kanban). Finalizacao de ticket move card para coluna correspondente.
→ [[wiki/casos-de-uso/crm-kanban-detalhado]]

**Catalogo de Produtos (10 sub-funcionalidades)** — Estoque digital do agente IA. Importacao rapida por URL (cola link de qualquer loja → nome, preco, descricao, fotos preenchidos automaticamente). Importacao CSV (ate 5.000 produtos). Importacao em lote (cola URL de pagina de categoria → varre todos os produtos). Busca fuzzy que corrige erros de digitacao ("cooral" → "Coral", 78% semelhanca). Descricao gerada por IA.
→ [[wiki/casos-de-uso/catalogo-detalhado]]

---

## Campanhas & Funis (como a empresa atrai e converte leads)

**Campanhas UTM (12 sub-funcionalidades)** — Links rastreaveis + QR Code. Landing page com countdown 3s ou formulario. 6 tipos (venda, suporte, promocao, evento, reativacao, fidelizacao). Metricas: visitas, conversoes, taxa, abandono de formulario. Atribuicao automatica (conversa tagueada com campanha:NOME). Guards de seguranca (campanha inativa/expirada nao tagueia). IA recebe contexto da campanha no prompt. Clone de campanha em 1 clique.
→ [[wiki/casos-de-uso/campanhas-detalhado]]

**Bio Link (10 sub-funcionalidades)** — Pagina de links estilo Linktree integrada ao CRM. 3 templates visuais (simples/shopping/negocio). 5 tipos de botao (URL, WhatsApp, formulario, rede social, produto do catalogo). Agendamento de botoes (starts_at/ends_at). Captacao de leads com formulario inline. Analytics (views, clicks, leads, CTR). Contexto injetado na IA.
→ [[wiki/casos-de-uso/bio-link-detalhado]]

**Funis (13 sub-funcionalidades)** — O maestro que orquestra tudo. Wizard de 4 passos que cria em 1 clique: campanha + bio link + formulario + kanban. 7 tipos de funil (sorteio, captacao, venda, vaga, lancamento, evento, atendimento). Motor de automacao integrado. Instrucoes IA por funil. Perfis de atendimento reutilizaveis. Metricas de conversao. Tag funil:SLUG propagada automaticamente por 3 edge functions.
→ [[wiki/casos-de-uso/funis-detalhado]]

---

## Infraestrutura (como o sistema funciona por tras)

**Dashboard e Intelligence (8 sub-funcionalidades)** — Painel de KPIs: instancias online, leads hoje, funis ativos, NPS. Graficos de conversao, performance de atendentes (ranking + tempo de resposta). Intelligence: IA analisa conversas e gera insights (top motivos, produtos, objecoes, sentimento).
→ [[wiki/casos-de-uso/dashboard-detalhado]]

**Agendamentos (6 sub-funcionalidades)** — Mensagens programadas unicas ou recorrentes (diario, semanal, mensal) com delay anti-ban. Gestao: pausar, retomar, cancelar. Edge function com pg_cron.
→ [[wiki/casos-de-uso/agendamentos-detalhado]]

**Instancias WhatsApp (7 sub-funcionalidades)** — Gestao de numeros: conectar via QR Code, monitoramento de status a cada 30s, controle de acesso por usuario, detalhes com 4 abas (geral, stats, grupos, historico), delete soft/hard.
→ [[wiki/casos-de-uso/instancias-detalhado]]

**Deploy e Infraestrutura (6 sub-funcionalidades)** — Docker multi-stage (Node → nginx), CI/CD GitHub Actions (push master → build → ghcr.io), servidor Hetzner CX42 com Docker Swarm + Traefik + SSL, Portainer para gerenciamento visual. Health check endpoint. Checklist obrigatorio pre/pos deploy.
→ [[wiki/casos-de-uso/deploy-detalhado]]

---

## Links Relacionados

- [[wiki/visao-geral-completa]] — Indice da visao geral
- [[wiki/visao-geral-projeto]] — O que e, problema, papeis, posicionamento
- [[wiki/visao-geral-arquitetura]] — Stack, banco e fluxo de dados
- [[wiki/visao-geral-jornadas-numeros]] — Jornada, numeros, roadmap
- [[wiki/modulos]] — Tabela canonica de todos os modulos com status

---

*Documentado em: 2026-05-04 — Particionado de visao-geral-completa.md (regra 14 max 200 linhas)*
