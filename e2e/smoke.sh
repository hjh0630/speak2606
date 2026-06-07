#!/usr/bin/env bash
# End-to-end smoke test for the Speakly English-speaking practice app.
# Requires the backend running on http://localhost:3001.
#
# Usage:
#   chmod +x e2e/smoke.sh
#   ./e2e/smoke.sh
#
# What it checks:
#   1. /health returns ok
#   2. /api/scenarios returns 6 scenarios
#   3. Create a session with phone_meeting + beginner + free
#   4. Send a user message, get back ai_message + score
#   5. GET /api/history contains the new session
#   6. GET /api/stats returns aggregate data
#   7. Repeat with beginner + repeat mode
#   8. Complete the session
#
# Exits non-zero on the first failure with a clear message.

set -euo pipefail

BASE="${BASE:-http://localhost:3001}"
JQ="$(command -v jq || true)"
USE_JQ=0
if [ -n "$JQ" ]; then USE_JW=1; USE_JQ=1; fi

pass() { printf "  \033[32mOK\033[0m  %s\n" "$1"; }
fail() { printf "  \033[31mFAIL\033[0m %s\n" "$1"; exit 1; }
section() { printf "\n\033[1m== %s ==\033[0m\n" "$1"; }

# 1. Health
section "1. /health"
HEALTH=$(curl -sS --max-time 5 "$BASE/health")
echo "$HEALTH"
echo "$HEALTH" | grep -q '"ok":true' && pass "health ok" || fail "health not ok"

# 2. Scenarios
section "2. /api/scenarios"
SCENS=$(curl -sS --max-time 5 "$BASE/api/scenarios")
COUNT=$(echo "$SCENS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('count', len(d.get('items',[]))))")
echo "scenarios count: $COUNT"
[ "$COUNT" = "6" ] && pass "6 scenarios returned" || fail "expected 6 scenarios, got $COUNT"

# 3. Create session
section "3. POST /api/sessions (phone_meeting + beginner + free)"
CREATE=$(curl -sS --max-time 10 -X POST -H "Content-Type: application/json" \
  -d '{"scenario_id":"phone_meeting","difficulty":"beginner","mode":"free"}' \
  "$BASE/api/sessions")
echo "$CREATE"
SID=$(echo "$CREATE" | python3 -c "import json,sys; print(json.load(sys.stdin)['session_id'])")
[ -n "$SID" ] && pass "session created: $SID" || fail "no session_id returned"

# 4. Send user message
section "4. POST /api/sessions/$SID/messages"
MSG=$(curl -sS --max-time 10 -X POST -H "Content-Type: application/json" \
  -d '{"content":"Hello, this is Chen from Lily Garments. How can I help you?"}' \
  "$BASE/api/sessions/$SID/messages")
echo "$MSG" | python3 -m json.tool
echo "$MSG" | grep -q 'ai_message' && pass "ai_message returned" || fail "no ai_message"
echo "$MSG" | grep -q 'overall_score' && pass "score returned" || fail "no score"

# 5. History
section "5. GET /api/history"
HIST=$(curl -sS --max-time 5 "$BASE/api/history")
HIST_COUNT=$(echo "$HIST" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('items',[])))")
echo "history items: $HIST_COUNT"
[ "$HIST_COUNT" -ge 1 ] && pass "history non-empty" || fail "history empty"

# 6. Stats
section "6. GET /api/stats"
STATS=$(curl -sS --max-time 5 "$BASE/api/stats")
echo "$STATS" | python3 -m json.tool
echo "$STATS" | grep -q 'total_sessions' && pass "stats returned" || fail "no stats"
TOTAL=$(echo "$STATS" | python3 -c "import json,sys; print(json.load(sys.stdin)['total_sessions'])")
[ "$TOTAL" -ge 1 ] && pass "total_sessions >= 1" || fail "total_sessions is 0"

# 7. Repeat mode
section "7. Repeat mode (phone_meeting + beginner + repeat)"
REPC=$(curl -sS --max-time 10 -X POST -H "Content-Type: application/json" \
  -d '{"scenario_id":"phone_meeting","difficulty":"beginner","mode":"repeat"}' \
  "$BASE/api/sessions")
REPSID=$(echo "$REPC" | python3 -c "import json,sys; print(json.load(sys.stdin)['session_id'])")
pass "repeat session: $REPSID"
REP_MSG=$(curl -sS --max-time 10 -X POST -H "Content-Type: application/json" \
  -d '{"content":"Hello, this is Mark"}' \
  "$BASE/api/sessions/$REPSID/messages")
echo "$REP_MSG" | grep -q 'ai_message\|target\|expected' && pass "repeat-mode reply" || \
  (echo "$REP_MSG" | python3 -m json.tool; fail "repeat-mode reply missing fields")

# 8. Complete
section "8. POST /api/sessions/$SID/complete"
DONE=$(curl -sS --max-time 5 -X POST "$BASE/api/sessions/$SID/complete")
echo "$DONE" | python3 -m json.tool
echo "$DONE" | grep -q 'completed' && pass "session marked completed" || fail "complete failed"

section "ALL CHECKS PASSED ✅"
