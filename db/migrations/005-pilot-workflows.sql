ALTER TABLE purchases ADD COLUMN cancel_reason text;
ALTER TABLE payments ADD COLUMN tendered numeric(14,2);
ALTER TABLE payments ADD COLUMN change numeric(14,2);
ALTER TABLE payments ADD CONSTRAINT payment_tender_consistent CHECK (
  tendered IS NULL AND change IS NULL OR
  tendered IS NOT NULL AND change IS NOT NULL AND tendered >= amount AND change = tendered - amount
);
ALTER TABLE returns ADD COLUMN refund_reference text;
ALTER TABLE returns ADD COLUMN refunded_at timestamptz;
ALTER TABLE returns ADD COLUMN refunded_by uuid REFERENCES users;
CREATE INDEX sales_history ON sales(created_at DESC,id DESC);
CREATE INDEX purchases_history ON purchases(created_at DESC,id DESC);
