# Supervised pilot

Before real use, complete the blocked browser checks and resolve relevant limitations in COVERAGE.md.

- Verify PHP formatting and Philippine midnight boundaries. Confirm inclusive/exclusive/no-VAT treatment, VAT rate and local receipt requirements.
- Verify fitment data ownership and accuracy. Never assume an OEM alias proves compatibility.
- Import representative parts including similar part numbers, multiple barcodes, inactive SKUs and missing optional fields.
- Receive a purchase order in two deliveries. Reconcile stock and reject an extra receipt.
- Have two staff attempt to sell the last unit. Exactly one should post; the other cart should remain actionable.
- Check barcode input, keyboard navigation, screen-reader labels, mobile/narrow screens, printing and network-error recovery.
- Record a partial return and a damaged return; reconcile sellable stock and externally recorded refunds.
- Test each role through direct URLs as well as buttons. Counter staff must not create users or adjust inventory; stock clerks must not see purchase costs.
- Restart the application and restore a backup to a separate database. Verify counts, ledger sums, posted sales and payments.
- Select hosting, backup retention and responsible operators. No live-data cutover is authorized by a successful development test alone.
