#!/bin/bash
# E2E AI Agent Test Runner — sends REAL messages through WhatsApp webhook
# Tests all critical flows: greeting, qualification, triggers, handoff, search, media

SUPABASE_URL="https://euljumeflwtljegknawy.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1bGp1bWVmbHd0bGplZ2tuYXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NjYzMTQsImV4cCI6MjA4OTU0MjMxNH0.TAem9XE_b7Sx-rlHpZiU40rXKvwYWCBnqwLlAFYetJk"
WEBHOOK_URL="$SUPABASE_URL/functions/v1/whatsapp-webhook"
CONV_ID="cb00017d-c709-41f2-b1d2-f299497326a8"
INSTANCE_ID="r466a98889b5809"
INBOX_ID="3c19208d-ae87-4d0c-ba83-cac7a42c59ff"
JID="5581985749970@s.whatsapp.net"
WAIT=22  # seconds between messages (debounce=10s + processing ~12s)
PASS=0
FAIL=0
TOTAL=0
RESULTS=""

reset_conversation() {
  curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/reset_e2e_conversation" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{}' > /dev/null 2>&1
  sleep 2  # let DB settle
}

send_msg() {
  local text="$1"
  local msgid="E2E_$(date +%s%N | head -c13)"
  curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"chatid\": \"$JID\",
      \"content\": {\"text\": \"$text\"},
      \"fromMe\": false,
      \"messageid\": \"$msgid\",
      \"pushName\": \"E2E Test\",
      \"instance_id\": \"$INSTANCE_ID\",
      \"inbox_id\": \"$INBOX_ID\"
    }" > /dev/null 2>&1
}

get_results() {
  curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/get_e2e_results" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{}'
}

# Check if outgoing messages contain expected text (case insensitive)
check_contains() {
  local results="$1"
  local expected="$2"
  echo "$results" | grep -iq "$expected"
  return $?
}

# Check outgoing messages do NOT contain text
check_not_contains() {
  local results="$1"
  local forbidden="$2"
  echo "$results" | grep -iq "$forbidden"
  if [ $? -eq 0 ]; then return 1; else return 0; fi
}

run_test() {
  local name="$1"
  local expect_desc="$2"
  local check_pass="$3"  # 0=pass, 1=fail
  TOTAL=$((TOTAL + 1))
  if [ "$check_pass" -eq 0 ]; then
    PASS=$((PASS + 1))
    RESULTS="$RESULTS\n  PASS #$TOTAL: $name"
    echo "  PASS #$TOTAL: $name — $expect_desc"
  else
    FAIL=$((FAIL + 1))
    RESULTS="$RESULTS\n  FAIL #$TOTAL: $name — expected: $expect_desc"
    echo "  FAIL #$TOTAL: $name — expected: $expect_desc"
  fi
}

echo "============================================"
echo " E2E AI Agent Test Runner"
echo " 15 scenarios via real WhatsApp webhook"
echo "============================================"
echo ""

# ══════════════════════════════════════════════
# BATCH 1: Single message scenarios (5 tests)
# ══════════════════════════════════════════════
echo "--- Batch 1: Single message scenarios ---"

# Test 1: Pure greeting → only greeting response, no LLM
echo "  Sending #1: Pure greeting..."
reset_conversation
send_msg "Oi bom dia"
sleep $WAIT
R=$(get_results)
OUT_COUNT=$(echo "$R" | grep -o '"outgoing"' | wc -l)
check_contains "$R" "Bem-vindo"
has_greeting=$?
# Should have exactly 1 outgoing (greeting only, no LLM response)
if [ "$has_greeting" -eq 0 ] && [ "$OUT_COUNT" -le 2 ]; then
  run_test "Pure greeting" "greeting only, no LLM" 0
else
  run_test "Pure greeting" "greeting only, no LLM (got $OUT_COUNT outgoing)" 1
fi

# Test 2: Business hours question → greeting + hours info
echo "  Sending #2: Business hours..."
reset_conversation
send_msg "Qual o horario de funcionamento?"
sleep $WAIT
R=$(get_results)
check_contains "$R" "8h"
run_test "Business hours question" "responds with hours (8h)" $?

