import unittest

from quarter_erp.migration_core import MAX_BYTES, MAX_ROWS, MigrationError, profile_csv, validate_csv


class MigrationCore(unittest.TestCase):
    mapping = {"source_id": "ID", "customer_name": "Name", "customer_group": "Group", "territory": "Territory"}
    content = 'ID,Name,Group,Territory\n0000123,"Acme, Cebu",Commercial,Philippines\n'

    def test_csv_keeps_ids_unicode_and_quoted_newlines(self):
        content = '\ufeffID,Name,Group,Territory\r\n0000123,"Niño,\nCebu",Commercial,Philippines\r\n'
        p = profile_csv(content, "customers")
        self.assertEqual(p["row_count"], 1)
        self.assertEqual(p["sample"][0][0], "0000123")
        r = validate_csv(content, "customers", self.mapping)
        self.assertEqual(r["rows"][0]["values"]["customer_name"], "Niño,\nCebu")
        self.assertEqual(r["valid_count"], 1)

    def test_rejects_ambiguous_and_malformed_csv(self):
        for content in ['ID,id\n1,2', 'ID,\n1,2', 'ID,Name\n1,2,3', 'ID,Name\n"unfinished,2', 'ID,Name\n1', 'ID,Name\n1,\x00']:
            with self.subTest(content=content), self.assertRaises(MigrationError):
                profile_csv(content, "customers")

    def test_limits_and_empty_file(self):
        for content in ['', 'ID,Name\n', 'a'*(MAX_BYTES+1), 'ID\n' + '1\n'*(MAX_ROWS+1), 'ID\n'+'x'*4097]:
            with self.assertRaises(MigrationError):
                profile_csv(content, "customers")

    def test_missing_or_unknown_mappings_fail(self):
        for mapping in [{}, {**self.mapping, "customer_name":"No such column"}, {**self.mapping,"invented":"Name"}, {**self.mapping,"tax_id":"ID"}]:
            with self.assertRaises(MigrationError):
                validate_csv(self.content, "customers", mapping)

    def test_missing_values_and_every_duplicate_row_are_flagged(self):
        r = validate_csv('ID,Name,Group,Territory\n001,A,G,T\n001,B,G,T\n003,B,G,T\n004,,G,T', "customers", self.mapping)
        self.assertEqual(r["invalid_count"], 4)
        self.assertEqual({i["row"] for i in r["issues"] if i["code"] == "duplicate_source_id"}, {2,3})
        self.assertEqual({i["row"] for i in r["issues"] if i["code"] == "duplicate_target"}, {3,4})

    def test_unmapped_columns_and_formula_text_are_not_silently_changed(self):
        content = 'ID,Name,Group,Territory,Secret\n001,=HYPERLINK("test"),G,T,extra'
        r = validate_csv(content, "customers", self.mapping)
        self.assertEqual(r["unmapped_columns"], ["Secret"])
        self.assertEqual(r["rows"][0]["values"]["customer_name"], '=HYPERLINK("test")')

    def test_fingerprint_includes_mapping_type_and_content(self):
        a = validate_csv(self.content, "customers", self.mapping)["fingerprint"]
        self.assertEqual(a, validate_csv(self.content, "customers", dict(reversed(list(self.mapping.items()))))["fingerprint"])
        self.assertNotEqual(a, validate_csv(self.content+'002,B,G,T\n', "customers", self.mapping)["fingerprint"])
        self.assertNotEqual(a, validate_csv(self.content, "customers", {**self.mapping,"customer_name":"Group","customer_group":"Name"})["fingerprint"])

    def test_item_boolean_is_strict_and_defaults_are_explicit(self):
        mapping = {"source_id":"ID","item_code":"Code","item_name":"Name","item_group":"Group","stock_uom":"Unit","is_stock_item":"Stock"}
        r = validate_csv('ID,Code,Name,Group,Unit,Stock\n01,PART1,Part,G,Nos,yes\n02,PART2,Part,G,Nos,maybe', 'items', mapping)
        self.assertEqual(r["rows"][0]["values"]["is_stock_item"], '1')
        self.assertEqual(r["invalid_count"], 1)
        r = validate_csv(self.content, 'customers', self.mapping)
        self.assertEqual(r["rows"][0]["values"]["customer_type"], 'Company')

    def test_report_cap_does_not_hide_invalid_count(self):
        r = validate_csv('ID,Name,Group,Territory\n'+'001,A,G,T\n'*300, 'customers', self.mapping)
        self.assertEqual(r['invalid_count'], 300)
        self.assertLessEqual(len(r['issues']), 200)
        self.assertGreater(r['issue_count'], len(r['issues']))


if __name__ == '__main__':
    unittest.main()
