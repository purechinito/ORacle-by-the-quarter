ALTER TABLE parts ADD COLUMN currency text NOT NULL DEFAULT 'PHP' CHECK(currency='PHP');
ALTER TABLE purchases ADD COLUMN currency text NOT NULL DEFAULT 'PHP' CHECK(currency='PHP');
ALTER TABLE purchase_lines ADD COLUMN currency text NOT NULL DEFAULT 'PHP' CHECK(currency='PHP');
ALTER TABLE sales ADD COLUMN currency text NOT NULL DEFAULT 'PHP' CHECK(currency='PHP');
ALTER TABLE payments ADD COLUMN currency text NOT NULL DEFAULT 'PHP' CHECK(currency='PHP');
ALTER TABLE returns ADD COLUMN currency text NOT NULL DEFAULT 'PHP' CHECK(currency='PHP');
