-- 제품 타입: 시트셔터, 차고셔터
-- 단가 테이블: product_type + width_index + height_index -> c1_price

CREATE TABLE IF NOT EXISTS unit_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL CHECK (product_type IN ('sheet_shutter', 'garage_shutter')),
  width_index INTEGER NOT NULL CHECK (width_index >= 0 AND width_index <= 19),
  height_index INTEGER NOT NULL CHECK (height_index >= 0 AND height_index <= 11),
  c1_price INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_type, width_index, height_index)
);

-- RLS 활성화
ALTER TABLE unit_prices ENABLE ROW LEVEL SECURITY;

-- 익명 읽기/쓰기 허용 (내부 관리용)
CREATE POLICY "Allow public read" ON unit_prices FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON unit_prices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON unit_prices FOR UPDATE USING (true);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER unit_prices_updated_at
  BEFORE UPDATE ON unit_prices
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
