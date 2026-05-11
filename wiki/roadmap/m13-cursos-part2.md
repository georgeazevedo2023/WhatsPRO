---
title: Roadmap — M13 Cursos & Membership (parte 2)
type: roadmap-detail
description: M13 Cursos & Membership (parte 2) — T13.6 Certificado + T13.7 Área Membros + T13.8 Quizzes + T13.9 Comunidade + T13.10 Gamificação
updated: 2026-05-11
---

# M13 — Cursos & Membership WhatsApp (parte 2: T13.6-T13.10)

> Continuação de [[wiki/roadmap/m13-cursos-part1]].

##### T13.6 — Certificado de Conclusão
**Descrição completa**: Gerar certificado PDF automaticamente quando aluno completa 100% do curso.

**Conteúdo do certificado**:
```
┌────────────────────────────────────────────┐
│                                            │
│          CERTIFICADO DE CONCLUSÃO          │
│                                            │
│  Certificamos que                          │
│                                            │
│         JOÃO SILVA                         │
│                                            │
│  concluiu com êxito o curso               │
│                                            │
│   "Marketing Digital Completo"             │
│                                            │
│  com carga horária de 5 horas,            │
│  realizado de 01/03/2026 a 21/03/2026.    │
│                                            │
│  MinhaEmpresa | WhatsPRO                   │
│  Código de verificação: CERT-2026-ABC123   │
│                                            │
└────────────────────────────────────────────┘
```

**Entrega**:
- PDF gerado via edge function `generate-certificate-pdf`
- Enviado como documento no WhatsApp
- Link permanente para verificação: `https://cursos.whatspro.com/certificado/CERT-2026-ABC123`
- Compartilhável (Open Graph com preview do certificado)

---

##### T13.7 — Área de Membros (Web)
**Descrição completa**: Portal web para alunos acessarem conteúdo, acompanharem progresso e baixarem materiais.

**Funcionalidades**:
- Login via magic link (enviado por WhatsApp, sem senha)
- Dashboard com cursos inscritos e progresso de cada um
- Player de vídeo, leitor de PDF, visualizador de imagens
- Marcar lição como concluída
- Download de materiais complementares
- Área de certificados
- Botão "Continuar no WhatsApp" (link direto para conversa)

**URL**: `https://membros.whatspro.com/{workspace_slug}`

---

##### T13.8 — Quizzes e Avaliações
**Descrição completa**: Perguntas após cada lição para fixar aprendizado e validar compreensão.

**Tipos de pergunta**:
| Tipo | Formato WhatsApp | Exemplo |
|------|-----------------|---------|
| Múltipla escolha | Lista numerada | "Qual é o principal KPI? 1) Cliques 2) Conversão 3) Impressões" |
| Verdadeiro/Falso | V ou F | "CTR é a taxa de cliques dividida por impressões. V ou F?" |
| Resposta curta | Texto livre (IA avalia) | "Em poucas palavras, o que é um funil de vendas?" |
| Ordenação | Números | "Ordene: 1) Consciência 2) Decisão 3) Interesse 4) Ação. Ex: 1,3,2,4" |

**Fluxo no WhatsApp**:
```
Bot: "📝 Quiz da Aula 2.1 — 3 perguntas:"
Bot: "1/3 — O Google Ads cobra por: 1) Impressão 2) Clique 3) Ambos"
Contato: "3"
Bot: "✅ Correto! O Google Ads oferece modelos CPC e CPM."
Bot: "2/3 — Qual a taxa média de cliques no Google Search? 1) 0.5% 2) 3% 3) 15%"
Contato: "1"
Bot: "❌ Incorreto. A média é cerca de 3%. Dica: releia a seção sobre CTR."
Bot: "3/3 — Quality Score vai de: 1) 1-5 2) 1-10 3) 1-100"
Contato: "2"
Bot: "✅ Correto!
      📊 Resultado: 2/3 (67%)
      ✅ Aprovado! (mínimo: 60%)
      ➡️ Próxima aula liberada: Facebook Ads do Zero"
```

**Regras**:
- Nota mínima configurável (ex: 60% para aprovar)
- Se reprovado: revisar lição e tentar novamente
- Máximo de tentativas (ex: 3)
- Feedback por resposta (explica certo/errado)

---

##### T13.9 — Comunidade de Alunos
**Descrição completa**: Grupo WhatsApp exclusivo para alunos de cada curso.

**Funcionalidades**:
- Criar grupo WhatsApp automaticamente ao publicar curso
- Adicionar aluno ao grupo ao inscrever
- Remover ao cancelar inscrição
- Mensagem de boas-vindas automática no grupo
- Regras do grupo fixadas
- Admin pode enviar comunicados para todos os alunos via broadcast (M3)

**Exemplo**:
```
[Grupo: Marketing Digital Completo — Turma 2026]

Bot: "👋 Bem-vindo(a) ao grupo, João! Aqui você pode tirar dúvidas
      com outros alunos e com o professor.

      📋 Regras:
      1. Seja respeitoso
      2. Sem spam ou vendas
      3. Dúvidas do curso aqui, suporte técnico no privado

      Estamos com 47 alunos ativos. Bons estudos! 📚"
```

---

##### T13.10 — Gamificação
**Descrição completa**: Sistema de pontos, badges e ranking para aumentar engajamento.

**Pontuação**:
| Ação | Pontos |
|------|--------|
| Completar lição | +10 pts |
| Completar seção | +50 pts |
| Completar curso | +200 pts |
| Acertar quiz 100% | +30 pts |
| Streak de 3 dias consecutivos | +20 pts |
| Streak de 7 dias | +50 pts |
| Primeiro aluno a completar lição | +15 pts (bonus early bird) |

**Badges (conquistas)**:
| Badge | Critério | Emoji |
|-------|----------|-------|
| Primeiro Passo | Completou 1ª lição | 👣 |
| Dedicado | 7 dias consecutivos | 🔥 |
| Scholar | Completou 1 curso | 🎓 |
| Mestre | Completou 3 cursos | 🏆 |
| Perfeccionista | 100% em todos os quizzes | 💎 |
| Madrugador | Completou lição antes das 7h | 🌅 |
| Velocista | Completou curso em metade do tempo estimado | ⚡ |

**Ranking via WhatsApp**:
```
Bot: "🏆 Ranking semanal — Marketing Digital:

      🥇 Maria Santos — 340 pts (🔥 streak 12 dias)
      🥈 João Silva — 280 pts (🎓 badge Scholar)
      🥉 Pedro Lima — 210 pts
      4️⃣ Ana Costa — 195 pts
      5️⃣ Lucas Oliveira — 180 pts

      Sua posição: 2º lugar (+60 pts essa semana)
      Continue assim! 💪"
```

**Tabelas planejadas**: `courses`, `course_sections`, `course_lessons`, `course_enrollments`, `lesson_completions`, `course_quizzes`, `quiz_questions`, `quiz_attempts`, `quiz_answers`, `certificates`, `gamification_points`, `gamification_badges`, `gamification_user_badges`

**Edge Functions planejadas**: `deliver-lesson`, `evaluate-quiz`, `generate-certificate-pdf`, `drip-content-scheduler`, `course-notification`, `gamification-engine`

**Componentes planejados**: `CourseList`, `CourseEditor`, `SectionEditor`, `LessonEditor`, `ContentTypeSelector`, `EnrollmentManager`, `ProgressDashboard`, `QuizBuilder`, `QuizResults`, `CertificatePreview`, `GamificationDashboard`, `LeaderboardWidget`, `MemberPortal`

---

