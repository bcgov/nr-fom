#!/bin/bash
#
# Database Upgrade Script for OpenShift
# Requirements
# - Database template with a PersistentVolumeClaim with a different name from the existing one
# - Database template loading a newer version of the database image

# Strict mode with verbose output
set -euxo pipefail

# Function - clone/replace the current database with a new name
rename_deployment() {
  local old_deployment="$1"
  local new_deployment="$2"
  local manifest="/tmp/${old_deployment}_$(date +%Y%m%d).json"  # Save in /tmp

  # Check if the old deployment exists
  if ! oc get deployment "${old_deployment}" &>/dev/null; then
    echo "Deployment '${old_deployment}' does not exist. It must have already been renamed."
    return 0
  fi

  # Export the existing deployment to JSON, update name, and clean metadata
  oc get deployment "${old_deployment}" -o json \
    | jq 'del(
        .metadata.uid,
        .metadata.resourceVersion,
        .metadata.selfLink,
        .metadata.creationTimestamp,
        .metadata.generation,
        .metadata.managedFields,
        .status
      ) | .metadata.name = "'${new_deployment}'"' \
    > "${manifest}"

  # Delete the old deployment
  oc delete deployment "${old_deployment}"

  # Apply the new deployment
  oc apply -f "${manifest}"

  # Clean up the temporary manifest file
  rm -f "${manifest}"
}

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <deployment-name>"
  exit 1
fi

# Vars
NEW_DEPLOYMENT=${1}
OLD_DEPLOYMENT=${NEW_DEPLOYMENT}-prev
DUMP_FILE_PATH=/tmp/backup.dump

# Rename the deployment
rename_deployment "${NEW_DEPLOYMENT}" "${OLD_DEPLOYMENT}"

exit 0

# Create and copy dump from the previous deployment
OLD_POD=$(oc get po -l deployment=${OLD_DEPLOYMENT} -o name | head -n 1 | sed 's|pod/||')
oc exec -it deployment/${OLD_DEPLOYMENT} -- bash -c "pg_dump -U \${POSTGRES_USER} -d \${POSTGRES_DB} -Fc -f ${DUMP_FILE_PATH} && ls -lh ${DUMP_FILE_PATH}"
oc cp ${OLD_POD}:${DUMP_FILE_PATH} ${DUMP_FILE_PATH}
ls -lh ${DUMP_FILE_PATH}

# Delete the previous deployment (optional, uncomment if desired)
# oc delete deployment "${OLD_DEPLOYMENT}"

# Copy and restore dump to the new deployment
NEW_POD=$(oc get po -l deployment=${NEW_DEPLOYMENT} -o name | head -n 1 | sed 's|pod/||')
oc cp ${DUMP_FILE_PATH} ${NEW_POD}:${DUMP_FILE_PATH} -c fom
oc exec -it deployment/${NEW_DEPLOYMENT} -- bash -c "pg_restore -U \${POSTGRES_USER} -d \${POSTGRES_DB} -Fc ${DUMP_FILE_PATH}"
