# Super Q ERP hosting

The authorized destination is `erp.superq.ph` in the user's Google Cloud account.
The dedicated project is `superq-erp` (308964708234). Staff invitations are deferred
until the user provides real emails and roles.

1. Preserve a database, public-file, private-file, and configuration backup.
2. Build the locked frontend and custom app into a production image. Keep the
   development proxy modifications out of production.
3. Verify restoration in a separate stack, including item, order-intake, user,
   role, company and private-file fingerprints. Leave the local ERP untouched.
4. Configure a regular Singapore VM: e2-medium shared CPU, 4 GiB RAM, 40 GiB balanced disk,
   deletion protection, a reserved IP, and SSH through IAP. Use HTTPS for staff;
   the database and Redis have no published ports.
5. Use a private Cloud Storage bucket for daily backups. Grant the VM's backup
   identity object-creation access only; use lifecycle retention on the bucket.
6. Review the concrete cost and any Google terms/access prompts before actions
   that require confirmation. Prepare all reversible work first.
7. Take a fresh cutover backup, restore it on the VM, add only the ERP DNS A
   record, verify HTTPS, login, private-file protection, realtime and workers.
8. Designate the cloud site as the staff entry point. Keep the local copy as a
   recovery reference and avoid entering new records in both sites.

This is a single-server deployment with off-server recovery, not high
availability. BIR review features retain their preparation-only status; hosting
does not certify invoices, register books, or complete pending orders.

Budget approved on 2026-10-06: PHP 3,000/month. The earlier USD 100 proposal was replaced. Use Standard network tier and a regular VM; no annual commitment or Spot interruption. Estimate includes a tax/FX/usage allowance. Billing alerts do not cap charges.
