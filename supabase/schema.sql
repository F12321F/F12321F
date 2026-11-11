-- 報修登記系統：Supabase 建表腳本。
-- 檔案位置：supabase/schema.sql；供人工審閱後於 Supabase SQL Editor 使用。
-- 本次僅產生檔案，未執行 SQL；本版支援首次建立及重複套用至相容的既有資料表。
-- 使用方式：在 Supabase SQL Editor 以資料表擁有者執行整份檔案，不要只執行部分片段。
-- 保留既有資料；不刪表、不改寫資料、不自動轉換欄位型態。
-- 會重設本表的既有 RLS 政策與 PUBLIC／anon／authenticated 的直接權限。
-- 結構不相容或舊資料不符合限制時，整個交易失敗並回滾，需先確認差異。
-- 文字必填與長度在原筆記中未定，以下是本版設計假設，正式上線前待確認：
-- 報修人姓名 1–100 字元、地點或部門 1–200 字元、問題說明 1–5000 字元。
-- 上述文字不可為空白；長度以 PostgreSQL char_length 計算，非位元組數。
-- 匿名呼叫者只提交姓名、地點、類別、問題說明，可選填緊急程度。
-- id、created_at、status 由資料庫預設產生，匿名呼叫者沒有這三欄的 INSERT 權限。

-- 以交易包住建表與安全設定，避免只有部分設定完成。
BEGIN;

