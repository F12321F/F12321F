const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  if (process.env.SUPABASE_SDK_PATH) await context.route('https://cdn.jsdelivr.net/**', route => route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(process.env.SUPABASE_SDK_PATH, 'utf8') }));
  await context.route('**/config.js', route => route.fulfill({contentType: 'application/javascript', body: 'window.SUPABASE_CONFIG={url: "YOUR_SUPABASE_URL", publishableKey: "YOUR_SUPABASE_PUBLISHABLE_KEY"};'}));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = 'http://127.0.0.1:8765/index.html';
  await page.goto(url);
  await page.getByText('尚未設定連線。', { exact: false }).waitFor();
  assert(await page.locator('#submit-button').isDisabled());
  assert.equal(await page.evaluate(() => typeof window.supabase.createClient), 'function');
  console.log('PASS classic script loading, real CDN v2 bundle, placeholder notice');

  await page.addInitScript(() => Object.defineProperty(window, 'SUPABASE_CONFIG', {
    get: () => ({ url: 'https://repair-test.supabase.co', publishableKey: 'sb_publishable_fictional_test' }), set: () => {}
  }));
  let records = [];
  let failGet = false;
  let failPost = false;
  let posts = [];
  let gets = [];
  await page.route('https://repair-test.supabase.co/rest/v1/repair_requests**', async route => {
    const request = route.request();
    if (request.method() === 'POST') {
      const payload = request.postDataJSON();
      posts.push(payload);
      await new Promise(resolve => setTimeout(resolve, 100));
      if (failPost) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: '模擬權限不足' }) });
      records.unshift({ id: 100, status: '待處理', ...payload, created_at: '2026-11-11T08:00:00Z' });
      return route.fulfill({ status: 201, body: '' });
    }
    gets.push(request.url());
    if (failGet) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: '模擬清單錯誤' }) });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(records.slice(0, 20)) });
  });
  await page.reload();
  await page.getByText('目前還沒有報修紀錄。', { exact: false }).waitFor();
  const query = new URL(gets.at(-1));
  assert.equal(query.searchParams.get('order'), 'created_at.desc,id.desc');
  assert.equal(query.searchParams.get('limit'), '20');
  console.log('PASS empty list and newest-first 20-row query');

  async function fill(name = '示範同事') {
    await page.locator('#requester-name').fill(name);
    await page.locator('#location').fill('示範辦公室');
    await page.locator('#category').selectOption('設備');
    await page.locator('input[name="urgency"][value="高"]').check();
    await page.locator('#description').fill('示範設備無法啟動');
  }
  await fill('   ');
  await page.locator('#submit-button').click();
  await page.getByText('請完整填寫所有欄位，內容不能只有空白。').waitFor();
  assert.equal(posts.length, 0);
  await page.locator('#requester-name').fill(' 示範同事 ');
  await page.locator('#submit-button').click();
  await page.getByText('報修已成功送出，謝謝你的回報。').waitFor();
  await page.locator('.request-card').waitFor();
  assert.equal(posts.length, 1);
  assert.deepEqual(Object.keys(posts[0]).sort(), ['category', 'description', 'location', 'reporter_name', 'urgency']);
  assert.equal(posts[0].reporter_name, '示範同事');
  assert.equal(await page.locator('#requester-name').inputValue(), '');
  console.log('PASS blank validation, actual SDK POST without status/timestamp, form reset and list refresh');

  failPost = true;
  await fill();
  await page.locator('#submit-button').click();
  await page.getByText('報修送出失敗：資料庫權限不足，請確認 GRANT 與 RLS 設定。').waitFor();
  assert.equal(await page.locator('#description').inputValue(), '示範設備無法啟動');
  assert(!(await page.locator('#submit-button').isDisabled()));
  console.log('PASS insert errors preserve input and allow retry');

  failPost = false;
  failGet = true;
  await page.locator('#submit-button').click();
  await page.getByText('報修已成功送出，謝謝你的回報。').waitFor();
  await page.getByText('清單載入失敗：模擬清單錯誤', { exact: false }).waitFor();
  await page.waitForFunction(() => !document.getElementById('refresh-button').disabled);
  console.log('PASS successful insert remains successful when subsequent list load fails');

  failGet = false;
  records = Array.from({ length: 21 }, (_, i) => ({ id: i, status: '待處理', reporter_name: '示範同事', location: '示範辦公室 ' + i, category: '網路', description: i === 0 ? '<img src=x onerror="window.injected=true">' : '示範網路中斷', urgency: '中', created_at: new Date(Date.UTC(2026, 10, 11, 8, 0, -i)).toISOString() }));
  await page.locator('#refresh-button').click();
  await page.waitForFunction(() => document.querySelectorAll('.request-card').length === 20);
  assert.equal(await page.locator('#request-count').textContent(), '20');
  assert.equal(await page.locator('.request-card h3').first().textContent(), '示範辦公室 0');
  assert.equal(await page.locator('.request-description img').count(), 0);
  assert.equal(await page.evaluate(() => window.injected), undefined);
  const beforeFilter = gets.length;
  await page.locator('[data-filter=高]').click();
  assert.equal(await page.locator('.request-card').count(), 0);
  assert.equal(gets.length, beforeFilter);
  await page.locator('[data-filter=全部]').click();
  assert.equal(await page.locator('.request-card').count(), 20);
  assert.equal(await page.locator('[data-field=status]').first().textContent(), '待處理');
  await page.screenshot({ path: '/tmp/repair-desktop.png' });
  await page.setViewportSize({ width: 375, height: 812 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: '/tmp/repair-mobile.png' });
  assert.deepEqual(errors, []);
  console.log('PASS retry, 20 records, safe text rendering, desktop/mobile layout, no page errors');

  const missingSdkPage = await context.newPage();
  await missingSdkPage.addInitScript(() => Object.defineProperty(window, 'SUPABASE_CONFIG', {
    get: () => ({ url: 'https://repair-test.supabase.co', publishableKey: 'sb_publishable_fictional_test' }), set: () => {}
  }));
  await missingSdkPage.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await missingSdkPage.goto(url);
  await missingSdkPage.getByText('Supabase 程式庫載入失敗。', { exact: false }).waitFor();
  assert(await missingSdkPage.locator('#submit-button').isDisabled());
  console.log('PASS CDN failure notice');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
