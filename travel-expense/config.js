// 旅行分帳本雲端設定（Supabase）
// 填好後，網頁版與 Android App 打開就會直接連到這個 Supabase 專案，旅伴不用自己設定。
// 只能填 anon / publishable 金鑰（設計上可公開，資料靠 RLS 與分享碼保護）。
// 絕對不要填 service_role / secret 金鑰。
// 留空時，使用者也可以在 App 的「雲端同步」面板自行輸入。
window.TRAVEL_SPLIT_CONFIG = {
  supabaseUrl: "",
  supabaseKey: ""
};
