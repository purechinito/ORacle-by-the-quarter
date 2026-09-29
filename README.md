# CLONE ORACLE

A separate ERP project intended to reproduce the confirmed NetSuite training account's business behavior with an improved interface.

**Current state: ERPNext 16.36.1 / Frappe 16.35.0 is running locally with a synthetic demo company and a verified partial sales → delivery → invoice → payment journey. The redesigned frontend and full NetSuite account parity are still in progress.**

## Run locally

Open **http://127.0.0.1:8080/desk**. The currently available interface is native ERPNext.

```sh
scripts/erp start       # starts/reuses the project's local VM and persistent services
scripts/setup-demo      # idempotent synthetic company and sales journey
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
- [ERP usability research](docs/research/erp-ux-patterns.md)
- [Proposed workspace design](docs/design/workspace-concept.md)
- [Public NetSuite video screenshots](docs/references/public/README.md)
- [Public NetSuite video, documentation, and GitHub library](docs/research/public-netsuite-reference-library.md)
- [ERPNext source checkout and workflow mapping](docs/research/erpnext-source-map.md)
- [ERPNext versus Odoo foundation comparison](docs/research/open-source-foundation-comparison.md)

The screenshots and raw account observations are stored locally under `docs/references/netsuite/` and excluded from Git. They are reference evidence, not an exhaustive export or a completed migration. Research and design documents distinguish observed behavior from proposals and unverified requirements.

The user has now authorized using public NetSuite videos/documentation and open-source GitHub projects to continue. This work can progress independently of private-account access. The official ERPNext `v16.36.0` source has been cloned locally into `.reference-code/erpnext` for inspection, preserving its GPLv3 license. This checkout is excluded from the parent Git repository.

Inspection of **every layer of all 83 role definitions** remains in scope. Their detailed grants and account-specific behavior remain unverified while private-account access is blocked; public references do not fill those gaps. No role settings or account transactions were changed.
