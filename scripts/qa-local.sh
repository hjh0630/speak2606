#!/usr/bin/env bash
# QA script for SpeakFlow backend. Writes intermediate JSONs to the project
# scripts dir (Windows-stable) and parses them with node -e.
set -e
BASE="http://localhost:3001"
TMP="E:/00.ai/speak2606/scripts/qa-tmp"
mkdir -p "$TMP"

# A node helper that reads a JSON file and prints a chosen script.
cat > "$TMP/parse.js" <<'EOF'
const fs = require('fs');
const path = process.argv[2];
const body = process.argv[3];
const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
const fn = new Function('d', body);
fn(data);
EOF

run_json() {
  # run_json <output-file> <node-script>
  node "$TMP/parse.js" "$1" "$2"
}

echo "===== 1. SCENARIOS 模块分组 ====="
curl -s "$BASE/api/scenarios" -o "$TMP/sc.json"
run_json "$TMP/sc.json" "
const items = d.items || [];
const ta = items.filter(s => s.module === 'textile-apparel');
const ft = items.filter(s => s.module === 'foreign-trade');
const other = items.filter(s => !['textile-apparel','foreign-trade'].includes(s.module));
console.log('total:', items.length, '| textile-apparel:', ta.length, '| foreign-trade:', ft.length, '| other:', other.length);
console.log('[纺织服装 7 大类]:');
ta.forEach(s => console.log('  -', s.id, '|', s.title_zh || s.title, '|', s.category || '-'));
console.log('[外贸 sample 5]:');
ft.slice(0,5).forEach(s => console.log('  -', s.id, '|', s.title_zh || s.title));
"

echo ""
echo "===== 2. DIALOG 加载 (yarn-sourcing-yarn-mill) ====="
curl -s "$BASE/api/scenarios/yarn-sourcing-yarn-mill" -o "$TMP/dlg.json"
run_json "$TMP/dlg.json" "
const ds = d.dialogs || [];
console.log('dialogs count:', ds.length);
ds.forEach(x => console.log('  difficulty=' + x.difficulty, ' rounds=' + (x.rounds||[]).length));
console.log('---first round---');
if (ds[0] && ds[0].rounds && ds[0].rounds[0]) {
  const r = ds[0].rounds[0];
  console.log('round', r.round, '| ai_message:', r.ai_message);
}
"

echo ""
echo "===== 3. WORDBOOK 端到端测试 ====="
U="qa-user-$(date +%s)-$$"
echo "--- 3a. 添加 3 词 ---"
for term in "combed yarn:精梳纱:1" "Uster CV%:条干变异系数:2" "Delta E:色差值:3"; do
  IFS=':' read -r t m diff <<< "$term"
  printf '{"term":"%s","meaning":"%s","difficulty":%s,"source":"popup"}' "$t" "$m" "$diff" > "$TMP/body.json"
  curl -s -X POST "$BASE/api/wordbook" \
    -H "X-User-Id: $U" \
    -H "Content-Type: application/json" \
    --data-binary "@$TMP/body.json" \
    -o "$TMP/wp.json"
  run_json "$TMP/wp.json" "console.log('  +', d.item.term, '| id=' + d.item.id, '| diff=' + d.item.difficulty)"
done

echo "--- 3b. 列表 (应 3 条) ---"
curl -s "$BASE/api/wordbook" -H "X-User-Id: $U" -o "$TMP/list.json"
run_json "$TMP/list.json" "
console.log('total=' + d.total);
d.items.forEach(it => console.log('  -', it.term, '|', it.meaning, '| diff=' + it.difficulty, '| src=' + it.source));
"

echo "--- 3c. 难度筛选 difficulty=1 ---"
curl -s "$BASE/api/wordbook?difficulty=1" -H "X-User-Id: $U" -o "$TMP/filter.json"
run_json "$TMP/filter.json" "
console.log('diff=1 total=' + d.total);
d.items.forEach(it => console.log('  -', it.term, '| diff=' + it.difficulty));
"

