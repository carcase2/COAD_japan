-- C-2, C-3 추가 금액 설정 (수정 가능)
-- update_updated_at() 함수는 001_unit_prices.sql 에서 생성됨. 없으면 아래에서 생성.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  c2_addition INTEGER NOT NULL DEFAULT 180000,
  c3_addition INTEGER NOT NULL DEFAULT 450000,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- 초기 데이터
INSERT INTO app_settings (id, c2_addition, c3_addition)
VALUES (1, 180000, 450000)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON app_settings FOR SELECT USING (true);
CREATE POLICY "Allow public update" ON app_settings FOR UPDATE USING (true);
CREATE POLICY "Allow public insert" ON app_settings FOR INSERT WITH CHECK (true);

DROP TRIGGER IF EXISTS app_settings_updated_at ON app_settings;
CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
