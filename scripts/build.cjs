// 僅把公開設定寫入網站成品，不將本機 config.js 加入 Git。
const fs = require('node:fs');
const path = require('node:path');
const { validate } = require('./config-utils.cjs');
const config = process.env.SUPABASE_URL || process.env.SUPABASE_PUBLISHABLE_KEY
  ? validate({ url: process.env.SUPABASE_URL, publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY })
  : validate(JSON.parse(fs.readFileSync(path.join(__dirname, '../deployment.public.json'), 'utf8')));
const root = path.join(__dirname, '..');
const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });
for (const file of ['index.html', 'style.css', 'app.js']) fs.copyFileSync(path.join(root, file), path.join(out, file));
fs.writeFileSync(path.join(out, 'config.js'), 'window.SUPABASE_CONFIG = ' + JSON.stringify(config, null, 2) + ';\n');
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('網站成品已建立於 dist；包含公開金鑰，不包含任何後台金鑰。');
