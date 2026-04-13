---
title: Métricas de Origem dos Leads — Visão e Gaps
tags: [metricas, origem, atribuicao, leads, campanhas, bio, gestao]
sources: [discussao-2026-04-12]
updated: 2026-04-12
---

# Métricas de Origem dos Leads — Visão e Gaps

## Fontes de Origem

| Origem | Como Identificar | Rastreamento Atual |
|--------|-----------------|-------------------|
| WhatsApp orgânico | Lead manda msg direto | ✅ Default (sem tag origem) |
| Campanha (SMS/WhatsApp) | `campaign_id` no lead, tag `origem:campanha` | ✅ Parcial |
| Bio Link | Captação via bio page, tag `origem:bio` | ✅ Parcial (M14) |
| Formulário | Submission via form-bot, tag `origem:formulario` | ✅ Parcial (M12) |
| Funil | Lead entrou via funil, tag `funil:SLUG` | ✅ Parcial (M16) |
| QR Code | Scan de QR → WhatsApp, UTM params | ❌ Não rastreado |
| Indicação/Referral | Lead menciona "fulano indicou" | ❌ Não extraído |
| Google/Site | Link "Fale no WhatsApp" no site | ❌ Não rastreado |
| Instagram/Facebook | Click no link do perfil | ❌ Não rastreado |
| Anúncio pago (Meta Ads) | Click-to-WhatsApp ads | ❌ Não rastreado |

## Métricas por Origem

| Métrica | Detalhe |
|---------|---------|
| **Volume por origem** | Quantos leads vieram de cada canal por período |
| **Taxa de conversão por origem** | Qual canal gera leads que compram |
| **Custo por lead por origem** | Investimento no canal / leads gerados |
| **Ticket médio por origem** | Leads de campanha gastam mais que orgânicos? |
| **Tempo até conversão por origem** | Bio link converte mais rápido que orgânico? |
| **Tipo de lead por origem** | Pintores vêm mais de campanha? Arquitetos do site? |
| **Qualidade do lead por origem** | Score médio, dados completos, taxa de handoff |
| **Retenção por origem** | Lead volta a comprar? Qual canal gera fidelidade? |
| **Horário por origem** | Campanha gera leads à noite? Bio de manhã? |
| **Funil de cada origem** | Contato → qualificação → intenção → conversão — por canal |

## Atribuição (UTM / Tracking)

| Parâmetro | Uso | Status |
|-----------|-----|--------|
| `utm_source` | Canal (google, instagram, whatsapp) | ❌ Não capturado |
| `utm_medium` | Tipo (cpc, organic, social, qrcode) | ❌ Não capturado |
| `utm_campaign` | Nome da campanha | ✅ Parcial (campaigns têm nome) |
| `utm_content` | Variação (botao_azul, banner_top) | ❌ Não capturado |
| `track_id` / `track_source` | Campos UAZAPI no payload | ✅ Disponível mas não usado |
| QR Code ID | Identificador único do QR | ❌ Não existe |

## Apresentação ao Gestor

| Visão | Detalhe |
|-------|---------|
| Gráfico de pizza/barras por origem | Distribuição dos leads por canal |
| Ranking de canais por conversão | Qual canal traz leads melhores |
| ROI por canal | Investimento vs retorno — onde investir mais |
| Tendência temporal por origem | Canal crescendo ou declinando |
| Mapa de calor origem × tipo de lead | Cruzamento origem com perfil |

## Status Atual

| Capacidade | Status |
|-----------|--------|
| Tag `origem:` nos leads | ✅ Parcial (bio, form, campanha) |
| `lead_profiles.origin` | ✅ Campo existe |
| `track_id` / `track_source` no webhook | ✅ UAZAPI envia (não usado) |
| UTM params capturados | ❌ Não implementado |
| Dashboard de origens | ❌ Não existe |
| ROI por canal | ❌ Não calculado |
| Conversão por origem | ❌ Não calculado |
| QR Code tracking | ❌ Não existe |
