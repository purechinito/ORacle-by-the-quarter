# Quarter — Philippine Auto Supply ERP

Original auto-parts shop software for the Philippines, using Philippine pesos (PHP) only and Asia/Manila business time. No Oracle code, assets, credentials or account data are included. This is an initial implementation for review and a supervised pilot, not a certified accounting or tax system.

## Run locally

Requires Node.js 22.12 or newer on a platform supported by embedded-postgres.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The first run creates a local PostgreSQL database and a random manager login in `.data/dev-credentials.json` (owner username). That file and the database are ignored by Git. Never publish them. The password is not a shared default. Development binds to loopback.

The preview starts with **60 synthetic demo parts** and explicitly labeled opening stock. PHP and Philippine time are fixed. VAT treatment and rate must be confirmed under Settings before testing sales. Do not use the demo database for real trading.

## What works

- Individual staff logins; manager, counter and stock roles enforced on the server.
- Server-paginated part search, barcode/OEM aliases, vehicle fitment filters, verified substitute links, part maintenance and catalog CSV import with validation.
- Separate preview-first opening-stock CSV import; manager adjustments and immutable stock movements.
- Suppliers, editable purchase drafts, submitted orders, partial receipts, recorded cancellation reasons and over-receipt protection.
- Saved sales carts, customers, manager price overrides with a reason, cash/external-payment records, decimal totals, printable receipts showing tender/change, and linked restockable/damaged returns with external-refund tracking.
- Shop settings, role-scoped operational reports, a Philippine-today dashboard with matching report drilldown, stock export, searchable activity log, paginated history and safe retry protection for postings. Carts and uncertain attempts survive navigation and reload in the same tab.
- Customer and supplier directories with complete server search, Philippine addresses, protected identifiers, account history, inactive controls and stale-edit protection.
- Audited staff role/active changes, password resets and session revocation with manager lockout protection.
- Manager-only manual PHP ledger: chart of accounts, date-only periods, balanced immutable journals, linked reversals, period closing/reopening and trial-balance drilldowns. Operational documents are not yet automatically posted.
- Backup snapshots and restore into an empty database, with stock and journal validation.

See [Philippine setup](docs/PHILIPPINES.md). Start with [the shop walkthrough](docs/SHOP-WALKTHROUGH.md) and the sample [catalog CSV](examples/parts-template.csv) and [opening stock CSV](examples/opening-stock-template.csv). Replace the sample rows with approved business data.

See [full ERP coverage](docs/FULL-ERP-COVERAGE.md), [permissions](docs/PERMISSIONS.md), [manual finance scope](docs/FINANCE.md), [pilot limitations](docs/COVERAGE.md), [runbook](docs/RUNBOOK.md), [pilot checklist](docs/PILOT.md), the [approved design](docs/superpowers/specs/2026-09-28-auto-supply-erp-design.md) and [implementation plan](docs/superpowers/plans/2026-09-28-auto-supply-erp.md).

## Verify

```sh
npm test
npm run typecheck
npm run build
```

Tests start isolated PostgreSQL clusters and cover real API/database behavior, 5,000 synthetic parts, stock races, duplicate submissions and restore. They require permission to start local processes and allocate PostgreSQL shared memory.

The current automated suite has 74 passing checks; type checking and production build also pass. These include currency boundaries, complete party search, staff access changes, journal posting/reversal, close/post concurrency and financial restore. The foundation source review found four issues; all were corrected, with regression evidence for duplicate CSV headers, reversal integrity during restore, retained recovery details and period error messages. Browser behavior remains unverified.

Browser tests are provided but were not executed in the authoring environment because a saved browser permission blocked local preview access. To run them yourself with the local preview running, set `ERP_TEST_USERNAME` and `ERP_TEST_PASSWORD`, then run `npm run test:e2e` after installing the Playwright Chromium browser. Use a disposable demo database.

## Empty database / deployment preparation

Supply `DATABASE_URL` securely. Run `npm run db:migrate`, then `npm run bootstrap` to create the first manager interactively without echoing its password. `npm run build && npm start` serves the built UI and API on port 3001. Use `NODE_ENV=production` behind HTTPS; cookies then require HTTPS. Keep the database private. Do not expose the development server.

`compose.yaml` supplies an optional PostgreSQL service; it requires `POSTGRES_PASSWORD`. The application does not load `.env` automatically: export environment variables or use your deployment platform's secret settings.

Operational backups: `npm run backup -- /secure/path/quarter.json`. Restore with a separate `RESTORE_DATABASE_URL` and `npm run restore -- /secure/path/quarter.json`. Snapshots include private business data and password hashes; protect and encrypt them at rest. Production hosting, retention, monitoring and recovery ownership must be configured before live operation.
