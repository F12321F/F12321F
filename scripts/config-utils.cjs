const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function readConfig() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../config.js'), 'utf8'), sandbox, { timeout: 1000 });
  return validate(sandbox.window.SUPABASE_CONFIG);
}
function validate(config) {
  if (!config || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey || '')) {
    throw new Error('需要 sb_publishable_ 開頭的公開金鑰，拒絕占位字串或其他金鑰。');
  }
  const url = new URL(config.url);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.username || url.password || url.port || url.search || url.hash || url.pathname !== '/') {
    throw new Error('請填入 https://專案識別碼.supabase.co 格式的專案網址。');
  }
  return { url: url.origin, publishableKey: config.publishableKey };
}
module.exports = { readConfig, validate };
