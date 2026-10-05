// Read-only credit context beside the native order actions. Normal ERP submit,
// workflow, credit-controller permissions and accounting remain authoritative.
frappe.ui.form.on("Sales Order", {
  refresh(frm) { orbit_customer_credit(frm); },
  customer(frm) { orbit_customer_credit(frm); },
  company(frm) { orbit_customer_credit(frm); },
});

async function orbit_customer_credit(frm) {
  frm.__orbit_credit_abort?.abort();
  frm.__orbit_credit_banner?.remove();
  // Native dashboard sections live under Connections in this ERP version.
  // Use the supported headline area so the review stays beside Submit on every tab.
  frm.__orbit_credit_banner = frm.dashboard.set_headline_alert('<div class="orbit-credit-body"></div>', "white", true);
  const body = frm.__orbit_credit_banner.find(".orbit-credit-body");
  const name = frm.doc.name, company = frm.doc.company;
  if (frm.is_new() || frm.is_dirty() || !frm.doc.customer || !company) {
    body.text(__("Save the order to review the customer's unpaid invoices and credit position."));
    return;
  }
  body.text(__("Checking customer invoices, payments and existing orders…"));
  const abort = new AbortController();
  frm.__orbit_credit_abort = abort;
  const timeout = setTimeout(() => abort.abort(), 15000);
  try {
    const response = await fetch("/api/method/quarter_erp.credit.review?" + new URLSearchParams({name, company}),
      {credentials:"same-origin", cache:"no-store", signal:abort.signal});
    if (!response.ok) throw new Error(response.status === 403
      ? "Complete customer accounting access is needed. Ask the authorized reviewer to open this order."
      : "The credit position could not load. Refresh and review the accounting reports before approval.");
    const {message: data} = await response.json();
    if (frm.doc.name !== name || frm.doc.company !== company || frm.__orbit_credit_abort !== abort) return;
    if (frm.is_dirty()) {
      body.text(__("Save your changes and refresh the credit review before approval."));
      return;
    }
    const esc = value => frappe.utils.escape_html(String(value ?? ""));
    const money = value => value === null ? __("Not configured")
      : new Intl.NumberFormat("en-PH", {style:"currency", currency:data.currency}).format(value);
    const url = "/orbit?" + new URLSearchParams({section:"sales", company, record:name});
    const metrics = [["Unpaid invoices", data.unpaid_invoices], ["Overdue portion", data.overdue],
      ["Available credits", data.available_credits], ["Credit limit", data.credit_limit],
      ["Including this order", data.projected_exposure]];
    body.html(`<strong>${esc(__("Customer credit · before approval"))}</strong><div style="display:flex;gap:24px;flex-wrap:wrap;padding:8px 0 16px">${metrics.map(([label, value]) =>
      `<div><small class="text-muted">${esc(__(label))}</small><div style="font-size:20px;font-weight:600">${esc(money(value))}</div></div>`).join("")}</div>
      ${data.warnings.length ? `<div class="alert alert-warning" style="margin-bottom:12px">${data.warnings.map(warning => `<div>${esc(__(warning))}</div>`).join("")}</div>` : ""}
      <a class="btn btn-default btn-sm" href="${esc(url)}">${esc(__("Review unpaid invoices & credit details"))} →</a>
      <button type="button" class="btn btn-default btn-sm orbit-refresh-credit" style="margin-left:8px">${esc(__("Refresh credit"))}</button>
      <p class="text-muted small" style="margin:12px 0 0">${esc(company)} · ${esc(data.currency)} · ${esc(__("Based on the saved order"))} · ${esc(data.checked_at)}.<br>${esc(__("Prepare → Review → Approve. This summary does not override the ERP's approval or credit controls."))}</p>`);
    body.find(".orbit-refresh-credit").on("click", () => orbit_customer_credit(frm));
  } catch (error) {
    if (frm.__orbit_credit_abort !== abort) return;
    body.empty();
    $("<p>").text(error.name === "AbortError" ? __("Credit check timed out. Refresh before approval.") : __(error.message)).appendTo(body);
    $("<button type='button' class='btn btn-default btn-sm'>").text(__("Retry credit check")).on("click", () => orbit_customer_credit(frm)).appendTo(body);
  } finally { clearTimeout(timeout); }
}
