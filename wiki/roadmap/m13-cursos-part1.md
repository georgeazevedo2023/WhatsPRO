---
title: Roadmap — M13 Cursos & Membership (parte 1)
type: roadmap-detail
updated: 2026-05-11
---

# M13 — Cursos & Membership WhatsApp (parte 1: T13.1-T13.5)

> Continuação em [[wiki/roadmap/m13-cursos-part2]].

#### M13 - Cursos & Membership WhatsApp 📋

> **Visão**: Entregar conteúdo educacional e membership via WhatsApp com tracking de progresso.
> Ideal para: infoprodutores, coaches, consultores, escolas que querem entregar cursos pelo WhatsApp.

| Task | Status | Descrição |
|------|--------|-----------|
| T13.1 CRUD cursos com seções e lições | 📋 | Hierarquia: curso → seção → lição (texto, mídia, link) |
| T13.2 Enrollment via WhatsApp | 📋 | Inscrever contato e liberar acesso por mensagem |
| T13.3 Lesson completions | 📋 | Tracking de progresso (lição concluída / pendente) |
| T13.4 Drip content | 📋 | Liberar lições por tempo ou conclusão da anterior |
| T13.5 Notificações WhatsApp | 📋 | "Nova aula disponível!", lembretes de conclusão |
| T13.6 Certificado de conclusão | 📋 | Geração automática ao completar curso |
| T13.7 Área de membros (web) | 📋 | Portal web para acessar conteúdo + progresso |
| T13.8 Quizzes e avaliações | 📋 | Perguntas após cada lição para fixar aprendizado |
| T13.9 Comunidade de alunos | 📋 | Grupo WhatsApp exclusivo por curso |
| T13.10 Gamificação | 📋 | Pontos, badges, ranking entre alunos |

##### T13.1 — CRUD Cursos com Seções e Lições
**Descrição completa**: Interface de administração para criar e gerenciar cursos com estrutura hierárquica.

**Hierarquia**:
```
📚 Curso: "Marketing Digital Completo"
├── 📂 Seção 1: "Fundamentos"
│   ├── 📄 Lição 1.1: "O que é Marketing Digital" (texto + vídeo)
│   ├── 📄 Lição 1.2: "Os 4 Ps do Marketing" (texto + imagem)
│   └── 📄 Lição 1.3: "Definindo seu Público-Alvo" (texto + exercício)
├── 📂 Seção 2: "Tráfego Pago"
│   ├── 📄 Lição 2.1: "Introdução ao Google Ads" (vídeo)
│   ├── 📄 Lição 2.2: "Facebook Ads do Zero" (vídeo + PDF)
│   └── 📄 Lição 2.3: "Otimização de Campanhas" (texto + quiz)
└── 📂 Seção 3: "Vendas"
    ├── 📄 Lição 3.1: "Funis de Venda" (texto + template)
    └── 📄 Lição 3.2: "Copywriting Persuasivo" (vídeo + exercício)
```

**Tipos de conteúdo por lição**:
| Tipo | Entrega WhatsApp | Entrega Web |
|------|-----------------|-------------|
| Texto | Mensagem formatada | Artigo renderizado |
| Vídeo | Link YouTube/Vimeo + thumbnail | Player embutido |
| Áudio | Mensagem de áudio | Player de áudio |
| PDF | Documento anexado | Viewer embutido |
| Imagem | Imagem no chat | Galeria |
| Link externo | Link clicável | Iframe ou redirect |
| Exercício | Formulário via bot (M12) | Form web |
| Quiz | Perguntas via bot | Form web interativo |

**Schema**:
```sql
courses: id, workspace_id, name, description, slug, cover_image,
         status (draft/published/archived), price, max_enrollments,
         drip_enabled, drip_interval_days, created_at

course_sections: id, course_id, name, description, position, published

course_lessons: id, section_id, name, description, content_type,
                content_data (JSONB), position, published,
                duration_minutes, is_free_preview
```

---

##### T13.2 — Enrollment via WhatsApp
**Descrição completa**: Inscrever contatos em cursos e liberar acesso ao conteúdo via WhatsApp.

