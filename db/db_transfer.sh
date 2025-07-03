#!/bin/bash
#
# Database Transfer Script for OpenShift
# Usage:
#   ./db_transfer.sh <source-deployment-name> <target-deployment-name>
#
# This script takes a PostgreSQL database dump from the <source-deployment-name> and restores it into the <target-deployment-name>.
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

SOURCE_DEPLOYMENT="${1}"
TARGET_DEPLOYMENT="${2}"
DUMP_PARAMETERS="${DUMP_PARAMETERS:---exclude-schema=tiger --exclude-schema=tiger_data --exclude-schema=topology}"

# Fail fast if pods aren't found
if ! oc get po -l deployment="${SOURCE_DEPLOYMENT}" | grep -q .; then
  echo "No pods found for deployment '${SOURCE_DEPLOYMENT}'."
  exit 2
fi
if ! oc get po -l deployment="${TARGET_DEPLOYMENT}" | grep -q .; then
  echo "No pods found for deployment '${TARGET_DEPLOYMENT}'."
  exit 2
fi

# Safety check: compare PVC ages to prevent accidental reverse transfers
SOURCE_PVC=$(oc get deployment "${SOURCE_DEPLOYMENT}" -o jsonpath='{.spec.template.spec.volumes[?(@.persistentVolumeClaim)].persistentVolumeClaim.claimName}')
TARGET_PVC=$(oc get deployment "${TARGET_DEPLOYMENT}" -o jsonpath='{.spec.template.spec.volumes[?(@.persistentVolumeClaim)].persistentVolumeClaim.claimName}')

if [[ -n "${SOURCE_PVC}" && -n "${TARGET_PVC}" ]]; then
  SOURCE_PVC_CREATION_TIME=$(oc get pvc "${SOURCE_PVC}" -o jsonpath='{.metadata.creationTimestamp}')
  TARGET_PVC_CREATION_TIME=$(oc get pvc "${TARGET_PVC}" -o jsonpath='{.metadata.creationTimestamp}')
  SOURCE_PVC_EPOCH=$(date -d "${SOURCE_PVC_CREATION_TIME}" +%s)
  TARGET_PVC_EPOCH=$(date -d "${TARGET_PVC_CREATION_TIME}" +%s)

  if [[ ${SOURCE_PVC_EPOCH} -gt ${TARGET_PVC_EPOCH} ]]; then
    echo "WARNING: Source PVC '${SOURCE_PVC}' ($(date -d "${SOURCE_PVC_CREATION_TIME}" '+%Y-%m-%d %H:%M')) is NEWER than target PVC '${TARGET_PVC}' ($(date -d "${TARGET_PVC_CREATION_TIME}" '+%Y-%m-%d %H:%M'))."
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
echo -e "\nDatabase transfer from '${SOURCE_DEPLOYMENT}' to '${TARGET_DEPLOYMENT}' beginning."
oc exec -i deployment/"${SOURCE_DEPLOYMENT}" -- bash -c "pg_dump -U \${POSTGRES_USER} -d \${POSTGRES_DB} -Fc ${DUMP_PARAMETERS}" \
  | oc exec -i deployment/"${TARGET_DEPLOYMENT}" -- bash -c "pg_restore -U \${POSTGRES_USER} -d \${POSTGRES_DB} -Fc"

# Results
echo -e "\nDatabase transfer from '${SOURCE_DEPLOYMENT}' to '${TARGET_DEPLOYMENT}' complete."
