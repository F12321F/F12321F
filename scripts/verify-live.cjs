// 只新增虛構驗收資料；更新與刪除測試只針對這次建立的紀錄。
// 以公開 key 執行四項負向測試，每項一次，不重試、不碰既有報修。
const fs = require('node:fs');
const path = require('node:path');
const { readConfig } = require('./config-utils.cjs');
async function main() {
  const config = readConfig();
  const results = [];
  async function call(method, suffix = '', body) {
    const response = await fetch(config.url + '/rest/v1/repair_requests' + suffix, {
      method, headers: { apikey: config.publishableKey, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000)
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : []; } catch { data = { message: '非 JSON 回應' }; }
    return { status: response.status, ok: response.ok, data };
  }
  const fixture = { reporter_name: '驗收用虛構同事', location: '示範測試區', category: '設備', description: '教材驗收資料 ' + new Date().toISOString(), urgency: '高' };
  const created = await call('POST', '', fixture);
  if (!created.ok || !created.data[0]?.id) throw new Error('正常新增失敗：HTTP ' + created.status + ' / ' + (created.data.code || '未知錯誤'));
  const row = created.data[0];
  results.push({ test: '正常新增、資料庫預設狀態與時間', passed: row.status === '待處理' && Number.isFinite(Date.parse(row.created_at)) });
  const read = await call('GET', '?id=eq.' + encodeURIComponent(row.id));
  results.push({ test: '新增後跨請求讀回', passed: read.ok && read.data[0]?.description === fixture.description });
  const cases = [
    ['指定已完成', 'POST', '', { ...fixture, status: '已完成' }, '42501', 'GRANT'],
    ['類別亂寫', 'POST', '', { ...fixture, category: '亂寫' }, '23514', 'CHECK'],
    ['修改本次測試紀錄', 'PATCH', '?id=eq.' + row.id, { reporter_name: '別人' }, '42501', 'GRANT'],
    ['刪除本次測試紀錄', 'DELETE', '?id=eq.' + row.id, undefined, '42501', 'GRANT']
  ];
  for (const [test, method, suffix, body, expectedCode, layer] of cases) {
    const response = await call(method, suffix, body);
    const actualLayer = response.data.code === '23514' ? 'CHECK'
      : /row-level security/i.test(response.data.message || '') ? 'RLS'
      : response.data.code === '42501' && /permission denied/i.test(response.data.message || '') ? 'GRANT'
      : '未確認，需調查';
    const passed = !response.ok && response.data.code === expectedCode && actualLayer === layer;
    results.push({ test, http: response.status, code: response.data.code || null, passed, layer: actualLayer });
    if (!passed) break; // 若權限過寬即停，避免繼續破壞。
  }
  const report = { at: new Date().toISOString(), project: new URL(config.url).hostname, fixtureId: row.id, results };
  fs.mkdirSync(path.join(__dirname, '../outputs'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../outputs/live-verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (results.length !== 6 || results.some(result => !result.passed)) process.exitCode = 1;
}
main().catch(error => { console.error('實際驗收未完成：' + error.message); process.exitCode = 1; });
