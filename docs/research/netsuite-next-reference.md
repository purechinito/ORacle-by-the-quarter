# NetSuite Next reference and implementation requirements

Research date: 2026-09-29. Primary sources only. NetSuite Next is the requested interaction and product reference; this does not reduce the requirement to reproduce the confirmed training account's complete functionality, identities, and 83 role definitions. This document describes public product behavior, not proof of account configuration or implemented parity.

## Verified product behavior

| Area | Public documentation evidence | Implementation consequence |
| --- | --- | --- |
| Same underlying account | Next and classic NetSuite share data, customizations, and workflows; role access controls whether switching is available. [Switching to Next](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_7175720305.html) | The replacement needs one authoritative transactional model across its modern interface and full ERP screens. Oracle's no-migration switch does not describe migration into our independent application. |
| Identity and navigation | The profile menu switches roles and companies and exposes preferences, help, support, and sign-out. With multiple roles it sits at the lower left, expanded after login to show account and role, then collapses to the avatar during navigation. Single-role users access it through the menu. Appearance colors distinguish environments. [Roles and companies](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_1093332827.html) | Implement actual active-role isolation and explicit company context before presenting a source-compatible role switcher. A cosmetic selector over combined permissions is insufficient. |
| Interface availability | Next rollout is phased. Administrators manage eligible roles individually or in bulk with Next-only, optional, or no-access settings. The listing includes assigned-user count, bundle ID, custom/standard status, and center. Advanced Partner, Customer, Employee, Partner, and Vendor centers are excluded from this Next eligibility list. [Access by role](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/T_article_6105821113_1.html) | Audit eligibility separately from role permissions. Excluded centers remain in the clone's full functional scope; they must not disappear merely because Next excludes them. |
| Assistant access | Ask Oracle access is separately controlled by administrators per role and defaults to disabled. The administration list carries role and assignment metadata. [Ask Oracle role access](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/T_article_4103202860_1.html) | Assistant capability requires an explicit entitlement in addition to ordinary record/action authorization. |
| Record/list compatibility | Oracle acknowledges some Next lists/records lack classic options and documents switching view modes; the switch control is limited to saved-search list views created by the user. [List and record modes](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_3190034196.html) | Preserve advanced fields and workflows throughout modern UI development. A full ERP link is a temporary access path, not evidence of final NetSuite parity. |
| Visual direction | Oracle's localized product page identifies Redwood and redesigned lists/forms, advanced search, intelligent filters, infinite scrolling, and clearer reports. It also describes collaborative AI canvases for analyses, narratives, plans, and visualizations. [Official Portuguese product page](https://www.netsuite.com/portal/br/products/netsuite-next.shtml) | Use these as design requirements to verify against current rendered screens, not a pixel specification. Do not infer exact spacing, theme tokens, or enabled canvas behavior from marketing prose. |

## Ask Oracle workflows

The documented basic flow is launch Ask Oracle, enter a prompt, submit, review, and refine. The help page locates its launcher in the top-right login portlet. Categorized starter questions populate an editable prompt. Responses can be refined into tables, charts, or shorter summaries. New chat resets topic/context and is recommended when current source data is needed. [Ask Oracle](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_5100902387.html)

The expanded interaction contract includes up to five attached context items, record/report/search context, skills or agents, and document uploads gated by permissions. Effort choices are Auto, Low, Medium, High, and Maximum. Multi-part requests can expose separate jobs and combined results. History lasts 90 days; reopening behavior varies at 15- and 60-minute boundaries. Explanations expose sources/processing context. Protected actions pause with a proposal for approval; decline, expiry, or leaving the session prevents execution. Responses use user language preferences and signed-in context; ambiguous interpretation can be disclosed. [More Ask Oracle features](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_0527021536.html)

Agents may start through an @ mention, contextual page controls, or automatic capability selection. They can hand the user to an appropriate record or workflow page. Availability depends on permissions, enabled features, SuiteApps, and context; an AI response does not replace an authoritative record or approval workflow. [Agents overview](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_9160038841.html)

Ask Oracle is not documented as a ChatGPT front end. Oracle says it does not browse the public internet and needs no separate ChatGPT or Claude license. The NetSuite AI Connector Service works alongside it for external AI tools. Source-linked answers and existing permissions are explicit trust requirements. [NetSuite Next FAQ](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_7130219835.html)

