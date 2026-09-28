# Public NetSuite reference library

Research date: 2026-09-29. Scope: public Oracle/NetSuite videos, documentation, and official GitHub examples. No private NetSuite account was accessed during this research. These sources support process discovery; they do not establish parity with the training account, migrate users, or prove that an implementation works.

## Evidence levels

- **Transcript reviewed + sampled frames:** spoken content read, with identified screens visually inspected. This is not full-video viewing or a transaction test.
- **Documentation inspected:** procedural text read. An embedded or linked video may remain uninspected.
- **Description/index inspected:** publisher, title, URL, and available description confirmed. Behavior cannot be inferred from a title alone.
- **Candidate:** useful next review target, with its access limitation stated.

Oracle's [help-video index](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/preface_1511796659.html) identifies the [NetSuite User Assistance channel](https://videohub.oracle.com/channel/NetSuite%20User%20Assistance/158902301). Its [ERP index](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_161718122877.html), [SuiteCloud index](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_65114903717.html), and [Basics index](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_161703043885.html) were read to resolve specific video links below. Video Hub returned access errors in the research fetcher; those entries are discovery leads, not watched videos.

## Strongest inspected public demo

**[SuiteProcurement demo — NetSuite YouTube channel](https://www.youtube.com/watch?v=wtRY8TQB_FE)**, published 2024-11-26, runtime 3:35. Evidence: full auto-generated English transcript reviewed and three frames sampled by the coordinating agent. Captions contain recognition errors. No transactions were executed.

| Point | Evidence and useful requirement |
|---|---|
| 1:16–1:34, request | Narration describes supplier checkout returning item, tax, and shipping details to a purchase request, then saving for approval. [1:26 frame](../references/public/netsuite-suiteprocurement-01-request-1m26.jpg) supports form/line-item reference. |
| 1:50–2:23, approval | Role changes to purchasing manager; reminder leads to pending supervisor approval and approval action. [2:09 frame](../references/public/netsuite-suiteprocurement-02-approval-2m09.jpg) is the approval-screen reference. |
| 2:38–2:51, receiving/billing | [2:44 frame](../references/public/netsuite-suiteprocurement-03-receipt-2m44.jpg) shows PO3087 Approved/Pending Receipt and Generate Item Receipt. It does **not** establish a saved receipt. Automatic vendor-bill creation is narration at 2:47, not verified execution. |

This is indirect procurement with supplier punchout and role handoff. Payment, GL reconciliation, receipt discrepancies, and actual connector delivery are not verified. It must not be substituted for the account's classic PO/receipt/bill flow or its three-way-match workflow.

The transcript was exported to a temporary browser-use file and read in full; it is not reproduced here. The durable evidence consists of the source video URL, timestamps, and sampled images above.

## Official video and course references

| Area | Specific public source | Inspection, workflow mapping, and limitations |
|---|---|---|
| Order to cash | [Oracle University: Order to Cash](https://learn.oracle.com/ols/module/order-to-cash/85171/87225) | Public syllabus/search metadata identifies customer management, order management, fulfillment, invoices, and payments. Playback/transcript not obtained; page exposes a subscription prompt. This is a coverage map, not an unrestricted reviewed walkthrough. |
| Order orchestration | [What Is NetSuite Advanced Order Management?](https://www.youtube.com/watch?v=Lts_ypBUxx4) | NetSuite channel, 2020-08-10. Description inspected: inventory visibility and allocation/orchestration/execution rules. Video frames and transcript uninspected; no complete invoice/payment chain established. |
| Receiving | [WMS Mobile — Receiving Purchase Orders](https://videohub.oracle.com/media/ERPA+WMS+Mobile+Receiving+Purchase+Orders/1_3ga5q1k4?ed=15300) | Official ERP-index link/title inspected. Candidate for mobile receiving; screen sequence and successful posting remain uninspected. WMS is a separate scope decision. |
| AP capture/payment | [Uploading Vendor Bills Using Bill Capture](https://videohub.oracle.com/media/Uploading%20Vendor%20Bills%20Using%20Bill%20Capture/1_74ouhkn3) · [Run Your First Payment](https://videohub.oracle.com/media/IPA%3A+Run+Your+First+Payment/1_ohljkfql) | Official ERP-index links inspected. Candidates for Bill Capture and Intelligent Payment Automation, respectively. Neither establishes the ordinary manual bill-payment path or the training account's enabled products. |
| Inventory transfer | [WMS Mobile — Transfer Inventory](https://videohub.oracle.com/media/t/1_9b0kwd3s) · [embedded video and procedure](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_1541441894.html) | Procedure inspected; video not watched. Documents selecting source location/bin/item, quantity or serial/lot, destination, and confirmation. Creates an inventory transfer and adjusts quantities; shipment tracking is absent. Do not conflate this with transfer-order shipment/receipt. |
| Manufacturing | [Manufacturing Assembly Work Orders](https://videohub.oracle.com/media/ERPA+Manufacturing+Assembly+Work+Orders/1_okhvocgw) · [Set up and Create a Manufacturing Routing](https://videohub.oracle.com/media/ERPA+Set+up+and+Create+a+Manufacturing+Routing/1_mdxjmxpy) | Official index links/titles inspected. Candidates for work-order and routing screens; no build, issue, completion, costing, or variance transaction was observed. |
| Advanced Manufacturing | [Introducing Advanced Manufacturing](https://videohub.oracle.com/media/IntroducingAdvancedManufacturing/1_b8l9n6oq) · [official overview](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_1506368304.html) | Overview inspected; video fetch returned 403. Documents Work Bench, capacity/instructions, downtime/labor collection, and shop-floor integration. Requires the relevant SuiteApp; these are not universal assembly features. |
| SuiteFlow | [SuiteFlow Overview](https://videohub.oracle.com/media/SuiteFlow+Overview/1_m3nh3kb4) · [embedded video and text](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_4068260113.html) | Text inspected; embedded-video identity confirmed, playback uninspected. States/actions/transitions, conditions, event/schedule initiation, and execution logs are documented. The example is an estimate approval with supervisor/finance routing; it is not the private vendor-bill workflow. |
| Approval details | [Item Sublist Approval in SuiteFlow](https://videohub.oracle.com/media/SuiteCloudA+Item+Sublist+Approval+in+SuiteFlow/1_gv33gj1i?ed=333) · [Create Line Item in SuiteFlow](https://videohub.oracle.com/media/SuiteCloudA+Create+Line+Item+in+SuiteFlow/1_g1wgaai4?ed=319) | Official SuiteCloud-index links inspected. Candidates for line-level actions and approval layers; their rules and triggers still require playback/procedural review. |
| Role-sensitive access/audit | [Access Control for Custom Field Values](https://videohub.oracle.com/media/Access+Control+for+Custom+Field+Values/1_y56ckzzu) · [System Notes Overview](https://videohub.oracle.com/media/SystemNotesOverview+-+Video+1+of+4/1_qqs7yrxv) | Official index links inspected; videos uninspected. These cover narrower surfaces than a complete role definition. Permission levels, restrictions, subsidiary access, forms, integrations, and assigned users remain distinct discovery layers. |
| Ask Oracle introduction | [Introducing NetSuite Next — NetSuite](https://www.linkedin.com/posts/netsuite_introducing-netsuite-next-activity-7381456056562110465-9XGS) | Publisher transcript retrieved through search and reviewed; no frames inspected. Describes contextual natural-language navigation, role-sensitive results, workflows, and agents. Marketing introduction, not a demonstrated accounting control or ChatGPT connection. Current help below is more precise for availability. |

## Documentation that turns demos into testable flows

These are documented behaviors, not observations of the private account.

| Flow | Inspected authority | Design/test implications and unresolved branch coverage |
|---|---|---|
| Quote/order → fulfillment → invoice/cash sale → payment | [Sales Orders](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_N1215966.html) | Sales orders record commitments without posting. Separate document identity/status and fulfillment from billing; inspect partial/backordered shipments, deposits, cash sales, returns/credits, tax, and payment application before defining parity. The public official videos above do not yet verify the entire chain. |
| Requisition → PO approval → receipt → bill → payment | [Requisitions](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_162444983707.html), [Purchasing](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_N2399286.html), [purchase workflow approvals](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N2396564.html) | Separate requestor/buyer/approver/receiver/AP responsibilities. Requisitions can precede a known vendor/price; buyers consolidate requests. Approval settings and feature prerequisites matter. Receipt tolerances, matching rules, partial bills, credits, and payment execution need separate evidence. |
| BOM/routing → work order → operation tasks | [Manufacturing Routing and Work Orders](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N2346224.html) | Routing includes work centers and labor/machine time; saving the configured work order generates operation tasks. Quantity changes affect expected time. WIP, subsidiaries/locations, issue/completion, costing, and advanced scheduling need explicit scoped tests. |
| Role and schema discovery | [Standard Roles Permissions Table](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N295396.html), [Records Catalog Overview](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_159367781370.html) | Public standard-role defaults are a baseline only. Records Catalog reflects enabled features/customizations and its visibility requires permission. Public sources cannot reveal the account's 50 custom-role permission configurations or custom schema. |

## Ask Oracle and ChatGPT: current distinction

The [NetSuite Next FAQ](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_7130219835.html) was inspected on the research date. It says availability is phased, and eligible administrators can set up Ask Oracle in their **current NetSuite account** or request a Next preview. Therefore, “Ask Oracle exists only in the new UI” is too restrictive. The FAQ describes a native assistant operating within roles and permissions, with no separate ChatGPT/Claude license required, and says the AI Connector works alongside it. This does not prove eligibility or activation in the training account.

Oracle's [Connect to the NetSuite AI Connector Service](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_0714082142.html) explicitly documents a separate ChatGPT integration: Apps → NetSuite → Connect → sign in with the correct **non-administrator role**. Custom Tools require a new integration record for each new connection. The page also documents MCP execution logs. This is evidence of a supported external client connection, not evidence that native Ask Oracle is ChatGPT or that credentials/permissions have already been configured here.

The [AI Connector FAQ](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_4160616848.html) and [standard-tools documentation](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_0902023508.html) describe role/feature prerequisites and report, search, metadata, record, and SuiteQL tools. Tool availability does not establish an unrestricted ability to reproduce every UI transaction. No connection, OAuth consent, tool call, or AI-generated write was tested in this research.

## Official GitHub references

| Source | What was actually inspected | Appropriate use and limit |
|---|---|---|
| [oracle-samples/netsuite-suitecloud-samples](https://github.com/oracle-samples/netsuite-suitecloud-samples) | Repository README: independent SDF customization examples, SuiteScript, prerequisites, UPL license. | Source examples for extension patterns; this is not NetSuite's ERP source code or the private account's customizations. |
| [LLM prompt workflow action README](https://github.com/oracle-samples/netsuite-suitecloud-samples/blob/main/suitecloud-ai-solutions-catalog/llm-prompt-workflow-action/README.md) | README retrieved through public GitHub API/raw link. Describes a SuiteScript workflow action using `N/llm`, a configurable prompt, current-record context, and storing returned text through SuiteFlow. | Concrete official customization example. README reviewed, implementation not executed or fully code-audited. No need to assume an external ChatGPT API for this example. |
| [Oracle NetSuite AI connector instructions](https://github.com/oracle/netsuite-suitecloud-sdk/blob/master/packages/agent-skills/netsuite-ai-connector-instructions/SKILL.md) | Public file inspected as research material: report/search/record/SQL selection, metadata discovery, currency/subsidiary handling, and duplicate-write precautions. | Useful agent-behavior reference under UPL. Its embedded instructions were treated as source content, not executed. It supplies no account access and proves no migration. |

## Supplemental walkthrough and remaining gaps

For a complete, publicly readable narrated purchasing example, [SuperSync/SCS Cloud's Example of Procure to Pay Transaction](https://www.supersync.cloud/training-lessons/example-of-procure-to-pay-transaction) has a transcript that was read: enter/save a PO, receive/save, bill/save, then make/save a check payment. It explicitly skips an approval step. This is a **third-party demonstration**, not Oracle documentation; no frames were inspected. Its transcript is useful for sequencing, while official documentation governs claimed product rules. [SuperTraining's order-to-cash example](https://www.youtube.com/watch?v=oaQUDYnCjZQ) is another candidate; only metadata/chapter descriptions were inspected, not the underlying demonstration.

Next discovery work:

1. Review one complete order-to-cash video with linked records, partial fulfillment, invoice, payment application, and GL views; the current official source set does not establish all of those observations.
2. Review classic purchasing and compare its controls with the inspected SuiteProcurement demo. Add partial receipts, price/quantity mismatch, rejection/resubmission, vendor credit, and paid/unpaid states.
3. Inspect the linked WMS, work-order, and routing videos with timestamps. Confirm which modules are actually required before borrowing their screens or behavior.
4. Capture standard-role examples and map every private role's pending layers when authorized evidence becomes available. Public defaults cannot fill unknown custom permissions or migrate users.
5. Keep native Ask Oracle, external ChatGPT/MCP, and custom `N/llm` actions as separate integration options. Confirm account eligibility, installed tools, permissions, and expected write controls before implementation.
6. Validate any future implementation through transaction, ledger, permission, audit, concurrency, and recovery tests. Video resemblance and narrated automation cannot establish accounting correctness, performance, reliability, or full parity.
