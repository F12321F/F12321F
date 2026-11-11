# 報修登記系統

純 HTML/CSS/JavaScript 報修表單，透過 CDN 載入 supabase-js v2。可直接雙擊 `index.html`；需要網路連線。手機與電腦共用 Supabase 資料，不使用本機假資料取代資料庫。

## 已實作

- 登記報修人、地點或部門、類別、問題說明、緊急程度。
- 新增僅送 `reporter_name`、`location`、`category`、`description`、`urgency`；不送 `id`、`created_at`、`status`。
- 清單顯示資料庫狀態與時間；依 `created_at`、`id` 由新到舊取最近 20 筆。
- 全部／高／中／低篩選只使用已讀到的 20 筆，不另查資料庫；高緊急程度標紅色。
- 成功、錯誤、空清單、載入中提示；失敗保留輸入，成功後重設表單並重新載入清單。
- 登入、通知、編輯、刪除、負責人及照片欄位：目前沒有。採 Word 教材雲端版任務 32–39；PDF 舊版任務 37 的新增欄位不混入此版本。

## 連線與開啟

1. 本機 `config.js` 放 Supabase URL 與 `sb_publishable_` 開頭的公開金鑰，缺少時複製 `config.example.js`。
2. 雙擊 `index.html`。雲端瀏覽器若禁止 file://，可由代理啟動 `node scripts/preview.cjs`，使用雲端桌面瀏覽器開啟 http://localhost:8765。此 localhost 屬於雲端，並非使用者電腦。
3. 使用虛構資料登記；成功後應看到資料庫產生的「待處理」及登記時間。

**config.js 已加入 .gitignore，不納入 Git。** Pages 部署由 `deployment.public.json` 產生 `dist/config.js`，只含專案網址及公開 publishable key；不能放 secret、service_role、資料庫密碼或管理權杖。公開 key 是瀏覽器必須取得的設定，資料安全依賴資料庫權限。

## Supabase 後台

專案：`lnjbtvieltzhhcxzuruk`；API：`https://lnjbtvieltzhhcxzuruk.supabase.co`。

在已登入且有管理權限的 Supabase SQL Editor 執行完整 [schema.sql](supabase/schema.sql)。此檔從現有 main 整合而來，本次沒有修改結構。它使用交易，保留既有資料；若既有欄位不是預期的八欄或資料不符合限制會回滾，請先檢查差異，不能刪表重建來迴避。

八欄：`id`、`created_at`、`reporter_name`、`location`、`category`、`description`、`urgency`、`status`。

三層保護：GRANT 只允許 anon SELECT 與五個欄位 INSERT；RLS 允許讀取、新增僅限待處理；CHECK 限制文字長度、不可全空白及允許值。未登入訪客可以讀全部報修，因此只使用虛構／去識別資料。沒有防垃圾新增、登入或存取頻率限制。

## GitHub Pages

預期網址： https://f12321f.github.io/F12321F/ （這是目標網址，不代表已部署成功）。

- GitHub Settings → Pages → Source 選 GitHub Actions。
- 合併 PR 至 main 後，`.github/workflows/pages.yml` 建置並部署。亦可在 Actions 手動執行。
- 預設讀 `deployment.public.json`；若設定 Repository Variables `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`，必須兩個一起設定，會覆蓋公開設定檔。
- 建置拒絕占位字串及非公開金鑰。只上傳 index.html、style.css、app.js、產生的 config.js，不上傳原始文件或測試工具。
- 需確認 Actions 部署成功，再用手機及電腦開目標網址新增、讀回同一筆資料。

## 驗證與工具

網頁本身不需 npm。開發測試可 `npm install`，工具如下：

| 命令 | 作用 |
| --- | --- |
| `node --check app.js` | 語法檢查 |
| `node scripts/build.cjs` | 產生 Pages 成品 dist |
| `node scripts/preview.cjs` | Node.js 預覽，不使用 Python |
| `node tests/database.cjs` | 本機 PostgreSQL WASM 驗證 GRANT、RLS、CHECK 及重複套用保留資料 |
| `node tests/browser.cjs` | 先啟動預覽；Chromium 模擬 API 功能測試，不寫真實資料庫 |
| `node scripts/verify-live.cjs` | 公開金鑰新增一筆虛構驗收資料，再各做一次四項負向測試；只對該筆測試更新／刪除 |

瀏覽器測試預設使用 `/usr/bin/chromium`，可用 `CHROMIUM_PATH` 指定；離線 SDK 測試可設定 `SUPABASE_SDK_PATH`。受代理管理的 Node.js 24 環境執行真實 API 測試時使用 `NODE_USE_ENV_PROXY=1`。環境需允許 supabase.com、*.supabase.co、api.github.com、f12321f.github.io；保留既有允許網域。

實際驗收報告寫入 `outputs/live-verification.json`，不含金鑰。HTTP 狀態單獨不足以判斷是哪層拒絕，需搭配 PostgreSQL 錯誤碼與 SQL 權限；網路代理 403 不能算資料庫保護測試成功。

## 教材交付文件

- [Excel 欄位表](文件/報修欄位表.xlsx)（沿用 main 已有欄位表）
- [報修系統操作說明](文件/報修系統操作說明.docx)
- [六頁提案](文件/報修登記系統提案.pptx)
- [設置檢討與驗收](文件/設置檢討與驗收.md)

雲端任務測試
