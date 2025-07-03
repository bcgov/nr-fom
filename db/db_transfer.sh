#!/bin/bash
#
# Database Transfer Script for OpenShift
# Usage:
#   ./db_transfer.sh <old-deployment-name> <new-deployment-name>
#
# This script takes a PostgreSQL database dump from the OLD_DEPLOYMENT and restores it into the NEW_DEPLOYMENT.
# Requirements:
# - Both deployments must have running pods managed by the given deployment names.
# - The database template should use a PersistentVolumeClaim with a different name for the new deployment.
# - The new deployment should be ready to accept a restore.
# - The script assumes the container name is the default or the first in the pod spec.
#
# Notes:
# - If the target database is not empty, you may see errors like "schema ... already exists".
#   These are expected if objects already exist and can usually be ignored, but always review
#   the output for unexpected or critical errors.

# Strict mode: exit on error, unset vars, or failed pipes
set -euo pipefail

# Usage
if [[ $# -lt 2 ]]; then
  grep -v '^#!' "$0" | awk '/^#/ { sub(/^# ?/, ""); print; next } NF==0 { exit }'
  exit 1
fi

OLD_DEPLOYMENT="${1}"
NEW_DEPLOYMENT="${2}"
DUMP_PARAMETERS="${DUMP_PARAMETERS:---exclude-schema=tiger --exclude-schema=tiger_data --exclude-schema=topology}"

# Fail fast if pods aren't found
if ! oc get po -l deployment="${OLD_DEPLOYMENT}" | grep -q .; then
  echo "No pods found for deployment '${OLD_DEPLOYMENT}'."
  exit 2
fi
if ! oc get po -l deployment="${NEW_DEPLOYMENT}" | grep -q .; then
  echo "No pods found for deployment '${NEW_DEPLOYMENT}'."
  exit 2
fi

# Safety check: compare PVC ages to prevent accidental reverse transfers
OLD_PVC=$(oc get deployment "${OLD_DEPLOYMENT}" -o jsonpath='{.spec.template.spec.volumes[?(@.persistentVolumeClaim)].persistentVolumeClaim.claimName}')
NEW_PVC=$(oc get deployment "${NEW_DEPLOYMENT}" -o jsonpath='{.spec.template.spec.volumes[?(@.persistentVolumeClaim)].persistentVolumeClaim.claimName}')

if [[ -n "${OLD_PVC}" && -n "${NEW_PVC}" ]]; then
  OLD_PVC_CREATION_TIME=$(oc get pvc "${OLD_PVC}" -o jsonpath='{.metadata.creationTimestamp}')
  NEW_PVC_CREATION_TIME=$(oc get pvc "${NEW_PVC}" -o jsonpath='{.metadata.creationTimestamp}')
  OLD_PVC_EPOCH=$(date -d "${OLD_PVC_CREATION_TIME}" +%s)
  NEW_PVC_EPOCH=$(date -d "${NEW_PVC_CREATION_TIME}" +%s)

  if [[ ${OLD_PVC_EPOCH} -gt ${NEW_PVC_EPOCH} ]]; then
    echo "WARNING: Source PVC '${OLD_PVC}' ($(date -d "${OLD_PVC_CREATION_TIME}" '+%Y-%m-%d %H:%M')) is NEWER than target PVC '${NEW_PVC}' ($(date -d "${NEW_PVC_CREATION_TIME}" '+%Y-%m-%d %H:%M'))."
    echo "This may be a reverse transfer that could overwrite newer data with older data."
    echo -n "Are you sure you want to continue? (yes/no): "
    read -r CONFIRM
    if [[ "${CONFIRM}" != "yes" ]]; then
      echo "Transfer cancelled by user."
      exit 2
    fi
  else
    echo "Safety check passed: Source PVC is older than target PVC."
  fi
else
  echo "Warning: Could not find PVCs for comparison. Proceeding without age check."
fi

# Stream dump directly from old deployment to new deployment
echo -e "\nDatabase transfer from '${OLD_DEPLOYMENT}' to '${NEW_DEPLOYMENT}' beginning."
oc exec -i deployment/"${OLD_DEPLOYMENT}" -- bash -c "pg_dump -U \${POSTGRES_USER} -d \${POSTGRES_DB} -Fc ${DUMP_PARAMETERS[@]}" \
  | oc exec -i deployment/"${NEW_DEPLOYMENT}" -- bash -c "pg_restore -U \${POSTGRES_USER} -d \${POSTGRES_DB} -Fc"

# Results
echo -e "\nDatabase transfer from '${OLD_DEPLOYMENT}' to '${NEW_DEPLOYMENT}' complete."
