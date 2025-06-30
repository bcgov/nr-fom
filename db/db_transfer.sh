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
DUMP_FILE_PATH=/tmp/backup.dump

# Create dump from the old deployment and save locally
oc exec -i deployment/${OLD_DEPLOYMENT} -- bash -c "pg_dump -U \${POSTGRES_USER} -d \${POSTGRES_DB} -Fc" > ${DUMP_FILE_PATH}
ls -lh ${DUMP_FILE_PATH}

# Stream dump into pg_restore in the new deployment (no file copy needed)
oc exec -i deployment/${NEW_DEPLOYMENT} -- bash -c "pg_restore -U \${POSTGRES_USER} -d \${POSTGRES_DB} -Fc" < ${DUMP_FILE_PATH}
