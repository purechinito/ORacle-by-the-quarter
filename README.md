# Quarter — Auto Supply ERP

Original auto-parts shop software inspired by general ERP workflows. No Oracle code, assets, credentials or account data are included. This is an initial implementation for review and a supervised pilot, not a certified accounting or tax system.

## Run locally

Requires Node.js 22.12 or newer on a platform supported by embedded-postgres.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The first run creates a local PostgreSQL database and a random manager login in `.data/dev-credentials.json` (owner username). That file and the database are ignored by Git. Never publish them. The password is not a shared default. Development binds to loopback.

The preview starts with **60 synthetic demo parts** and explicitly labeled opening stock. It does not configure a real currency or tax treatment. Set these under Settings before testing sales. Do not use the demo database for real trading.

## What works

- Individual staff logins; manager, counter and stock roles enforced on the server.
- Server-paginated part search, barcode/OEM aliases, vehicle fitment filters, verified substitute links, part maintenance and catalog CSV import with validation.
- Separate preview-first opening-stock CSV import; manager adjustments and immutable stock movements.
- Suppliers, editable purchase drafts, submitted orders, partial receipts, recorded cancellation reasons and over-receipt protection.
- Saved sales carts, customers, manager price overrides with a reason, cash/external-payment records, decimal totals, printable receipts showing tender/change, and linked restockable/damaged returns with external-refund tracking.
- Shop settings, operational totals, stock export, searchable activity log, paginated history and safe retry protection for postings. Carts and uncertain attempts survive navigation and reload in the same tab.
- Backup snapshots and restore into an empty database, with stock reconciliation.

Start with [the shop walkthrough](docs/SHOP-WALKTHROUGH.md) and the sample [catalog CSV](examples/parts-template.csv) and [opening stock CSV](examples/opening-stock-template.csv). Replace the sample rows with approved business data.

See [coverage and limitations](docs/COVERAGE.md), [runbook](docs/RUNBOOK.md), [pilot checklist](docs/PILOT.md), the [approved design](docs/superpowers/specs/2026-09-28-auto-supply-erp-design.md) and [implementation plan](docs/superpowers/plans/2026-09-28-auto-supply-erp.md).

## Verify

```sh
npm test
npm run typecheck
npm run build
```

Tests start isolated PostgreSQL clusters and cover real API/database behavior, 5,000 synthetic parts, stock races, duplicate submissions and restore. They require permission to start local processes and allocate PostgreSQL shared memory.

The 32 automated checks pass locally; type checking and production build also pass. An independent source review found no remaining important issues in the revised pilot workflows.

Browser tests are provided but were not executed in the authoring environment because a saved browser permission blocked local preview access. To run them yourself with the local preview running, set `ERP_TEST_USERNAME` and `ERP_TEST_PASSWORD`, then run `npm run test:e2e` after installing the Playwright Chromium browser. Use a disposable demo database.

## Empty database / deployment preparation

Supply `DATABASE_URL` securely. Run `npm run db:migrate`, then `npm run bootstrap` to create the first manager interactively without echoing its password. `npm run build && npm start` serves the built UI and API on port 3001. Use `NODE_ENV=production` behind HTTPS; cookies then require HTTPS. Keep the database private. Do not expose the development server.

`compose.yaml` supplies an optional PostgreSQL service; it requires `POSTGRES_PASSWORD`. The application does not load `.env` automatically: export environment variables or use your deployment platform's secret settings.

Operational backups: `npm run backup -- /secure/path/quarter.json`. Restore with a separate `RESTORE_DATABASE_URL` and `npm run restore -- /secure/path/quarter.json`. Snapshots include private business data and password hashes; protect and encrypt them at rest. Production hosting, retention, monitoring and recovery ownership must be configured before live operation.
