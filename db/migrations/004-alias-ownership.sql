-- Exact aliases have one owner. Punctuation-normalized matches remain separate candidates.
CREATE TABLE part_alias_owners(alias_key text PRIMARY KEY,part_id uuid NOT NULL REFERENCES parts);
INSERT INTO part_alias_owners SELECT lower(btrim(a.value)),p.id FROM parts p CROSS JOIN LATERAL jsonb_array_elements_text(p.aliases) a;
CREATE FUNCTION sync_part_alias_owners() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM part_alias_owners WHERE part_id=NEW.id;
  INSERT INTO part_alias_owners(alias_key,part_id) SELECT lower(btrim(value)),NEW.id FROM jsonb_array_elements_text(NEW.aliases);
  RETURN NEW;
END $$;
CREATE TRIGGER sync_part_aliases AFTER INSERT OR UPDATE OF aliases ON parts FOR EACH ROW EXECUTE FUNCTION sync_part_alias_owners();
