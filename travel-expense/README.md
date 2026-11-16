# 旅行分帳本

多人旅行共用的記帳程式，單一 HTML 檔，不需安裝或後端。

## 安裝成 App

### Android App（APK）
推送到 GitHub 後，`.github/workflows/travel-expense-android.yml` 會自動建置 APK：
- 到 GitHub 的 **Releases → 旅行分帳本 Android 測試版**（tag `travel-split-latest`），用 Android 手機下載 `travel-split.apk` 安裝。第一次需允許「安裝不明來源的應用程式」。
- 也可在 **Actions** 該次執行的 Artifacts 下載 `travel-split-apk`。
- 目前為 debug 簽章，適合自己與旅伴安裝；要上架 Google Play 需另設正式簽章金鑰。

本機自行建置（需 Node 22、JDK 21、Android SDK）：
```bash
cd travel-expense/app
npm ci
npm run android:apk        # 產出 android/app/build/outputs/apk/debug/app-debug.apk
npx cap open android       # 或用 Android Studio 開啟
```
修改 `travel-expense/index.html` 後執行 `npm run android:sync` 即可同步到 App。圖示與啟動畫面來源在 `app/assets/`，改圖後執行 `npx capacitor-assets generate --android`。

### 加到手機主畫面（PWA，iPhone / Android 皆可）
將 `travel-expense/` 放到任何 HTTPS 網站（例如 GitHub Pages）後，用手機開啟：
- iPhone Safari：分享 → 加入主畫面
- Android Chrome：選單 → 安裝應用程式

安裝後有獨立圖示、全螢幕開啟，沒有網路也能使用（`sw.js` 會快取程式）。

## 雲端同步（Supabase）

設定好之後，旅程資料會存到 Supabase，旅伴輸入同一組分享碼就能一起記帳，每 15 秒自動同步。沒有網路時，變更會先放在手機裡，恢復連線後自動上傳。

### 第一次設定（只要做一次）
1. 到 [supabase.com](https://supabase.com) 建立專案。
2. 打開 **SQL Editor**，貼上 `travel-expense/supabase/schema.sql` 全部內容後按 Run（可重複執行）。
3. 到 **Project Settings → API**（或 API Keys）複製 **Project URL** 與 **anon / publishable** 金鑰。
4. 二選一：
   - 填進 `travel-expense/config.js` 並推送：網頁版與 Android App 打開就會直接連線，旅伴不用設定（建議）。
   - 或在 App 的「雲端同步」面板貼上並按「測試並儲存」，只對這台裝置有效。

**絕對不要**使用 service_role / secret 金鑰，App 也會拒絕這種金鑰。anon / publishable 金鑰本來就設計成可以放在 App 裡，資料由 RLS 與分享碼保護。

### 使用
- **把目前旅程上傳到雲端**：產生 12 碼分享碼（例如 `1A2B-3C4D-5E6F`）。
- **加入**：旅伴在「雲端同步」輸入分享碼；網頁版也可以傳「邀請連結」（`?trip=分享碼`）。
- **離開此旅程**：切回這台裝置的本機資料，雲端資料仍保留，之後可從「最近的雲端旅程」再打開。
- 雲端旅程中「匯入備份」會取代雲端上的資料，所有旅伴都會看到。

### 資料與權限設計
- 資料表：`trips`（旅程、分享碼、匯率、版本號）、`trip_members`（旅伴）、`trip_expenses`（支出）。
- 三張表都開啟 RLS 且沒有 policy，並撤銷 anon / authenticated 的資料表權限：用 App 裡的金鑰**無法直接讀、改、刪資料表**。
- App 只能呼叫 `create_trip`、`get_trip`、`trip_version`、`update_trip`、`upsert_member`、`delete_member`、`upsert_expense`、`delete_expense`、`replace_trip` 這幾個函式，每次都要帶分享碼，函式內會檢查格式、旅伴是否存在、自訂金額合計等規則。
- **知道分享碼的人就能查看與編輯該旅程**（不需登入），請只傳給旅伴。每個旅程最多 50 位旅伴、3000 筆支出。
- Claude 預覽頁（artifact）因為安全限制無法連外，雲端同步只能在網頁版或 App 使用。

## 使用方式

直接用瀏覽器開啟 `travel-expense/index.html`（電腦或手機皆可），或開啟安裝好的 App。

1. **旅伴**：輸入名字加入，至少 2 人。
2. **記一筆**：填日期、項目、分類、金額，選擇幣別（預設新台幣 TWD，可選日圓、美元、韓元、歐元等 40 多種外幣）與付款人。
   - 外幣會自動帶入參考匯率（1 外幣 = ? 新台幣），可改成實際換匯或刷卡匯率；每筆支出各自保存匯率。
   - 分攤方式：**平均分攤**（勾選參與的人）或 **自訂金額**（每人輸入應付金額，合計須等於總金額）。
3. **結算**：以新台幣計算每人已付、應分攤與差額，並列出最少筆數的建議轉帳；可切換顯示幣別。
4. **支出明細**：依日期分組，可依旅伴篩選、編輯、刪除，並顯示分類小計。
5. **匯率設定**：修改各幣別預設匯率（只影響之後新增的支出）。
6. **資料備份與分享**：本機旅程存在瀏覽器 localStorage；雲端旅程見上方「雲端同步」。可「複製備份文字」貼給旅伴匯入、「複製明細」貼到 Excel，或「複製結算結果」貼到群組。

首次開啟會顯示虛構的範例資料，按「清空範例，開始我的旅程」即可開始。

## 檔案

| 路徑 | 說明 |
| --- | --- |
| `index.html` | 程式本體（網頁版與 App 共用） |
| `config.js` | Supabase 連線設定（只放 anon / publishable 金鑰） |
| `supabase/schema.sql` | Supabase 資料表、RLS 與 API 函式 |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA 安裝設定、離線快取、圖示 |
| `app/` | Capacitor Android 專案（`android/` 為原生專案） |

## 驗證

開啟頁面後新增一筆外幣支出，確認總支出與結算更新；重新整理後資料仍在；自訂金額合計不符時會顯示錯誤。
