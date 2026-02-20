-- 차고셔터 패널 설정 (기존 DB에 컬럼 없을 때만 추가)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'garage_wood_multiplier') THEN
    ALTER TABLE app_settings ADD COLUMN garage_wood_multiplier NUMERIC NOT NULL DEFAULT 1.25;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'garage_dark_addition') THEN
    ALTER TABLE app_settings ADD COLUMN garage_dark_addition INTEGER NOT NULL DEFAULT 187000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'garage_premium_addition') THEN
    ALTER TABLE app_settings ADD COLUMN garage_premium_addition INTEGER NOT NULL DEFAULT 440000;
  END IF;
END $$;
