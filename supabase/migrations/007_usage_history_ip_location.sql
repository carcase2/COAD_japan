-- IP 주소·위치 컬럼 추가
ALTER TABLE usage_history
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT;
