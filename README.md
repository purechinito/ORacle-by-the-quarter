# CLONE ORACLE

A separate ERP project intended to reproduce the confirmed NetSuite training account's business behavior with an improved interface.

**Current state: account and public-source research, design, and a pinned local ERPNext source checkout for evaluation. No application has been implemented or deployed.**

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