echo "--- 3d. 搜索 'Uster' ---"
curl -s "$BASE/api/wordbook?search=Uster" -H "X-User-Id: $U" -o "$TMP/search.json"
run_json "$TMP/search.json" "
console.log('search=Uster total=' + d.total);
d.items.forEach(it => console.log('  -', it.term));
"

echo "--- 3e. batch-check ---"
echo '{"terms":["combed yarn","Uster CV%","ring spun","ne 30","Delta E"]}' > "$TMP/bc-body.json"
curl -s -X POST "$BASE/api/wordbook/batch-check" \
  -H "X-User-Id: $U" \
  -H "Content-Type: application/json" \
  --data-binary "@$TMP/bc-body.json" \
  -o "$TMP/bc.json"
run_json "$TMP/bc.json" "console.log('saved:', JSON.stringify(d.saved))"

echo "--- 3f. stats ---"
curl -s "$BASE/api/wordbook/stats" -H "X-User-Id: $U" -o "$TMP/stats.json"
cat "$TMP/stats.json"
echo ""

echo "--- 3g. PATCH 更新 combed yarn → difficulty=3 ---"
curl -s "$BASE/api/wordbook" -H "X-User-Id: $U" -o "$TMP/list.json"
ID=$(run_json "$TMP/list.json" "console.log(d.items.find(i=>i.term==='combed yarn').id)")
echo "  id=$ID"
echo '{"difficulty":3,"notes":"已掌握"}' > "$TMP/patch-body.json"
curl -s -X PATCH "$BASE/api/wordbook/$ID" \
  -H "X-User-Id: $U" \
  -H "Content-Type: application/json" \
  --data-binary "@$TMP/patch-body.json" \
  -o "$TMP/patch.json"
run_json "$TMP/patch.json" "console.log('  ->', d.item.term, '| diff=' + d.item.difficulty, '| notes=' + d.item.notes)"

echo "--- 3h. 跨用户隔离 ---"
echo '{"term":"warp","meaning":"经纱"}' > "$TMP/a-body.json"
curl -s -X POST "$BASE/api/wordbook" -H "X-User-Id: qa-user-A" -H "Content-Type: application/json" --data-binary "@$TMP/a-body.json" -o "$TMP/a.json"
echo "  A added warp: id=$(run_json "$TMP/a.json" 'console.log(d.item.id)')"
curl -s "$BASE/api/wordbook" -H "X-User-Id: qa-user-B" -o "$TMP/b.json"
run_json "$TMP/b.json" "
console.log('  B total=' + d.total, '| has warp:', d.items.some(i => i.term === 'warp'), '(expect false)');
"

echo "--- 3i. DELETE + batch-delete ---"
curl -s -X DELETE "$BASE/api/wordbook/$ID" -H "X-User-Id: $U"
echo ""
curl -s "$BASE/api/wordbook" -H "X-User-Id: $U" -o "$TMP/list.json"
IDS=$(run_json "$TMP/list.json" "console.log(JSON.stringify(d.items.map(i=>i.id)))")
echo "  batch-delete ids=$IDS"
echo "{\"ids\":$IDS}" > "$TMP/bd-body.json"
curl -s -X POST "$BASE/api/wordbook/batch-delete" -H "X-User-Id: $U" -H "Content-Type: application/json" --data-binary "@$TMP/bd-body.json"
echo ""

echo "--- 3j. 401 无 token ---"
curl -s -o /dev/null -w "  status=%{http_code} (expect 401)\n" "$BASE/api/wordbook"

echo ""
echo "===== 4. DICTIONARY 查词 ====="
curl -s "$BASE/api/dictionary?w=combed%20yarn" -o "$TMP/d.json"
cat "$TMP/d.json"
echo ""
curl -s "$BASE/api/dictionary?w=loom" -o "$TMP/d2.json"
cat "$TMP/d2.json"
echo ""

echo ""
echo "===== 5. VOCABULARY categories ====="
curl -s "$BASE/api/vocabulary/categories" -o "$TMP/vc.json"
run_json "$TMP/vc.json" "
console.log('categories:', d.total);
d.items.forEach(c => console.log('  -', c.category, '×' + c.count));
"

echo ""
echo "===== QA DONE ====="
