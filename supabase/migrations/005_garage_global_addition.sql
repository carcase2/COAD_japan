-- 차고셔터 단가 테이블 전체 추가 금액 (모든 셀에 더해짐)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'garage_global_addition') THEN
    ALTER TABLE app_settings ADD COLUMN garage_global_addition INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;
