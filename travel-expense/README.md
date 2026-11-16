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

## 使用方式

直接用瀏覽器開啟 `travel-expense/index.html`（電腦或手機皆可），或開啟安裝好的 App。

1. **旅伴**：輸入名字加入，至少 2 人。
2. **記一筆**：填日期、項目、分類、金額，選擇幣別（預設新台幣 TWD，可選日圓、美元、韓元、歐元等 40 多種外幣）與付款人。
   - 外幣會自動帶入參考匯率（1 外幣 = ? 新台幣），可改成實際換匯或刷卡匯率；每筆支出各自保存匯率。
   - 分攤方式：**平均分攤**（勾選參與的人）或 **自訂金額**（每人輸入應付金額，合計須等於總金額）。
3. **結算**：以新台幣計算每人已付、應分攤與差額，並列出最少筆數的建議轉帳；可切換顯示幣別。
4. **支出明細**：依日期分組，可依旅伴篩選、編輯、刪除，並顯示分類小計。
5. **匯率設定**：修改各幣別預設匯率（只影響之後新增的支出）。
6. **資料備份與分享**：資料存在瀏覽器 localStorage。可「複製備份文字」貼給旅伴匯入、「複製明細」貼到 Excel，或「複製結算結果」貼到群組。

首次開啟會顯示虛構的範例資料，按「清空範例，開始我的旅程」即可開始。

## 檔案

| 路徑 | 說明 |
| --- | --- |
| `index.html` | 程式本體（網頁版與 App 共用） |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA 安裝設定、離線快取、圖示 |
| `app/` | Capacitor Android 專案（`android/` 為原生專案） |

## 驗證

開啟頁面後新增一筆外幣支出，確認總支出與結算更新；重新整理後資料仍在；自訂金額合計不符時會顯示錯誤。