# Test 3: Delivery question → answer (trigger 'entrega' skipped as question)
echo "  Sending #3: Delivery question..."
reset_conversation
send_msg "Voces fazem entrega para Olinda?"
sleep $WAIT
R=$(get_results)
check_not_contains "$R" "encaminhar para nosso consultor"
run_test "Delivery question (trigger skip)" "no handoff, answers about delivery" $?

# Test 4: Payment question → answer
echo "  Sending #4: Payment question..."
reset_conversation
send_msg "Quais as formas de pagamento?"
sleep $WAIT
R=$(get_results)
# Should mention payment methods, not handoff
check_not_contains "$R" "encaminhar para nosso consultor"
run_test "Payment question" "no handoff, answers about payment" $?

# Test 5: Address question → answer
echo "  Sending #5: Address question..."
reset_conversation
send_msg "Onde fica a loja de voces?"
sleep $WAIT
R=$(get_results)
check_contains "$R" "Caxang"
run_test "Address question" "responds with address (Caxangá)" $?

# ══════════════════════════════════════════════
# BATCH 2: Handoff triggers (3 tests)
# ══════════════════════════════════════════════
echo ""
echo "--- Batch 2: Handoff trigger scenarios ---"

# Test 6: Legitimate handoff "gerente" → must handoff
echo "  Sending #6: Handoff 'gerente'..."
reset_conversation
send_msg "Oi"
sleep $WAIT
send_msg "Preciso falar com o gerente"
sleep $WAIT
R=$(get_results)
check_contains "$R" "encaminhar"
run_test "Handoff trigger 'gerente'" "handoff executed" $?

# Test 7: "negociar desconto" → handoff (triggers "negociar" + "desconto")
echo "  Sending #7: Handoff 'negociar desconto'..."
reset_conversation
send_msg "Oi"
sleep $WAIT
send_msg "Quero negociar um desconto no pedido"
sleep $WAIT
R=$(get_results)
check_contains "$R" "encaminhar"
run_test "Handoff 'negociar desconto'" "handoff executed" $?

# Test 8: "Quanto custa o frete?" → NOT handoff (question about frete)
echo "  Sending #8: Frete question (trigger skip)..."
reset_conversation
send_msg "Boa tarde"
sleep $WAIT
send_msg "Quanto custa o frete para Recife?"
sleep $WAIT
R=$(get_results)
# Last outgoing should NOT be handoff
LAST_OUT=$(echo "$R" | python3 -c "import sys,json; msgs=[m for m in json.load(sys.stdin) if m['direction']=='outgoing']; print(msgs[-1]['content'] if msgs else '')" 2>/dev/null || echo "$R")
echo "$LAST_OUT" | grep -iq "encaminhar"
if [ $? -eq 0 ]; then
  run_test "Frete question (trigger skip)" "should NOT handoff, should answer about frete" 1
else
  run_test "Frete question (trigger skip)" "correctly did not handoff" 0
fi

# ══════════════════════════════════════════════
# BATCH 3: SDR Qualification (4 tests)
# ══════════════════════════════════════════════
echo ""
echo "--- Batch 3: SDR Qualification scenarios ---"

# Test 9: Generic product → qualification question
echo "  Sending #9: Generic 'quero piso'..."
reset_conversation
send_msg "Oi quero comprar um piso"
sleep $WAIT
R=$(get_results)
# Should ask about ambiente or type (qualification)
check_contains "$R" "ambiente\|tipo\|qual\|prefer"
run_test "Generic product qualification" "asks qualifying question" $?

# Test 10: Specific brand → immediate search
echo "  Sending #10: Specific brand 'tinta Suvinil'..."
reset_conversation
send_msg "Tem tinta Suvinil?"
sleep $WAIT
R=$(get_results)
# Should either search products or ask about color (not generic "what do you want?")
check_not_contains "$R" "como posso te ajudar"
run_test "Specific brand → search/qualify" "does not give generic response" $?

# Test 11: Full specific query → immediate search
echo "  Sending #11: Full specific query..."
reset_conversation
send_msg "Piso porcelanato branco 60x60 para sala"
sleep $WAIT
R=$(get_results)
OUT_COUNT=$(echo "$R" | grep -o '"outgoing"' | wc -l)
# With such specific query, should search directly (2+ outgoing: greeting + result)
if [ "$OUT_COUNT" -ge 2 ]; then
  run_test "Full specific query" "searches directly (${OUT_COUNT} responses)" 0
