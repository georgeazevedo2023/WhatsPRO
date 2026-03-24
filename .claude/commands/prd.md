# WhatsPRO PRD - Consulta e Atualização

Você é o assistente do projeto WhatsPRO. Ao receber este comando, execute as seguintes ações:

## 1. Carregar Contexto
Leia o arquivo `PRD.md` na raiz do projeto para obter o contexto completo do sistema, incluindo:
- Todos os módulos e funcionalidades com seus status
- Changelog de versões
- Infraestrutura (banco, edge functions, storage, segurança)
- Roadmap de próximas features

## 2. Apresentar Status
Após ler o PRD, apresente ao usuário:
- Versão atual e data da última atualização
- Resumo dos módulos com contagem de tasks por status (✅/🔄/📋)
- Itens do Roadmap pendentes
- Se houver argumentos, filtre pelo módulo solicitado (ex: `/prd M2` mostra só Helpdesk)

## 3. Auto-Atualização
Sempre que uma nova funcionalidade for **implementada e testada** durante a conversa:

1. Atualize o `PRD.md`:
   - Incremente a versão (patch para fixes, minor para features)
   - Adicione entrada no Changelog com data de hoje
   - Marque a task correspondente como ✅ no módulo
   - Se era item do Roadmap, mova para o módulo e remova do Roadmap
   - Atualize contadores na seção de Infraestrutura se necessário

2. Confirme ao usuário o que foi atualizado no PRD

## 4. Argumentos Aceitos
- `/prd` — Status geral de todos os módulos
- `/prd M1` a `/prd M9` — Status de um módulo específico
- `/prd M10` — Status do Agente IA (sprints S1-S5)
- `/prd M11` — Status do Módulo Leads
- `/prd roadmap` — Mostrar apenas o Roadmap (inclui R38-R67 da auditoria v2.9.0)
- `/prd changelog` — Mostrar apenas o Changelog
- `/prd infra` — Mostrar infraestrutura e segurança
- `/prd audit` — Mostrar findings da auditoria v2.9.0 (30 sugestões R38-R67)
- `/prd security` — Mostrar apenas issues de segurança pendentes
- `/prd update` — Forçar re-leitura do PRD e apresentar status atualizado

## 5. Seção de Auditoria (v2.9.0)

Ao receber `/prd audit` ou `/prd security`, apresente:

1. **Status das 30 sugestões** (R38-R67) com progresso (📋/🔄/✅)
2. **Issues críticas** pendentes (segurança, bugs, performance)
3. **Roadmap de implementação** sugerido (semanas 1-4)
4. **Cross-reference** com findings nas skills `/ai-agent` (seção Auditoria) e `/uazapi` (seção 9)

### Categorias da auditoria:
| Categoria | IDs | Qtd |
|-----------|-----|-----|
| Segurança | R38-R43 | 6 |
| Banco de Dados | R44-R50 | 7 |
| Código & Tipagem | R51-R56 | 6 |
| UX/UI | R57-R64 | 8 |
| Performance & Qualidade | R65-R67 | 3 |

## 6. Importação Rápida de Produtos (v3.0.0)

Feature S6 implementada: Admin cola URL de produto de qualquer site → Edge Function `scrape-product` extrai dados → preenche formulário do catálogo para revisão.

**Componentes:**
- Edge Function: `supabase/functions/scrape-product/index.ts` (parser multi-camada)
- Frontend: `CatalogConfig.tsx` — seção "Importação Rápida" no dialog Novo Produto
- Extração: JSON-LD, `__NEXT_DATA__`, OG tags, breadcrumbs, CDN images

## Referências
- PRD completo: `PRD.md` (raiz do projeto)
- Contexto técnico: `CLAUDE.md`
- API WhatsApp: `/uazapi` (inclui seção 9 — Auditoria de segurança)
- AI Agent: `/ai-agent` (inclui Sprint 6 — Importação Rápida + Auditoria v2.9.0)
