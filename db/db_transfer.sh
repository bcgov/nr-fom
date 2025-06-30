#!/bin/bash
#
# Database Upgrade/Migration Script for OpenShift
# Usage:
#   ./dbUpgrade.sh <old-deployment-name> <new-deployment-name>
#
# This script takes a database dump from the OLD_DEPLOYMENT and restores it into the NEW_DEPLOYMENT.
# Requirements:
# - Both deployments must have running pods with the correct labels.
# - The database template should use a PersistentVolumeClaim with a different name for the new deployment.
# - The new deployment should be ready to accept a restore.

# Strict mode with verbose output
set -euxo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <old-deployment-name> <new-deployment-name>"
  exit 1
fi

# Vars
OLD_DEPLOYMENT=${1}
NEW_DEPLOYMENT=${2}
DUMP_FILE_PATH=/tmp/backup.dump

# Create and copy dump from the old deployment
OLD_POD=$(oc get po -l deployment=${OLD_DEPLOYMENT} -o name | head -n 1 | sed 's|pod/||')
oc exec -it deployment/${OLD_DEPLOYMENT} -- bash -c "pg_dump -U \${POSTGRES_USER} -d \${POSTGRES_DB} -Fc -f ${DUMP_FILE_PATH} && ls -lh ${DUMP_FILE_PATH}"
oc cp ${OLD_POD}:${DUMP_FILE_PATH} ${DUMP_FILE_PATH}
ls -lh ${DUMP_FILE_PATH}

# Copy and restore dump to the new deployment
NEW_POD=$(oc get po -l deployment=${NEW_DEPLOYMENT} -o name | head -n 1 | sed 's|pod/||')
oc cp ${DUMP_FILE_PATH} ${NEW_POD}:${DUMP_FILE_PATH} -c fom
oc exec -it deployment/${NEW_DEPLOYMENT} -- bash -c "pg_restore -U \${POSTGRES_USER} -d \${POSTGRES_DB} -Fc ${DUMP_FILE_PATH}"
