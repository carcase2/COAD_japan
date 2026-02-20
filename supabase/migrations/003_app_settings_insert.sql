-- app_settings: anon이 행이 없을 때 INSERT 할 수 있도록 (upsert용)
CREATE POLICY "Allow public insert" ON app_settings FOR INSERT WITH CHECK (true);
