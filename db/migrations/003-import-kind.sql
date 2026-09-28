ALTER TABLE import_previews ADD COLUMN kind text NOT NULL DEFAULT 'catalog' CHECK(kind IN ('catalog','opening'));
