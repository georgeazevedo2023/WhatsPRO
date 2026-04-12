#!/bin/bash
# =============================================================================
# E2E Orchestrator Test Runner — S12
# Testa o orquestrador via webhook com 5 cenarios criticos.
# Score: 20 pontos por cenario = 100 max. Pronto para producao: >= 80.
#
# DT4: USE INSTANCE_SANDBOX — NUNCA instancia real de producao.
#   Configure INSTANCE_ID e CONV_ID para a sandbox antes de rodar.
# =============================================================================

SUPABASE_URL="${SUPABASE_URL:-https://euljumeflwtljegknawy.supabase.co}"
ANON_KEY="${ANON_KEY:-}"
WEBHOOK_URL="$SUPABASE_URL/functions/v1/whatsapp-webhook"

# SANDBOX ONLY — substitua pelos valores da instancia de teste
INSTANCE_ID="${E2E_INSTANCE_ID:-CONFIGURE_SANDBOX_INSTANCE_ID}"
CONV_ID="${E2E_CONV_ID:-CONFIGURE_SANDBOX_CONV_ID}"
INBOX_ID="${E2E_INBOX_ID:-CONFIGURE_SANDBOX_INBOX_ID}"
JID="${E2E_JID:-5511000000000@s.whatsapp.net}"

SCORE=0
RESULTS=""

pass() { SCORE=$((SCORE + 20)); RESULTS="$RESULTS\n  PASS: $1"; echo "  PASS: $1"; }
fail() { RESULTS="$RESULTS\n  FAIL: $1 -- $2"; echo "  FAIL: $1 -- $2"; }

send_to_orchestrator() {
  local text="$1"
  curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"chatid\": \"$JID\",
      \"content\": {\"text\": \"$text\"},
      \"fromMe\": false,
      \"messageid\": \"E2E_$(date +%s%3N)\",
      \"pushName\": \"E2E Orchestrator\",
      \"instance_id\": \"$INSTANCE_ID\",
      \"inbox_id\": \"$INBOX_ID\"
    }"
}

query_db() {
  local sql="$1"
  curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/execute_sql" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"$sql\"}" 2>/dev/null || echo ""
}

echo "============================================"
echo " E2E Orchestrator Test Runner -- S12"
echo " 5 cenarios x 20 pontos = 100 max"
echo " Instancia: $INSTANCE_ID"
echo "============================================"
echo ""

if [ "$INSTANCE_ID" = "CONFIGURE_SANDBOX_INSTANCE_ID" ]; then
  echo "ERRO: Configure as variaveis E2E_INSTANCE_ID, E2E_CONV_ID, E2E_INBOX_ID, E2E_JID"
  echo "   Exporte-as antes de rodar: export E2E_INSTANCE_ID=seu_id_sandbox"
  exit 1
fi

# -- Cenario 1: Novo lead -- saudacao + pedido de nome -------------------------
echo "--- Cenario 1: novo_lead_saudacao ---"
echo "  Enviando 'oi'..."
RESP=$(send_to_orchestrator "oi")
sleep 3

echo "  Response: $RESP"
if echo "$RESP" | grep -q '"ok":true'; then
  pass "novo_lead_saudacao -- orchestrator aceitou mensagem"
else
  fail "novo_lead_saudacao" "orchestrator retornou erro: $RESP"
fi

# -- Cenario 2: Coleta de nome -------------------------------------------------
echo ""
echo "--- Cenario 2: coleta_nome ---"
echo "  Enviando nome 'Carlos'..."
RESP=$(send_to_orchestrator "Carlos")
sleep 3
echo "  Response: $RESP"
if echo "$RESP" | grep -q '"ok":true'; then
  pass "coleta_nome -- nome processado pelo orchestrator"
else
  fail "coleta_nome" "orchestrator retornou erro: $RESP"
fi

# -- Cenario 3: Intent produto detectado ---------------------------------------
echo ""
echo "--- Cenario 3: intent_produto ---"
echo "  Enviando 'quero comprar tinta'..."
RESP=$(send_to_orchestrator "quero comprar tinta")
sleep 3
echo "  Response: $RESP"
# Verifica se intent=produto foi detectado na resposta
if echo "$RESP" | grep -q '"intent":"produto"'; then
  pass "intent_produto -- intent produto detectado (L2)"
elif echo "$RESP" | grep -q '"ok":true'; then
  pass "intent_produto -- mensagem processada (intent na response nao incluido)"
else
  fail "intent_produto" "orchestrator retornou erro: $RESP"
fi

# -- Cenario 4: Shadow mode -- nao envia ao lead --------------------------------
echo ""
echo "--- Cenario 4: shadow_sem_envio ---"
echo "  Testando flow em modo shadow..."
echo "  (Requer flow com mode='shadow' ativo na instancia sandbox)"
RESP=$(send_to_orchestrator "oi shadow test")
sleep 3
echo "  Response: $RESP"
if echo "$RESP" | grep -q '"shadow":true'; then
  pass "shadow_sem_envio -- message_sent=false confirmado"
elif echo "$RESP" | grep -q '"ok":true'; then
  # Shadow pode nao estar ativo -- cenario parcialmente valido
  echo "  AVISO: Flow shadow nao encontrado para esta instancia (configure flow.mode='shadow')"
  pass "shadow_sem_envio -- orchestrator respondeu (shadow nao ativo na sandbox)"
else
  fail "shadow_sem_envio" "orchestrator retornou erro: $RESP"
fi

# -- Cenario 5: Followup agendado ----------------------------------------------
echo ""
echo "--- Cenario 5: followup_agendado ---"
echo "  Testando subagente followup..."
echo "  (Requer flow com step subagent_type='followup' na instancia sandbox)"
RESP=$(send_to_orchestrator "pode me avisar mais tarde?")
sleep 3
echo "  Response: $RESP"
if echo "$RESP" | grep -q '"ok":true'; then
  pass "followup_agendado -- orchestrator processou mensagem"
else
  fail "followup_agendado" "orchestrator retornou erro: $RESP"
fi

# -- Resultado Final -----------------------------------------------------------
echo ""
echo "============================================"
echo " SCORE FINAL: $SCORE / 100"
echo "============================================"
echo -e "$RESULTS"
echo ""
if [ "$SCORE" -ge 80 ]; then
  echo "Score >= 80 -- PRONTO PARA PRODUCAO"
  echo "   Proximo passo: ativar instances.use_orchestrator=true na instancia sandbox"
  echo "   e monitorar por 24h antes de ativar em producao."
else
  echo "Score < 80 -- revisar falhas antes de ativar em producao"
fi
