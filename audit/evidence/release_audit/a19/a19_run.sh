#!/usr/bin/env bash
# Agent 5 A-19 runner: one demo run on a fresh DB. usage: a19_run.sh <n>
N=$1
SP="C:/Users/ADITYA~1/AppData/Local/Temp/claude/p--programs-Machine-learning/60371d15-5b9a-462a-a446-ed01961c395c/scratchpad"
E2E="$SP/e2e"; OUT="P:/Projects/DecisionTwin/audit/evidence/release_audit/a19/run$N"; mkdir -p "$OUT"
DB="$SP/audit/a19_run$N.db"; rm -f "$DB"
T0=$(date +%s)
cd /p/Projects/DecisionTwin/backend && DATABASE_URL="sqlite:///$DB" LLM_DATA_MODE=synthetic_only nohup .venv/Scripts/python.exe -m uvicorn api.main:app --port 8000 > "$OUT/uvicorn.log" 2>&1 &
cd /p/Projects/DecisionTwin/web && nohup npx next start -p 3000 > "$OUT/next.log" 2>&1 &
for i in $(seq 1 60); do a=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health); b=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/); [ "$a" = 200 ] && [ "$b" = 200 ] && break; sleep 1; done
T1=$(date +%s); echo "run $N: servers up after $((T1-T0))s (api=$a web=$b)"
cd "$E2E" && node doc_flow.mjs "P:/Projects/DecisionTwin/backend/fixtures/documents" "$OUT" > "$OUT/doc_flow.txt" 2>&1; D=$?
node manual_flow.mjs "$OUT" > "$OUT/manual_flow.txt" 2>&1; M=$?
T2=$(date +%s)
echo "run $N: doc_flow exit=$D ($(grep -c '\[PASS\]' "$OUT/doc_flow.txt") pass / $(grep -c '\[FAIL\]' "$OUT/doc_flow.txt") fail) manual_flow exit=$M ($(grep -c '\[PASS\]' "$OUT/manual_flow.txt") pass / $(grep -c '\[FAIL\]' "$OUT/manual_flow.txt") fail); total wall time $((T2-T0))s; flows $((T2-T1))s" | tee "$OUT/summary.txt"
grep -h "RESULT\|FAIL" "$OUT/doc_flow.txt" "$OUT/manual_flow.txt" | head -10
