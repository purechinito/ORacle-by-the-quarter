#!/bin/bash
# Run in an authorized Cloud Shell session after reviewing cost and permissions.
set -euo pipefail
erp_project=superq-erp
erp_region=asia-southeast1
erp_zone=asia-southeast1-b
erp_bucket=superq-erp-backups-308964708234
erp_identity=superq-backup@superq-erp.iam.gserviceaccount.com
erp_source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

gcloud services enable compute.googleapis.com iam.googleapis.com storage.googleapis.com iap.googleapis.com --project="$erp_project"
if ! gcloud compute networks describe superq-erp --project="$erp_project" >/dev/null 2>&1; then
  gcloud compute networks create superq-erp --subnet-mode=custom --project="$erp_project"
fi
if ! gcloud compute networks subnets describe superq-erp --region="$erp_region" --project="$erp_project" >/dev/null 2>&1; then
  gcloud compute networks subnets create superq-erp --network=superq-erp --range=10.42.0.0/24 --region="$erp_region" --project="$erp_project"
fi
if ! gcloud compute firewall-rules describe superq-erp-web --project="$erp_project" >/dev/null 2>&1; then
  gcloud compute firewall-rules create superq-erp-web --network=superq-erp --allow=tcp:80,tcp:443 --source-ranges=0.0.0.0/0 --target-tags=superq-erp-web --project="$erp_project"
fi
if ! gcloud compute firewall-rules describe superq-erp-iap-ssh --project="$erp_project" >/dev/null 2>&1; then
  gcloud compute firewall-rules create superq-erp-iap-ssh --network=superq-erp --allow=tcp:22 --source-ranges=35.235.240.0/20 --target-tags=superq-erp-ssh --project="$erp_project"
fi
if ! gcloud iam service-accounts describe "$erp_identity" --project="$erp_project" >/dev/null 2>&1; then
  gcloud iam service-accounts create superq-backup --display-name='Super Q ERP backup uploader' --project="$erp_project"
fi
if ! gcloud storage buckets describe "gs://$erp_bucket" --project="$erp_project" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$erp_bucket" --location="$erp_region" --uniform-bucket-level-access --public-access-prevention --project="$erp_project"
fi
gcloud storage buckets add-iam-policy-binding "gs://$erp_bucket" --member="serviceAccount:$erp_identity" --role=roles/storage.objectCreator --project="$erp_project"
gcloud storage buckets update "gs://$erp_bucket" --lifecycle-file="$erp_source_dir/backup-lifecycle.json" --project="$erp_project"
if ! gcloud compute addresses describe superq-erp --region="$erp_region" --project="$erp_project" >/dev/null 2>&1; then
  gcloud compute addresses create superq-erp --network-tier=STANDARD --region="$erp_region" --project="$erp_project"
fi
erp_ip=$(gcloud compute addresses describe superq-erp --region="$erp_region" --project="$erp_project" --format='value(address)')
if ! gcloud compute instances describe superq-erp --zone="$erp_zone" --project="$erp_project" >/dev/null 2>&1; then
  gcloud compute instances create superq-erp --zone="$erp_zone" --machine-type=e2-medium \
    --subnet=superq-erp --network-tier=STANDARD --address="$erp_ip" --image-family=debian-12 --image-project=debian-cloud \
    --boot-disk-size=40GB --boot-disk-type=pd-balanced --no-boot-disk-auto-delete \
    --deletion-protection --shielded-secure-boot --shielded-vtpm --shielded-integrity-monitoring \
    --service-account="$erp_identity" --scopes=cloud-platform --tags=superq-erp-web,superq-erp-ssh \
    --labels=application=erp,environment=production --metadata-from-file=startup-script="$erp_source_dir/bootstrap-vm.sh" \
    --project="$erp_project"
fi
printf 'ERP DNS A record: erp.superq.ph -> %s\n' "$erp_ip"
printf 'Private backups: gs://%s\n' "$erp_bucket"
