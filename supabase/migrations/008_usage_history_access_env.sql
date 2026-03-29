-- 접속환경 요약 (PC/모바일 · 브라우저 · OS)
ALTER TABLE usage_history
  ADD COLUMN IF NOT EXISTS access_env TEXT;