-- 建立報修資料表；全部欄位均不可為 NULL，以免 CHECK 遇到 NULL 時無法阻擋。
-- 建立時間使用帶時區的時間戳記，預設為資料庫交易開始時間。
CREATE TABLE IF NOT EXISTS public.repair_requests (
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

-- 既有資料表檢查：鎖定本表，避免檢查期間有人寫入；交易結束後釋放。
-- IF NOT EXISTS 只略過建表，不會驗證舊表結構，因此另外檢查全部八個欄位。
LOCK TABLE public.repair_requests IN ACCESS EXCLUSIVE MODE;
DO $validate_structure$
DECLARE
    expected record;
    actual_type oid;
    actual_id smallint;
    primary_columns smallint[];
BEGIN
    IF (SELECT count(*) FROM pg_attribute
        WHERE attrelid = 'public.repair_requests'::regclass
          AND attnum > 0 AND NOT attisdropped) <> 8 THEN
        RAISE EXCEPTION '既有 repair_requests 欄位數與設計不同；請先檢查結構，本腳本不會刪除或新增舊表欄位。';
    END IF;

    FOR expected IN SELECT * FROM (VALUES
        ('id', 'uuid'), ('created_at', 'timestamptz'),
        ('reporter_name', 'text'), ('location', 'text'), ('category', 'text'),
        ('description', 'text'), ('urgency', 'text'), ('status', 'text')
    ) AS required(column_name, type_name)
    LOOP
        SELECT atttypid INTO actual_type FROM pg_attribute
        WHERE attrelid = 'public.repair_requests'::regclass
          AND attname = expected.column_name AND attnum > 0 AND NOT attisdropped
          AND attgenerated = '' AND attidentity = '';
        IF actual_type IS DISTINCT FROM to_regtype(expected.type_name)::oid THEN
            RAISE EXCEPTION '欄位 % 必須為一般 % 欄位；請先檢查既有結構，本腳本不會自動轉型。',
                expected.column_name, expected.type_name;
        END IF;
    END LOOP;

    SELECT attnum INTO actual_id FROM pg_attribute
    WHERE attrelid = 'public.repair_requests'::regclass AND attname = 'id';
    SELECT conkey INTO primary_columns FROM pg_constraint
    WHERE conrelid = 'public.repair_requests'::regclass AND contype = 'p';
    IF primary_columns IS NULL THEN
        -- 若舊表沒有主鍵，新增 id 主鍵；重複值或空值會使交易失敗，不會自動刪除資料。
        ALTER TABLE public.repair_requests ADD PRIMARY KEY (id);
    ELSIF primary_columns IS DISTINCT FROM ARRAY[actual_id] THEN
        RAISE EXCEPTION '既有主鍵不是單一 id 欄位；請先確認設計，本腳本不會取代既有主鍵。';
    END IF;
END;
$validate_structure$;

-- 更新相容舊表的預設值及不可空值限制；不回填或覆寫舊資料。
ALTER TABLE public.repair_requests
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN created_at SET DEFAULT now(),
    ALTER COLUMN urgency SET DEFAULT '中',
    ALTER COLUMN status SET DEFAULT '待處理',
    ALTER COLUMN id SET NOT NULL,
    ALTER COLUMN created_at SET NOT NULL,
    ALTER COLUMN reporter_name SET NOT NULL,
    ALTER COLUMN location SET NOT NULL,
    ALTER COLUMN category SET NOT NULL,
    ALTER COLUMN description SET NOT NULL,
    ALTER COLUMN urgency SET NOT NULL,
    ALTER COLUMN status SET NOT NULL;

-- 第三層 CHECK：重建本腳本管理的六項限制，確保舊表也受到相同保護。
-- ADD CONSTRAINT 預設立即檢查所有舊資料；不合規時回滾，保留原始資料與設定。
ALTER TABLE public.repair_requests
    DROP CONSTRAINT IF EXISTS repair_requests_reporter_name_check,
    DROP CONSTRAINT IF EXISTS repair_requests_location_check,
    DROP CONSTRAINT IF EXISTS repair_requests_description_check,
    DROP CONSTRAINT IF EXISTS repair_requests_category_check,
    DROP CONSTRAINT IF EXISTS repair_requests_urgency_check,
    DROP CONSTRAINT IF EXISTS repair_requests_status_check;
ALTER TABLE public.repair_requests
    ADD CONSTRAINT repair_requests_reporter_name_check CHECK (
        char_length(reporter_name) BETWEEN 1 AND 100 AND reporter_name ~ '[^[:space:]]'
    ),
    ADD CONSTRAINT repair_requests_location_check CHECK (
        char_length(location) BETWEEN 1 AND 200 AND location ~ '[^[:space:]]'
    ),
    ADD CONSTRAINT repair_requests_description_check CHECK (
        char_length(description) BETWEEN 1 AND 5000 AND description ~ '[^[:space:]]'
    ),
    ADD CONSTRAINT repair_requests_category_check CHECK (
        category IN ('設備', '網路', '環境', '其他')
    ),
    ADD CONSTRAINT repair_requests_urgency_check CHECK (urgency IN ('低', '中', '高')),
    ADD CONSTRAINT repair_requests_status_check CHECK (status IN ('待處理', '處理中', '已完成'));

-- 第二層 RLS：啟用資料列安全；政策本身不會授予資料表操作權限。
ALTER TABLE public.repair_requests ENABLE ROW LEVEL SECURITY;

-- 第一步先撤銷一般 API 角色與 PUBLIC 的資料表權限，再明確授予最小權限。
-- 表級 REVOKE 不會清除舊有欄位授權，因此後續逐欄撤銷，再授予需要的權限。
-- 不為 authenticated 授權；本次示範不含登入，任何人均以 anon 公開角色使用。
REVOKE ALL PRIVILEGES ON TABLE public.repair_requests
    FROM PUBLIC, anon, authenticated;

-- 第一層 GRANT：清除三個一般角色在本表的全部直接欄位權限。
DO $reset_column_grants$
DECLARE
    col record;
BEGIN
    FOR col IN SELECT attname FROM pg_attribute
        WHERE attrelid = 'public.repair_requests'::regclass AND attnum > 0 AND NOT attisdropped
    LOOP
        EXECUTE format(
            'REVOKE ALL PRIVILEGES (%I) ON TABLE public.repair_requests FROM PUBLIC, anon, authenticated',
            col.attname
        );
    END LOOP;
END;
$reset_column_grants$;

-- 第二層 RLS：先移除本表全部舊政策，避免舊的寬鬆政策以 OR 合併而放寬新增限制。
-- 此處只重設這張報修表的政策，不影響其他資料表；後面只建立讀取與新增政策。
DO $reset_policies$
DECLARE
    existing_policy record;
BEGIN
    FOR existing_policy IN SELECT polname FROM pg_policy
        WHERE polrelid = 'public.repair_requests'::regclass
    LOOP
        EXECUTE format('DROP POLICY %I ON public.repair_requests', existing_policy.polname);
    END LOOP;
END;
$reset_policies$;

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
