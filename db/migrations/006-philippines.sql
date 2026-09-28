DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM settings WHERE COALESCE(data->>'currency','') NOT IN ('','PHP'))
     OR EXISTS(SELECT 1 FROM sales WHERE status='posted' AND COALESCE(settings->>'currency','')<>'PHP') THEN
    RAISE EXCEPTION 'This release requires PHP. Existing non-peso or unlabelled posted amounts need an explicit data migration; no currency conversion was performed.';
  END IF;
END $$;
UPDATE settings SET data=data||'{"currency":"PHP","timezone":"Asia/Manila"}'::jsonb WHERE id=1;
ALTER TABLE settings ALTER COLUMN data SET DEFAULT '{"currency":"PHP","timezone":"Asia/Manila"}'::jsonb;
ALTER TABLE settings ADD CONSTRAINT philippine_shop_settings CHECK (
  COALESCE(data->>'currency','')='PHP' AND COALESCE(data->>'timezone','')='Asia/Manila'
);
ALTER TABLE sales ADD CONSTRAINT peso_posted_sales CHECK (
  status<>'posted' OR COALESCE(settings->>'currency','')='PHP'
);
