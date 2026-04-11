---
title: Instancias WhatsApp — Documentacao Detalhada
tags: [instancias, whatsapp, qrcode, conexao, acesso, detalhado]
sources: [src/pages/dashboard/Instances.tsx, src/hooks/useInstances.ts, src/hooks/useQrConnect.ts]
updated: 2026-04-10
---

# Instancias WhatsApp — Gestao de Numeros (7 Sub-Funcionalidades)

> Cada "instancia" e um **numero de WhatsApp** conectado ao sistema. A empresa pode ter varios numeros (ex: "Vendas", "Suporte", "Marketing") e cada um e uma instancia separada. O modulo de Instancias permite conectar, desconectar, monitorar status e controlar quem tem acesso a cada numero.
>
> Ver tambem: [[wiki/casos-de-uso/helpdesk-detalhado]] (conversas por instancia), [[wiki/modulos]]

---

## 16.1 Criar e Conectar Instancia (QR Code)

**O que e:** Para conectar um numero de WhatsApp ao sistema, o admin cria uma instancia e escaneia o QR Code com o celular — igual a conectar o WhatsApp Web.

**Fluxo:** Criar instancia (nome + usuario) → sistema gera token → abre modal com QR Code → escaneia com celular → instancia conectada → status muda para "Online".

**Reconexao:** Se desconectar (celular sem internet, logout), basta clicar "Conectar" e escanear o QR novamente.

> **Tecnico:** Criar: INSERT `instances` + chamada UAZAPI para provisionar. QR: hook `useQrConnect.ts` — `connect()` busca QR da UAZAPI, `checkIfConnected()` polling 5s. Token: 32 chars aleatorios. Modal: `ScheduleMessageDialog` pattern com QR image. Status check: UAZAPI retorna `connectionStatus|status` + `ownerJid|owner`.

---

## 16.2 Monitoramento de Status (Tempo Real)

**O que e:** O sistema verifica automaticamente a cada 30 segundos se cada instancia esta conectada ou desconectada. Badge visual verde (Online) ou vermelho (Offline) em cada card.

> **Tecnico:** Polling 30s em `Instances.tsx` via `updateInstancesStatus()`. Para cada instancia: GET UAZAPI status. Mapeia: `connectionStatus|status`, `ownerJid|owner`, `profilePicUrl|profilePic`. UPDATE DB apenas se mudou. Icones: Wifi (conectado), WifiOff (desconectado).

---

## 16.3 Controle de Acesso (Quem Ve Qual Numero)

**O que e:** O admin define quais usuarios tem acesso a cada instancia. Usuarios so veem conversas/grupos das instancias que tem acesso.

**Dialog de acesso:** Lista todos os usuarios com checkboxes. Super admins sempre tem acesso (checkbox desabilitado). Salvar calcula ADD/REMOVE e atualiza.

> **Tecnico:** Tabela `user_instance_access` (user_id UUID, instance_id TEXT — UNIQUE constraint). Dialog `ManageInstanceAccessDialog.tsx`. Save: computa sets ADD/REMOVE, batch upsert. RLS enforce visibilidade em todas as queries.

---

## 16.4 Detalhes da Instancia (4 Abas)

**O que e:** Pagina detalhada de cada instancia com 4 abas.

- **Visao Geral** — nome, status, telefone (extraido do owner_jid), ID, token (mascarado), dono, datas, botao conectar
- **Estatisticas** — total de grupos, participantes, uptime, ultima atividade
- **Grupos** — lista de grupos WhatsApp com busca, refresh (retry 3x)
- **Historico** — timeline de eventos de conexao (conectou/desconectou/criou)

> **Tecnico:** Pagina `InstanceDetails.tsx` com tabs. Componentes: `InstanceOverview.tsx`, `InstanceStats.tsx`, `InstanceGroups.tsx` (hook `useInstanceGroups`), `InstanceHistory.tsx` (tabela `instance_connection_logs`). Logs: event_type 'connected'|'disconnected'|'created', metadata JSONB.

---

## 16.5 Exclusao (Soft e Hard Delete)

**O que e:** Duas formas de remover instancia.

- **Soft delete** — marca `disabled=true`. Esconde do painel mas dados preservados. Recuperavel.
- **Hard delete** — remove da UAZAPI + banco. Irreversivel. Cascata: deleta `user_instance_access`, `scheduled_messages`. SET NULL em: `inboxes`, `kanban_boards`.

> **Tecnico:** Soft: UPDATE `instances SET disabled=true`. Hard: DELETE UAZAPI + DELETE DB com CASCADE/SET NULL conforme FKs. Confirmacao com dialog.

---

## 16.6 Foto de Perfil

**O que e:** Foto do WhatsApp da instancia exibida no card e no detalhe. Atualizada automaticamente a cada 30s junto com o status.

> **Tecnico:** Campo `instances.profile_pic_url`. Fontes UAZAPI: `profilePicUrl`, `profilePic`, `profilePictureUrl`. Fallback: icone Server. Atualizado no polling de status.

---

## 16.7 Sincronizacao de Instancias

**O que e:** Dialog que importa instancias existentes na UAZAPI que nao estao no banco, e limpa instancias orfas (no banco mas nao na UAZAPI).

> **Tecnico:** Componente `SyncInstancesDialog.tsx`. Compara lista UAZAPI com lista DB. Import: INSERT missing. Cleanup: flag orfas para revisao.

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `instances` | Instancias (id TEXT PK, name, token, status, owner_jid, profile_pic_url, disabled) |
| `user_instance_access` | Acesso N:N (user_id, instance_id — UNIQUE) |
| `instance_connection_logs` | Historico de conexao (event_type, description, metadata) |

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico)*
