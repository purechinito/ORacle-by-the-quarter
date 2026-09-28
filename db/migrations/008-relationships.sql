ALTER TABLE audit_events ADD COLUMN details jsonb NOT NULL DEFAULT '{}';
ALTER TABLE customers ADD COLUMN party_type text NOT NULL DEFAULT 'company' CHECK(party_type IN ('company','individual')),
 ADD COLUMN email text NOT NULL DEFAULT '', ADD COLUMN contact_name text NOT NULL DEFAULT '', ADD COLUMN tin text NOT NULL DEFAULT '',
 ADD COLUMN address jsonb NOT NULL DEFAULT '{}', ADD COLUMN terms_days integer NOT NULL DEFAULT 0 CHECK(terms_days BETWEEN 0 AND 365),
 ADD COLUMN credit_limit numeric(14,2) NOT NULL DEFAULT 0 CHECK(credit_limit>=0), ADD COLUMN currency text NOT NULL DEFAULT 'PHP' CHECK(currency='PHP'),
 ADD COLUMN notes text NOT NULL DEFAULT '', ADD COLUMN active boolean NOT NULL DEFAULT true,
 ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0), ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE suppliers ADD COLUMN party_type text NOT NULL DEFAULT 'company' CHECK(party_type IN ('company','individual')),
 ADD COLUMN phone text NOT NULL DEFAULT '', ADD COLUMN email text NOT NULL DEFAULT '', ADD COLUMN contact_name text NOT NULL DEFAULT '', ADD COLUMN tin text NOT NULL DEFAULT '',
 ADD COLUMN address jsonb NOT NULL DEFAULT '{}', ADD COLUMN terms_days integer NOT NULL DEFAULT 0 CHECK(terms_days BETWEEN 0 AND 365),
 ADD COLUMN credit_limit numeric(14,2) NOT NULL DEFAULT 0 CHECK(credit_limit>=0), ADD COLUMN currency text NOT NULL DEFAULT 'PHP' CHECK(currency='PHP'),
 ADD COLUMN notes text NOT NULL DEFAULT '', ADD COLUMN active boolean NOT NULL DEFAULT true,
 ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0), ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX customers_name_page ON customers(lower(name),id);
CREATE INDEX suppliers_name_page ON suppliers(lower(name),id);
CREATE INDEX customer_sales ON sales(customer_id,created_at DESC,id);
CREATE INDEX supplier_purchases ON purchases(supplier_id,created_at DESC,id);