**Formas de enrollment**:
| Método | Descrição | Exemplo |
|--------|-----------|---------|
| Manual (admin) | Admin inscreve contato pelo painel | Clicar "Inscrever" no perfil do contato |
| Automático (pedido M11) | Ao comprar produto vinculado ao curso | Comprou "Curso Marketing" → inscrito automaticamente |
| Automático (funil M10) | Step do funil inscreve no curso | Completou funil de onboarding → inscrito no mini-curso |
| Por link | Contato acessa link → inscrito | `https://cursos.whatspro.com/marketing-digital/inscrever` |
| Por keyword | Contato envia keyword → inscrito | Envia "CURSO" → inscrito no curso da vez |
| Importação | CSV com lista de contatos | Upload de planilha com telefones |

**Mensagem de boas-vindas ao inscrever**:
```
🎓 Parabéns, {{nome}}! Você está inscrito no curso:

📚 *Marketing Digital Completo*
📝 8 lições em 3 módulos
⏱️ Duração estimada: 5 horas
📅 Início: agora!

Sua primeira aula está pronta. Quer começar? Responda *SIM*!
```

---

##### T13.3 — Lesson Completions
**Descrição completa**: Tracking de progresso de cada aluno em cada lição do curso.

**Status por lição**:
- 🔒 Bloqueada (drip não liberou ainda)
- ⬜ Disponível (não iniciada)
- 🔄 Em andamento (visualizou mas não completou)
- ✅ Concluída (marcou como concluída ou passou no quiz)

**Mensagem de progresso**:
```
Bot: [Envia conteúdo da Lição 2.1]
Bot: "Quando terminar de assistir, responda CONCLUÍDO para avançar!"
Contato: "concluído"
Bot: "✅ Lição 2.1 concluída!
      📊 Progresso: ████████░░ 75% (6/8 lições)
      ➡️ Próxima: Lição 2.2 — Facebook Ads do Zero
      Quer continuar? Responda SIM"
```

**Dashboard do admin**:
- Lista de alunos com % de conclusão
- Alunos inativos (sem progresso há X dias)
- Lição com maior taxa de desistência
- Tempo médio de conclusão por lição

---

##### T13.4 — Drip Content
**Descrição completa**: Liberar lições gradualmente ao longo do tempo ou baseado em conclusão.

**Modos de drip**:

| Modo | Configuração | Exemplo |
|------|-------------|---------|
| Por tempo fixo | X dias após inscrição | Lição 1 no dia 0, Lição 2 no dia 3, Lição 3 no dia 7 |
| Por conclusão | Próxima após completar anterior | Completou Lição 1 → libera Lição 2 |
| Híbrido | Conclusão + tempo mínimo | Completou Lição 1 + 2 dias → libera Lição 2 |
| Dia da semana | Liberar em dias específicos | Nova lição toda segunda-feira |
| Data fixa | Data específica | Módulo 3 libera em 01/04/2026 |
| Tudo liberado | Sem drip | Todas as lições disponíveis desde o início |

**Exemplo de drip por tempo**:
```
Dia 0 (inscrição):
  Bot: "🎓 Aula 1 disponível! [conteúdo]"

Dia 3:
  Bot: "📚 {{nome}}, sua Aula 2 acabou de ser liberada!
        Módulo: Tráfego Pago
        Lição: Introdução ao Google Ads
        Quer assistir agora? Responda SIM"

Dia 7:
  Bot: "📚 Aula 3 liberada! Mas percebi que você ainda não
        concluiu a Aula 2. Que tal terminar primeiro? 😊"
```

---

##### T13.5 — Notificações WhatsApp
**Descrição completa**: Mensagens automáticas para manter alunos engajados.

**Tipos de notificação**:

| Evento | Timing | Mensagem exemplo |
|--------|--------|-----------------|
| Nova aula liberada | Imediato | "📚 Nova aula disponível: {{aula_nome}}!" |
| Lembrete de aula pendente | 3 dias sem atividade | "Ei {{nome}}, a Aula 3 está te esperando! 📖" |
| Inatividade prolongada | 7 dias sem atividade | "Sentimos sua falta! Falta pouco para concluir o curso 💪" |
| Seção concluída | Imediato | "🎉 Parabéns! Você concluiu o módulo Fundamentos!" |
| Quase lá | 80% de progresso | "Falta só 1 aula para concluir! Você consegue 🚀" |
| Curso concluído | Imediato | "🏆 Parabéns! Você concluiu o curso Marketing Digital!" |
| Certificado pronto | Imediato | "📜 Seu certificado está pronto! [link]" |
| Aniversário de inscrição | 30/60/90 dias | "Faz 30 dias que você começou! Como está indo?" |

---