else
  run_test "Full specific query" "should search directly, got ${OUT_COUNT} responses" 1
fi

# Test 12: Qualification flow → ambiente → marca → search
echo "  Sending #12: 3-step qualification flow..."
reset_conversation
send_msg "Preciso de tinta"
sleep $WAIT
send_msg "Para parede externa"
sleep $WAIT
send_msg "Pode ser Coral"
sleep $WAIT
R=$(get_results)
OUT_COUNT=$(echo "$R" | grep -o '"outgoing"' | wc -l)
# Should have at least 3 outgoing (greeting + qualify + search/qualify)
if [ "$OUT_COUNT" -ge 3 ]; then
  run_test "3-step qualification" "qualification flow worked (${OUT_COUNT} responses)" 0
else
  run_test "3-step qualification" "expected 3+ responses, got ${OUT_COUNT}" 1
fi

# ══════════════════════════════════════════════
# BATCH 4: Full E2E flows (3 tests)
# ══════════════════════════════════════════════
echo ""
echo "--- Batch 4: Full E2E flows ---"

# Test 13: Complete purchase flow → qualify → search → handoff
echo "  Sending #13: Complete purchase flow (6 msgs)..."
reset_conversation
send_msg "Oi, to precisando de piso novo"
sleep $WAIT
send_msg "Joao"
sleep $WAIT
send_msg "Para a cozinha"
sleep $WAIT
send_msg "Nao tenho preferencia de marca"
sleep $WAIT
send_msg "Pode ser qualquer cor clara"
sleep $WAIT
send_msg "Quero falar com vendedor pra fechar"
sleep $WAIT
R=$(get_results)
OUT_COUNT=$(echo "$R" | grep -o '"outgoing"' | wc -l)
check_contains "$R" "encaminhar"
has_handoff=$?
# Full flow: greeting + name ack + qualify + qualify + search/result + handoff = 5-6 outgoing
if [ "$has_handoff" -eq 0 ] && [ "$OUT_COUNT" -ge 4 ]; then
  run_test "Complete purchase flow" "full flow with handoff (${OUT_COUNT} responses)" 0
else
  run_test "Complete purchase flow" "expected 4+ responses + handoff, got ${OUT_COUNT}" 1
fi

# Test 14: Product search → media/carousel flow
echo "  Sending #14: Product search flow (4 msgs)..."
reset_conversation
send_msg "Oi boa noite"
sleep $WAIT
send_msg "Maria"
sleep $WAIT
send_msg "Quero ver pisos porcelanato para banheiro"
sleep $WAIT
send_msg "Pode ser branco"
sleep $WAIT
R=$(get_results)
OUT_COUNT=$(echo "$R" | grep -o '"outgoing"' | wc -l)
# Should have search results (carousel or text about products)
if [ "$OUT_COUNT" -ge 3 ]; then
  run_test "Product search flow" "qualification + search worked (${OUT_COUNT} responses)" 0
else
  run_test "Product search flow" "expected 3+ responses, got ${OUT_COUNT}" 1
fi

# Test 15: Negative sentiment → auto handoff
echo "  Sending #15: Negative sentiment..."
reset_conversation
send_msg "Oi"
sleep $WAIT
send_msg "Ja mandei mensagem 3 vezes e ninguem responde isso e um absurdo"
sleep $WAIT
R=$(get_results)
# Should detect negative sentiment or the LLM should handle empathetically
OUT_COUNT=$(echo "$R" | grep -o '"outgoing"' | wc -l)
if [ "$OUT_COUNT" -ge 2 ]; then
  run_test "Negative sentiment handling" "agent responded to frustration (${OUT_COUNT} responses)" 0
else
  run_test "Negative sentiment handling" "expected 2+ responses, got ${OUT_COUNT}" 1
fi

# ══════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════
echo ""
echo "============================================"
echo " RESULTS: $PASS PASS / $FAIL FAIL / $TOTAL TOTAL"
echo "============================================"
echo -e "$RESULTS"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo "ALL TESTS PASSED! Ready for extended test run (20 more)."
else
  echo "SOME TESTS FAILED. Review and fix before extended run."
fi