Our implementation requirements, inferred from these behaviors: use permission-filtered retrieval, structured business commands, source links, clear pending/error states, persisted conversations, action previews and approval tokens, and a real configured AI provider. Do not simulate successful AI with canned answers or claim an Oracle/ChatGPT connection that has not been configured and tested. Dates, balances, totals, and workflow outcomes must come from authoritative business operations.

## Official visual and video reference index

These are reference links, not claims that every frame has been inspected or the content matches the training account.

Visual follow-up: rendered the official multi-role profile PNG in Chrome and captured `docs/verification/2026-09-29-next-official-profile.jpg`. The image visibly contains identity, current account/role, company switching with a QA marker, all roles/companies, preferences, help, exit Next, feedback and sign-out. It is an Oracle documentation example, not this user's training-account configuration.

| Reference | Retrieval status and use |
| --- | --- |
| [Multi-role profile image](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/img/NetSuiteBasics/UserMenuIconMoreRoles_next.png) | Direct image linked by Oracle's current role-switching help; web tool resolved the image endpoint. Useful for a subsequent visual inspection of profile/account placement. No local screenshot was captured in this research pass. |
| [Single-role/profile image](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/img/NetSuiteBasics/UserMenuIconOneRole_next.png) | Companion official image endpoint resolved; inspect alongside the multi-role image rather than inferring behavior from filename alone. |
| [NetSuite Next: AI Built Into Your ERP](https://www.youtube.com/watch?v=6JFxJEPy-6g) | Video directly linked by Oracle's [current product page](https://www.netsuite.com/artificial-intelligence.shtml). YouTube text extraction contained no transcript; playback and frame capture remain pending. |
| [AI Canvases demo](https://community.oracle.com/netsuite/english/discussion/4512093/netsuite-next-ai-canvases-demo) | Listed by an Oracle author in its official community. The article rendered a component error through the web tool, so actual demonstration content remains unverified. |
| [Collaborate with Agents demo](https://community.oracle.com/netsuite/english/discussion/4512092/netsuite-next-collaborate-with-agents-demo) | Same official provenance and current extraction limitation. |
| [Next Essential Workflows](https://mylearn.oracle.com/netsuite/story/process-workflows) | Linked from the official FAQ; extraction returned no content. Browser availability/login requirements still need checking. |
| [Next data sheet](https://www.netsuite.com/portal/collateral/public/ds-netsuite-next.pdf) | Linked from the official FAQ; web retrieval returned 403. Not treated as inspected evidence. |
| [Current Next product overview](https://www.netsuite.com/artificial-intelligence.shtml) | Contains accounting, close, multi-entity, analytics, customer, and inventory preview images. Individual accounting/analytics image fetches failed in the web tool. Use the rendered public page for later reference capture. |

The current public [NetSuite home page](https://www.netsuite.com/portal/home.shtml) advertises a three-day Next test drive. The product CTA redirected through a form route to the home page during this research. No new account was created, no form was submitted, and no private account restriction was bypassed. A public trial would not contain this user's role customizations or records.

## Evidence gaps and next verification

The existing [account audit](account-audit.md) records 83 role definitions (50 custom, 33 standard), 55 employee records, and one distinct visible identity with five role assignments. Its discovery findings and [role checklist](role-audit-checklist.csv) remain the source-specific baseline. Older statements there about implementation not starting are historical; current implementation status belongs in the implementation ledger. Public Next documentation cannot fill the uninspected 18 detail layers for each role, actual feature eligibility, custom field/workflow rules, user populations, or source-data migration.

The switching help mentions “Navigating NetSuite Next,” but its public extracted text did not expose a working link to that topic, and the current public Next table of contents omits it. Consequently, the complete menu architecture, default home composition, browser history behavior, keyboard navigation, list editing, and actual form layouts remain to be observed directly. Do not turn this missing evidence into invented screenshot fidelity.

Next concrete verification targets:

1. Render the official profile images and product video; capture dated reference frames with source/time and distinguish demonstrated versus currently documented behavior.
2. When authorized browser access actually succeeds, check Next eligibility and each role's center/assistant settings without changing source settings; continue every pending source-role detail layer.
3. Exercise a full manual transaction workflow and an assistant-assisted equivalent, including rejected actions, stale drafts, partial fulfillment/receipt, invoice/payment, linked documents, and accounting impact.
4. Verify identical permissions across navigation, direct record URLs, searches, assistant context, exports, and commands, including company/role changes and revoked access.
5. Measure usability and performance on representative company data and reconcile authoritative outcomes. “Ten times easier” requires a baseline and task measurements; visual polish or a small green test suite alone cannot prove it.
