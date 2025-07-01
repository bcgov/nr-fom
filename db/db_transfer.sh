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
#   the output for unexpected or

# Strict mode with verbose output
set -euxo pipefail

# Usage
if [[ $# -lt 2 ]]; then
  grep -v '^#!' "$0" | awk '/^#/ { sub(/^# ?/, ""); print; next } NF==0 { exit }'
  exit 1
fi

# Vars
OLD_DEPLOYMENT=${1}
NEW_DEPLOYMENT=${2}

# Verify pods before proceeding
if ! oc get po -l deployment=${OLD_DEPLOYMENT} | grep -q '^'; then
  echo "No pods found for deployment '${OLD_DEPLOYMENT}'."
  exit 2
fi
if ! oc get po -l deployment=${NEW_DEPLOYMENT} | grep -q '^'; then
  echo "No pods found for deployment '${NEW_DEPLOYMENT}'."
  exit 2
fi

# Stream dump directly from old deployment to new deployment (no file copy needed)
echo "Database transfer from '${OLD_DEPLOYMENT}' to '${NEW_DEPLOYMENT}' complete."
oc exec -i deployment/${OLD_DEPLOYMENT} -- bash -c "pg_dump -U \${POSTGRES_USER} -d \${POSTGRES_DB} -Fc" \
  | oc exec -i deployment/${NEW_DEPLOYMENT} -- bash -c "pg_restore -U \${POSTGRES_USER} -d \${POSTGRES_DB} -Fc"

# Results
echo -e "\nDatabase transfer from '${OLD_DEPLOYMENT}' to '${NEW_DEPLOYMENT}' complete."
echo "Note: If you saw errors like 'schema ... already exists', these are expected if the target DB is not empty."
