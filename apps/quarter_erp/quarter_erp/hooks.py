app_name = "quarter_erp"
app_title = "Orbit Workspace"
app_publisher = "CLONE ORACLE project"
app_description = "Company operations workspace"
app_email = "development@example.invalid"
app_license = "GPL-3.0-or-later"
app_home = "/orbit"
required_apps = ["erpnext"]
doctype_js = {"Sales Order": "public/sales_order_credit.js"}
web_include_css = ["/assets/quarter_erp/branding/footer.css?v=20261006"]
after_install = "quarter_erp.bir_setup.ensure_bir_role"
after_migrate = "quarter_erp.bir_setup.ensure_bir_role"
