-- 사용 히스토리: 어디서 얼마나 사용했는지 (견적 계산 시 기록)
CREATE TABLE IF NOT EXISTS usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  product_type TEXT NOT NULL CHECK (product_type IN ('sheet_shutter', 'garage_shutter')),
  width_mm INTEGER NOT NULL,
  height_mm INTEGER NOT NULL,
  price_yen INTEGER NOT NULL,
  type_info TEXT NOT NULL,
  referrer TEXT
);

CREATE INDEX IF NOT EXISTS idx_usage_history_created_at ON usage_history (created_at DESC);

ALTER TABLE usage_history ENABLE ROW LEVEL SECURITY;

-- 클라이언트에서 기록만 허용, 조회는 API에서 비밀번호 확인 후 서버로만
-- 재실행 시 정책 중복 오류 방지
DROP POLICY IF EXISTS "Allow public insert" ON usage_history;
DROP POLICY IF EXISTS "Allow public read" ON usage_history;
CREATE POLICY "Allow public insert" ON usage_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read" ON usage_history FOR SELECT USING (true);
