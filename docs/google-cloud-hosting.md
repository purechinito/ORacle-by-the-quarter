# Google Cloud hosting for erp.superq.ph

Status on 2026-10-06: deployed and public HTTPS verified at
[erp.superq.ph](https://erp.superq.ph/orbit). The dedicated Google Cloud project
is `superq-erp` (308964708234). The cloud restore exactly matches the fresh
cutover fingerprints across the 22 checked business/permission tables,
authentication records and all 14 private files. Existing Administrator login,
PHP workspace, guest access restrictions and authenticated realtime pass.
The private backup service completed successfully; its daily timer runs around
02:00 Asia/Manila. Staff account creation awaits the owner's emails and roles.

The user approved PHP 3,000/month, replacing the proposed USD 100 budget.
Project-only billing alerts are configured; this is a planning target, not a
hard cap. Use the cloud URL for new entries. The local copy is in maintenance
mode with its scheduler disabled and retained as a cutover recovery reference.

## Deployed resources

| Resource | Configuration |
|---|---|
| VM | Regular e2-medium, 1 sustained shared vCPU, 4 GiB, Singapore asia-southeast1-b |
| Disk | 40 GiB balanced persistent boot disk; no automatic deletion |
| Protection | VM deletion protection, Shielded VM, Debian 12 security updates |
| Network | Dedicated VPC, Standard network tier; public TCP 80/443, SSH through Google's IAP range |
| Application | Pinned ERPNext/Frappe, quarter_erp and built Orbit assets |
| Database and Redis | Private Docker network; no host ports |
| HTTPS | Caddy certificate issuance/renewal; HTTP redirects to HTTPS |
| Off-server backups | Private Singapore Cloud Storage bucket; 30-day lifecycle |
| Backup identity | Object Creator on that bucket only; no service-account keys |
| Staff | Existing users preserved; additional users wait for real emails/roles |

The revised Google calculator quote for VM and disk is USD 34.57/month at
730 hours. A used static IPv4 adds about USD 3.65/month. We allow USD 2/month
for light traffic and backup storage/operations: USD 40.22 before tax, or about
PHP 2,827 using PHP 62.748/USD and a conservative 12% VAT allowance. At PHP
65/USD the same allowance is PHP 2,928. The PHP 3,000 budget is a spending
planning limit; actual FX, bank fees, traffic and growing data can affect costs.
Google billing alerts do not impose a hard spending cap. No other projects are
included in this ERP budget. The VM is shared CPU and sized for the initial
small team; review response times and memory before adding many users.

Pricing evidence: [Google calculator](https://cloud.google.com/products/calculator/estimate-preview/CiQ5MzU3YzJiNi1mZDQwLTRjYWEtOThlZC0xNGFkNWY3NmUzODcQAQ%3D%3D),
[public IPv4 pricing](https://cloud.google.com/vpc/network-pricing),
[Google Philippine tax rules](https://docs.cloud.google.com/billing/docs/resources/vat-overview),
[BSP published USD rate, 2 October 2026](https://www.bsp.gov.ph/SitePages/Default.aspx).

This is one server with off-server recovery. A VM or zone outage can interrupt
service; this setup does not provide automatic failover or a multi-server SLA.

## Verification completed

The isolated test used the actual backup with a different database, site name,
Docker project and volumes. A fresh cutover backup was then restored on the
Google Cloud VM and checked before enabling public access.

- All 22 checked business/permission tables match after restore: 170 items,
  2 companies, 3 users, 43 notes (42 intake orders plus the batch review),
  1 pending Data Import and 14 private File records, among the checked tables.
- Password/authentication hashes and all 14 private-file contents match.
- Only volatile User activity timestamps are excluded from the comparison.
- Existing Administrator login succeeds; HTTPS forwarding creates Secure
  session cookies. The workspace shows PHP companies and the restored items.
- Anonymous company/workspace reads and private-photo downloads are denied.
- Authenticated realtime connects; unrelated and missing Origin evidence are
  rejected by the edge gateway. Internal session validation stays on Docker's
  private network, avoiding reliance on a public DNS/certificate round trip.
- Backend health check and worker startup pass. Database/public/private/config
  backup creation passes, and Caddy's production configuration validates. Public TLS certificate validation
  succeeds, and two simultaneous login-page reads completed in 0.37–0.44 seconds
  during the initial check; this is not a workload capacity test.

Evidence and backups remain private under `.runtime/gcp-deploy-2026-10-06/`.
They are excluded from Git. The production package contains source and assets;
database backups and credentials are transferred separately.

## Operator rollout

1. Run `scripts/package-production` to create a clean release archive.
2. Upload the authorized release through Cloud Shell. Extract the
   archive, then run `create-cloud-resources.sh` from its deployment directory.
3. Check the VM startup log and Docker installation. Transfer the release to
   `/opt/superq-erp` through IAP SSH and initialize/build/prepare with `erpctl`.
4. Announce a brief cutover pause. Put the local ERP into maintenance mode, take
   a fresh database/files/config backup, and record its data fingerprints.
5. Transfer only that matched backup set and its `sha256.json`. Run
   `erpctl restore <backup-directory>` on the newly created destination.
   The restore refuses to overwrite a site without its fresh-install marker.
6. Compare `erpctl check-data` to the cutover fingerprints. Add the `erp` A record
   in dotPH at the reserved IP, leaving other domain records unchanged.
7. Start the site. Verify public DNS, trusted HTTPS, login, denied guest access,
   realtime, private photos and workers. Keep the cloud site as the entry point
   for new records; do not enter records in both copies.
8. Install the supplied backup service/timer, run an immediate off-server
   backup, and verify it from the owner's account. Billing alerts are configured for superq-erp only: USD 41/month before tax,
   with actual-cost thresholds at 50/90/100% and a forecast warning at 90%.
   The amount reserves 12% tax at PHP 65/USD; it is not an enforced cap.
9. Add staff accounts when the owner provides emails, company assignments and
   roles. Staff use the website; they do not need a desktop ERP installation.

The order sources are still intake records. Selling prices, units, customer
mapping and per-line VAT treatment remain pending, with NGOSIOK MARKETING as
the provisional company. Hosting does not turn them into posted transactions
or certify the BIR preparation workspace.

## Backup operation and recovery

The uploader uses Google's objects-insert API and the attached VM identity.
It streams files with a create-only generation precondition, validates returned
size/MD5, and uploads the SHA-256 manifest last. It requires no bucket/object
read, list, or delete permission. The owner can download backups separately
and verify all four files against the manifest before restoring a fresh site.
The first successful backup is `daily/20261006T031305Z/`; its manifest is the
completion marker. The owner-account download of all four files passed SHA-256
verification against that manifest. Database, public files, private files and encryption config
must be kept as a matched set. Credentials are never committed to Git.

Operator checks through IAP SSH:

```sh
sudo /opt/superq-erp/erpctl status
sudo systemctl status superq-erp-backup.timer superq-erp-backup.service
sudo journalctl -u superq-erp-backup.service --no-pager -n 20
sudo /opt/superq-erp/erpctl backup --bucket gs://superq-erp-backups-308964708234
```

The bucket has a 30-day lifecycle for recovery snapshots. This does not define
legal accounting-record retention; originals and statutory records must remain
in the ERP and any approved archive. Host-side copied backup folders are not
automatically pruned; review their growth and disk space regularly. Daily
backups can lose up to approximately one day of entries after an outage.
Check failed backup service status and the most recent completion manifest.
The current deployment does not include automatic failover or outbound mail
configuration for staff invitations/password reset.

API references: [object insertion and create-only preconditions](https://docs.cloud.google.com/storage/docs/json_api/v1/objects/insert),
[VM workload authentication](https://docs.cloud.google.com/compute/docs/access/authenticate-workloads).
