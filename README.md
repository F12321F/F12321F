# 報修登記系統
用於登記設備、網路或環境等問題，並集中查看報修清單。

## 網頁檔案與使用方式

- `index.html`：報修表單與最近 20 筆清單。
- `style.css`：桌面與手機版樣式。
- `app.js`：表單驗證、Supabase 新增與讀取、成功及錯誤訊息。
- `config.js`：本機連線設定，已加入 `.gitignore`。
- `config.example.js`：可分享的設定範例；缺少 `config.js` 時，複製此檔並改名。

在 `config.js` 將 `YOUR_SUPABASE_URL` 與 `YOUR_SUPABASE_PUBLISHABLE_KEY` 換成自己的 Supabase 專案網址及公開 Publishable Key。不要填入 secret 或 service_role 金鑰。

雙擊 `index.html` 即可使用，不需安裝套件、建置或啟動伺服器。頁面使用一般 script，由 CDN 載入 supabase-js v2，需有網路連線。設定未填或 CDN 載入失敗時，會顯示提示並停用送出。

## 資料表對應

前端使用既有 Supabase 資料表 `repair_requests`，不建立或更改資料庫結構：

| 欄位 | 用途與預期值 |
| --- | --- |
| `id` | 資料庫自動產生的識別碼 |
| `requester_name` | 報修人，文字 |
| `location` | 地點或部門，文字 |
| `category` | 設備／網路／環境／其他 |
| `description` | 問題說明，文字 |
| `priority` | 低／中／高 |
| `created_at` | 資料庫自動產生的登記時間，例如 timestamptz 預設 `now()` |

新增只包含五個表單欄位，不送 `status`、`id` 或 `created_at`。若資料表有 `status` 必填欄位，請在資料庫設定其預設值，例如「待處理」。清單依 `created_at` 降冪取 20 筆，時間以使用者瀏覽器時區顯示。

資料庫需啟用 RLS，允許公開角色 SELECT、INSERT，禁止 UPDATE、DELETE；這些政策需另外在 Supabase 設定，前端本身無法保證存取限制。請使用虛構資料；所有可讀取清單的人都能看到報修內容。

## 驗證方式

JavaScript 語法檢查（如已安裝 Node.js）：`node --check app.js`、`node --check config.js`。

填好設定後，雙擊 `index.html`，以虛構姓名與地點提交一筆報修，確認成功提示、表單重設、清單最上方出現新紀錄，以及登記時間由資料庫產生。確認空白欄位無法送出；斷網時顯示錯誤且保留表單內容。用公開金鑰另行驗證資料庫拒絕 UPDATE、DELETE，並確認手機版可正常操作。
