-- Deferred checks inspect the complete transaction, including snapshot restore
-- whose journal rows may arrive in any order. No bypass is exposed to the API.
CREATE FUNCTION gl_validate_reversal(target uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE reversal gl_journals; original gl_journals;
BEGIN
 SELECT * INTO reversal FROM gl_journals WHERE id=target;
 IF reversal.id IS NULL OR reversal.reverses_id IS NULL THEN RETURN; END IF;
 SELECT * INTO original FROM gl_journals WHERE id=reversal.reverses_id;
 IF original.id IS NULL OR original.status<>'posted' OR original.reverses_id IS NOT NULL OR reversal.status<>'posted' THEN
  RAISE EXCEPTION 'A reversal must be posted and target an original posted journal' USING ERRCODE='23514';
 END IF;
 IF reversal.journal_date<original.journal_date THEN
  RAISE EXCEPTION 'Reversal date cannot precede the original journal' USING ERRCODE='23514';
 END IF;
 IF EXISTS(
  SELECT 1 FROM
   (SELECT account_id,sum(debit) debit,sum(credit) credit FROM gl_journal_lines WHERE journal_id=reversal.id GROUP BY account_id) r
   FULL JOIN
   (SELECT account_id,sum(debit) debit,sum(credit) credit FROM gl_journal_lines WHERE journal_id=original.id GROUP BY account_id) o
   USING(account_id)
  WHERE r.debit IS DISTINCT FROM o.credit OR r.credit IS DISTINCT FROM o.debit
 ) THEN
  RAISE EXCEPTION 'Reversal must exactly swap the original account amounts' USING ERRCODE='23514';
 END IF;
END $$;
CREATE FUNCTION gl_guard_reversal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM gl_validate_reversal(NEW.id);
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER gl_reversal_guard AFTER INSERT OR UPDATE ON gl_journals
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION gl_guard_reversal();
DO $$ DECLARE j record; BEGIN
 FOR j IN SELECT id FROM gl_journals WHERE reverses_id IS NOT NULL LOOP
  PERFORM gl_validate_reversal(j.id);
 END LOOP;
END $$;
