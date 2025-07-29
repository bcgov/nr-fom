#!/bin/bash
#
# Usage:
#   ./rename_deployment.sh <source-deployment-name> [target-deployment-name]
#
# If [target-deployment-name] is not provided, defaults to <source-deployment-name>-prev
#
# This script renames an OpenShift deployment by exporting its manifest, updating the name,
# deleting the old deployment, and applying the new one.

# Strict mode: exit on error, unset vars, or failed pipes
set -euo pipefail

# Show usage from header if not enough arguments
if [[ $# -lt 1 ]]; then
  grep -v '^#!' "${0}" | awk '/^#/ { sub(/^# ?/, ""); print; next } NF==0 { exit }'
  exit 1
fi

SOURCE_DEPLOYMENT="${1}"
TARGET_DEPLOYMENT="${2:-${SOURCE_DEPLOYMENT}-prev}"
MANIFEST=$(mktemp "/tmp/${SOURCE_DEPLOYMENT}_$(date +%Y%m%d)_XXXXXX.json")
trap 'rm -f "${MANIFEST}"' EXIT

# Fail fast if the new deployment already exists
if oc get deployment "${TARGET_DEPLOYMENT}" &>/dev/null; then
  echo "Deployment '${TARGET_DEPLOYMENT}' already exists. Aborting to avoid overwrite."
  exit 2
fi

# Check if the old deployment exists
if ! oc get deployment "${SOURCE_DEPLOYMENT}" &>/dev/null; then
  echo "Deployment '${SOURCE_DEPLOYMENT}' not found."
  exit 0
fi

# Export, clean, and update deployment manifest
oc get deployment "${SOURCE_DEPLOYMENT}" -o json \
  | jq 'del(
      .metadata.uid,
      .metadata.resourceVersion,
      .metadata.selfLink,
      .metadata.creationTimestamp,
      .metadata.generation,
      .metadata.managedFields,
      .status
    )
    | .metadata.name = "'"${TARGET_DEPLOYMENT}"'"
    | .spec.selector.matchLabels.deployment = "'"${TARGET_DEPLOYMENT}"'"
    | .spec.template.metadata.labels.deployment = "'"${TARGET_DEPLOYMENT}"'"' \
  > "${MANIFEST}"

# Delete the old deployment and apply the new one
oc delete deployment "${SOURCE_DEPLOYMENT}"
oc apply -f "${MANIFEST}"

# Wait for the new deployment to become available
echo "Waiting for deployment '${TARGET_DEPLOYMENT}' to become available..."
if ! oc rollout status deployment/"${TARGET_DEPLOYMENT}" --timeout=120s; then
  echo "Error: Deployment '${TARGET_DEPLOYMENT}' did not become available in time."
  exit 3
fi

# Show matching deployments for confirmation
echo -e "\nMatching deployments after renaming:"
oc get deployments -o name | grep -iE "^deployment\.apps/(${SOURCE_DEPLOYMENT}|${TARGET_DEPLOYMENT})$"
