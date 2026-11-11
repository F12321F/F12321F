-- 報修登記系統：Supabase 建表腳本。
-- 檔案位置：supabase/schema.sql；供人工審閱後於 Supabase SQL Editor 使用。
-- 本次僅產生檔案，未執行任何 SQL；此腳本用於首次建表，重複執行會因資料表已存在而失敗。
-- 文字必填與長度在原筆記中未定，以下是本版設計假設，正式上線前待確認：
-- 報修人姓名 1–100 字元、地點或部門 1–200 字元、問題說明 1–5000 字元。
-- 上述文字不可為空白；長度以 PostgreSQL char_length 計算，非位元組數。
-- 匿名呼叫者只提交姓名、地點、類別、問題說明，可選填緊急程度。
-- id、created_at、status 由資料庫預設產生，匿名呼叫者沒有這三欄的 INSERT 權限。

-- 以交易包住建表與安全設定，避免只有部分設定完成。
BEGIN;

-- 建立報修資料表；全部欄位均不可為 NULL，以免 CHECK 遇到 NULL 時無法阻擋。
-- 建立時間使用帶時區的時間戳記，預設為資料庫交易開始時間。
CREATE TABLE public.repair_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    reporter_name text NOT NULL,
    location text NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    urgency text NOT NULL DEFAULT '中',
    status text NOT NULL DEFAULT '待處理',

    -- 第三層 CHECK：限制文字長度，並拒絕完全由空白組成的內容。
    CONSTRAINT repair_requests_reporter_name_check CHECK (
        char_length(reporter_name) BETWEEN 1 AND 100
        AND reporter_name ~ '[^[:space:]]'
    ),
    CONSTRAINT repair_requests_location_check CHECK (
        char_length(location) BETWEEN 1 AND 200
        AND location ~ '[^[:space:]]'
    ),
    CONSTRAINT repair_requests_description_check CHECK (
        char_length(description) BETWEEN 1 AND 5000
        AND description ~ '[^[:space:]]'
    ),

    -- 第三層 CHECK：限制類別、緊急程度與處理狀態的允許值。
    -- 狀態 CHECK 保留三種合法值；匿名新增只能使用待處理，由權限與 RLS 再限制。
    CONSTRAINT repair_requests_category_check CHECK (
        category IN ('設備', '網路', '環境', '其他')
    ),
    CONSTRAINT repair_requests_urgency_check CHECK (
        urgency IN ('低', '中', '高')
    ),
    CONSTRAINT repair_requests_status_check CHECK (
        status IN ('待處理', '處理中', '已完成')
    )
);

-- 第二層 RLS：啟用資料列安全；政策本身不會授予資料表操作權限。
ALTER TABLE public.repair_requests ENABLE ROW LEVEL SECURITY;

-- 第一步先撤銷一般 API 角色與 PUBLIC 的資料表權限，再明確授予最小權限。
-- 本腳本建立全新資料表，沒有需要另外清除的既有欄位授權。
-- 不為 authenticated 授權；本次示範不含登入，任何人均以 anon 公開角色使用。
REVOKE ALL PRIVILEGES ON TABLE public.repair_requests
    FROM PUBLIC, anon, authenticated;

-- 第一層 GRANT：anon 需要 schema 使用權以及完整清單的 SELECT 權限。
-- 僅授權新增表單必要欄位，urgency 未提交時使用預設「中」。
-- 不授予 UPDATE、DELETE、TRUNCATE 或整張表的 INSERT 權限。
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON TABLE public.repair_requests TO anon;
GRANT INSERT (reporter_name, location, category, description, urgency)
    ON TABLE public.repair_requests TO anon;

-- 第二層 RLS：任何未登入訪客均可透過 anon 讀取全部清單。
CREATE POLICY repair_requests_anon_select
    ON public.repair_requests
    FOR SELECT
    TO anon
    USING (true);

-- 第二層 RLS：新增後的狀態必須是「待處理」。
-- 即使日後誤增 status 欄位的 INSERT 權限，此政策仍會阻擋其他狀態。
-- 不建立 UPDATE 或 DELETE 政策，這兩種操作在 RLS 下預設拒絕。
CREATE POLICY repair_requests_anon_insert
    ON public.repair_requests
    FOR INSERT
    TO anon
    WITH CHECK (status = '待處理');

-- 全部建表、安全設定與政策成功後才提交；此檔案目前尚未執行。
COMMIT;
