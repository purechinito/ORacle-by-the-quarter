CREATE TABLE gl_accounts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text NOT NULL UNIQUE,name text NOT NULL,
 type text NOT NULL CHECK(type IN ('asset','liability','equity','income','expense')),active boolean NOT NULL DEFAULT true,
 currency text NOT NULL DEFAULT 'PHP' CHECK(currency='PHP'),created_by uuid NOT NULL REFERENCES users,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE gl_periods(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,starts_on date NOT NULL,ends_on date NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),CHECK(starts_on<=ends_on),
 EXCLUDE USING gist (daterange(starts_on,ends_on,'[]') WITH &&),
 changed_by uuid NOT NULL REFERENCES users,changed_at timestamptz NOT NULL DEFAULT now(),reason text NOT NULL DEFAULT ''
);
CREATE TABLE gl_journals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),journal_date date NOT NULL,memo text NOT NULL,
 currency text NOT NULL DEFAULT 'PHP' CHECK(currency='PHP'),status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted')),
 period_id uuid REFERENCES gl_periods,created_by uuid NOT NULL REFERENCES users,created_at timestamptz NOT NULL DEFAULT now(),
 posted_by uuid REFERENCES users,posted_at timestamptz,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 source_type text,source_id text,UNIQUE(source_type,source_id),CHECK((source_type IS NULL)=(source_id IS NULL)),
 reverses_id uuid UNIQUE REFERENCES gl_journals DEFERRABLE INITIALLY DEFERRED,
 CHECK(reverses_id IS DISTINCT FROM id),CHECK(status='draft' OR (period_id IS NOT NULL AND posted_by IS NOT NULL AND posted_at IS NOT NULL))
);
CREATE INDEX gl_journal_history ON gl_journals(journal_date DESC,id);
CREATE TABLE gl_journal_lines(
 journal_id uuid NOT NULL REFERENCES gl_journals,line_no integer NOT NULL CHECK(line_no>0),account_id uuid NOT NULL REFERENCES gl_accounts,
 description text NOT NULL DEFAULT '',debit numeric(16,2) NOT NULL DEFAULT 0,credit numeric(16,2) NOT NULL DEFAULT 0,
 CHECK((debit>0 AND credit=0) OR (credit>0 AND debit=0)),PRIMARY KEY(journal_id,line_no)
);
CREATE INDEX gl_line_account ON gl_journal_lines(account_id,journal_id);
CREATE FUNCTION gl_guard_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; state text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.journal_id<>OLD.journal_id THEN RAISE EXCEPTION 'Journal lines cannot be moved'; END IF;
 target:=CASE WHEN TG_OP='DELETE' THEN OLD.journal_id ELSE NEW.journal_id END;
 SELECT status INTO state FROM gl_journals WHERE id=target FOR UPDATE;
 IF state='posted' THEN RAISE EXCEPTION 'Posted journal lines are immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER gl_line_guard BEFORE INSERT OR UPDATE OR DELETE ON gl_journal_lines FOR EACH ROW EXECUTE FUNCTION gl_guard_line();
CREATE FUNCTION gl_guard_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n int; dr numeric; cr numeric; p gl_periods;
BEGIN
 IF TG_OP<>'INSERT' AND OLD.status='posted' THEN RAISE EXCEPTION 'Posted journals are immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.status='posted' THEN
  SELECT * INTO p FROM gl_periods WHERE id=NEW.period_id FOR SHARE;
  IF p.id IS NULL OR p.status<>'open' OR NEW.journal_date NOT BETWEEN p.starts_on AND p.ends_on THEN RAISE EXCEPTION 'Journal requires an open matching period' USING ERRCODE='23514'; END IF;
  SELECT count(*),sum(debit),sum(credit) INTO n,dr,cr FROM gl_journal_lines WHERE journal_id=NEW.id;
  IF n<2 OR dr IS NULL OR dr<=0 OR dr<>cr THEN RAISE EXCEPTION 'Journal must contain balanced positive debits and credits' USING ERRCODE='23514'; END IF;
  PERFORM a.id FROM gl_accounts a JOIN gl_journal_lines l ON l.account_id=a.id WHERE l.journal_id=NEW.id ORDER BY a.id FOR SHARE OF a;
  IF EXISTS(SELECT 1 FROM gl_journal_lines l JOIN gl_accounts a ON a.id=l.account_id WHERE l.journal_id=NEW.id AND NOT a.active) THEN RAISE EXCEPTION 'Journal account is inactive' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER gl_journal_guard BEFORE INSERT OR UPDATE OR DELETE ON gl_journals FOR EACH ROW EXECUTE FUNCTION gl_guard_journal();
CREATE FUNCTION gl_guard_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.code<>OLD.code OR NEW.type<>OLD.type) AND EXISTS(SELECT 1 FROM gl_journal_lines l JOIN gl_journals j ON j.id=l.journal_id WHERE l.account_id=OLD.id AND j.status='posted') THEN RAISE EXCEPTION 'Posted account code and classification cannot change'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER gl_account_guard BEFORE UPDATE ON gl_accounts FOR EACH ROW EXECUTE FUNCTION gl_guard_account();
CREATE FUNCTION gl_guard_period_dates() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.starts_on<>OLD.starts_on OR NEW.ends_on<>OLD.ends_on) AND EXISTS(SELECT 1 FROM gl_journals WHERE period_id=OLD.id AND status='posted') THEN RAISE EXCEPTION 'Posted period dates cannot change'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER gl_period_guard BEFORE UPDATE ON gl_periods FOR EACH ROW EXECUTE FUNCTION gl_guard_period_dates();
