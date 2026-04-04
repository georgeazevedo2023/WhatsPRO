# E2E Test Briefing Template

## Estrutura Padrão

Todo teste E2E deve seguir este formato:

### 1. Cabeçalho
```
## Teste N: [Nome descritivo]
**Objetivo:** [O que este teste valida — 1 frase]
**Foco principal:** [Feature/fluxo principal sendo testado]
```

### 2. Perfil do Lead
```
| Campo | Valor |
|-------|-------|
| Nome | [Nome completo] |
| Cidade | [Cidade] |
| Interesse | [Produto/categoria específica] |
| Orçamento | [Valor aproximado] |
| Comportamento | [Direto/indeciso/frustrado/técnico] |
```

### 3. Fluxo de Mensagens
```
| # | Mensagem do Lead | O que DEVE acontecer |
|---|-----------------|---------------------|
| 1 | "texto" | [Comportamento esperado] |
```

### 4. Checklist de Verificação
```
| Critério | Esperado |
|----------|----------|
| Mídia | [carousel/send_media/nenhum] |
| Preço | [Valor correto do catálogo] |
| Handoff | [Trigger/tool/nenhum, status_ia esperado] |
| Shadow | [N extrações esperadas] |
| Lead profile | [Campos que devem ser preenchidos] |
| Tags | [Tags esperadas] |
| Erros proibidos | 0 "Desculpe", 0 "não encontrei", 0 handoff prematuro |
```

### 5. Resultado (preenchido após execução)
```
| Critério | Esperado | Real | OK? |
|----------|----------|------|-----|
```

### 6. Nota e Próximos Passos
```
Nota: X/10
Bugs encontrados: [lista]
Melhorias: [lista]
```

---

## Catálogo Disponível (para referência nos testes)

| Produto | Categoria | Preço | Marca | Imgs |
|---------|-----------|-------|-------|------|
| Tinta Acrílica Eggshell Premium 18L Branco Neve Sol E Chuva | Tintas | R$792,00 | Coral | 6 |
| Tinta Acrílica Fosco Standard 16L Tubarão Branco Rende Muito | Tintas | R$427,90 | Coral | 10 |
| Tinta Esmalte Acetinada Dialine Branco Neve 750ml | Tintas | R$51,90 | Iquine | 10 |
| Manta Líquida Branca 18 Kg | Impermeabilizantes | R$289,00 | Quartzolit | 10 |
| Verniz Sol E Chuva Alto Brilho Imbuia 0,900L | Seladores e vernizes | R$56,90 | Iquine | 10 |

## Business Info REAL do Admin (ÚNICA fonte de verdade)

**Cadastrado (agente PODE responder):**
- Horário: Segunda a Sexta: 8h às 18h | Sábado: 8h às 12h
- Endereço: R. Dantas Barreto, 118 - Santo Antônio, Garanhuns - PE
- Telefone: (87) 3764-2650
- Pagamento: PIX, cartão de crédito (até 12x), boleto bancário, dinheiro

**NÃO cadastrado (agente DEVE fazer handoff):**
- Entrega/frete: NÃO configurado — delivery_info vazio
- Outras info: NÃO configurado — extra vazio (Instagram pode ser adicionado aqui)
- Desconto máximo: NÃO configurado — max_discount_percent null (nunca oferecer)
- Business hours (bloqueio): NÃO configurado — business_hours null (sem bloqueio por horário)

**Testes NUNCA devem esperar respostas sobre temas não cadastrados.**
Se o lead perguntar sobre entrega/frete, o agente deve fazer handoff.

## Config do Agente (para referência)

- Modelo: gemini-2.5-flash | Temperatura: 0.7
- Debounce: 10s | Contexto: 10 msgs
- Max perguntas pré-busca: 3 | Max retries qualificação: 2
- Handoff cooldown: 30min | Max conversa IA: 15min
- Handoff triggers: vendedor, atendente, humano, gerente, preco, desconto, negociar, parcelar, entrega, frete
- Blocked topics: politica, religiao, concorrentes
- Validator: enabled (gpt-4.1-nano, moderado)
- Voice: disabled
- Knowledge base: 0 items
- Catálogo: 5 produtos
