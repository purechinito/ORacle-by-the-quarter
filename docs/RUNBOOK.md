# Operations runbook

1. Use a fresh production database. Never promote the demo seed to production.
2. Inject DATABASE_URL via the host's secret store, keep PostgreSQL private, and run migrations once during release. Run the interactive bootstrap for the first manager.
3. Configure HTTPS, NODE_ENV=production, service restart policy, application/database monitoring, disk alerts and a shared rate limiter if running multiple instances.
4. Confirm currency, timezone, tax treatment and receipt wording. Create individual staff accounts with the least required role.
5. Import catalog CSV first. Required columns: sku,name,price. Optional: brand,category,bin,reorder,aliases. Separate aliases with |. Preview errors must be resolved before committing.
6. Import opening-stock CSV separately: sku,qty. Quantities are positive integers; each part can have opening stock once. Reconcile physical count to the ledger before trading.
7. Back up independently of app uptime. Use managed database backups and scheduled app snapshots as a portable supplement. Protect backups because they include password hashes and business data.
8. Restore drills: create a separate empty database, run matching migrations, supply RESTORE_DATABASE_URL, then run the restore command. It refuses an occupied database, verifies stock reconciliation and invalidates sessions. Compare document counts and totals before switching traffic.
9. Correct operational errors with manager adjustments/linked returns, never by editing stock balances in SQL. Cancel outstanding PO quantities without erasing received quantities.
10. If a posting response is lost, retry with the same idempotency key through the API. Check transaction history before creating a replacement transaction in the UI. Do not assume an error means the transaction did not commit.

The local preview uses .data/postgres and randomly generated development credentials. Stop it gracefully with Ctrl-C. Keep .data and all backup files outside source control.
