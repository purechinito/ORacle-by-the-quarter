# CLONE ORACLE

A separate ERP project intended to reproduce the confirmed NetSuite training account's business behavior, using NetSuite Next as the primary interface and workflow reference.

**Current state: ERPNext 16.36.1 / Frappe 16.35.0 is running locally with a synthetic demo company, verified sales and purchasing journeys, and a React workspace with line-item details and linked transactions for sales, purchasing, receivables and payables. Full NetSuite account parity and redesigned transaction editing are still in progress.**

The Sales workspace now creates real sales-order drafts with permission-filtered customer/item/warehouse choices, native validation and ERP-calculated totals. An interrupted save retains its command in the current tab's session for an identical retry. Advanced fields, existing-order editing and submission still use the full ERP. See [draft verification](docs/draft-command-verification.md) for limitations and evidence.

The [Migration studio](http://127.0.0.1:8080/orbit?view=migration) now previews customer, supplier and item CSV exports. System managers can map columns, find duplicates and unavailable references, and download a review report. Preview creates no ERP records; actual import, reconciliation and migration receipts remain pending. See [migration verification](docs/migration-preview-verification.md).

The [BIR review workspace](http://127.0.0.1:8080/orbit?view=bir) brings together a taxpayer profile, unresolved Philippine requirements, four native accounting reports, invoice evidence counts and a downloadable review pack. A dedicated reviewer role has no accounting write rights. The US/USD demo remains a demo: taxpayer setup, registration evidence, tax/invoice validation and production acceptance are still required. See the [review guide](docs/bir-review-guide.md) and [official-source requirements](docs/research/2026-09-30-bir-readiness.md).

## Run locally

Open **http://127.0.0.1:8080/orbit** for the company workspace. Full ERP records and remaining modules are available at **http://127.0.0.1:8080/desk** under the same login.

```sh
scripts/erp start       # starts/reuses the project's local VM and persistent services
scripts/setup-demo      # idempotent synthetic sales and purchasing journeys
scripts/build-workspace # builds/installs the custom app and React UI (Node 22.12+ required)
scripts/test-engine     # real HTTP and database-backed integration checks
scripts/erp status
scripts/erp backup      # copies database, configuration and files to .runtime/backups
scripts/erp stop        # stops services/VM; preserves volumes and records
```

Local account: `Administrator`. The generated password is in the protected `.runtime/engine.env` file under `ERP_ADMIN_PASSWORD`; it is not committed. No employee or role from NetSuite has been activated in this local system.

This local setup uses an isolated Apple Silicon Linux VM (4 CPUs, 4 GiB RAM, 12 GiB virtual disk), no host directory mounts, and loopback port 8080. Pinned images and runtime checksums are in `infra/versions.json`. First-time setup requires network access to official distribution sources. The environment is for development and verification, not a company production rollout.

See [runtime verification](docs/runtime-verification.md) and the [implementation plan](docs/superpowers/plans/2026-09-29-running-erp-foundation.md).

The user confirmed that this is separate from Quarter ERP and that the target is the open **Inside the Suite | Products — TRAININGDEMO** account. The account UI reports NetSuite United States edition, release 2026.2.

- [Design proposal](docs/superpowers/specs/2026-09-28-netsuite-replica-design.md)
- [Captured screen references](docs/references/netsuite/README.md)
- [Account audit](docs/research/account-audit.md)
- [Functional parity matrix](docs/research/parity-matrix.csv)
- [NetSuite capabilities and AI research](docs/research/netsuite-capabilities.md)
- [NetSuite Next navigation, assistant and visual references](docs/research/netsuite-next-reference.md)
- [ERP usability research](docs/research/erp-ux-patterns.md)
- [Proposed workspace design](docs/design/workspace-concept.md)
- [Public NetSuite video screenshots](docs/references/public/README.md)
- [Public NetSuite video, documentation, and GitHub library](docs/research/public-netsuite-reference-library.md)
- [ERPNext source checkout and workflow mapping](docs/research/erpnext-source-map.md)
- [ERPNext versus Odoo foundation comparison](docs/research/open-source-foundation-comparison.md)

The screenshots and raw account observations are stored locally under `docs/references/netsuite/` and excluded from Git. They are reference evidence, not an exhaustive export or a completed migration. Research and design documents distinguish observed behavior from proposals and unverified requirements.

The user has now authorized using public NetSuite videos/documentation and open-source GitHub projects to continue. This work can progress independently of private-account access. The official ERPNext `v16.36.0` source has been cloned locally into `.reference-code/erpnext` for inspection, preserving its GPLv3 license. This checkout is excluded from the parent Git repository.

Inspection of **every layer of all 83 role definitions** remains in scope. Their detailed grants and account-specific behavior remain unverified while private-account access is blocked; public references do not fill those gaps. No role settings or account transactions were changed.
