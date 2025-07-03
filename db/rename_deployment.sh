#!/bin/bash
#
# Usage:
#   ./rename_deployment.sh <old-deployment-name> [new-deployment-name]
#
# If [new-deployment-name] is not provided, defaults to <old-deployment-name>-prev
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

OLD_DEPLOYMENT="${1}"
NEW_DEPLOYMENT="${2:-${OLD_DEPLOYMENT}-prev}"
MANIFEST=$(mktemp "/tmp/${OLD_DEPLOYMENT}_$(date +%Y%m%d)_XXXXXX.json")
trap 'rm -f "${MANIFEST}"' EXIT

# Fail fast if the new deployment already exists
if oc get deployment "${NEW_DEPLOYMENT}" &>/dev/null; then
  echo "Deployment '${NEW_DEPLOYMENT}' already exists. Aborting to avoid overwrite."
  exit 2
fi

# Check if the old deployment exists
if ! oc get deployment "${OLD_DEPLOYMENT}" &>/dev/null; then
  echo "Deployment '${OLD_DEPLOYMENT}' not found."
  exit 0
fi

# Export, clean, and update deployment manifest
oc get deployment "${OLD_DEPLOYMENT}" -o json \
  | jq 'del(
      .metadata.uid,
      .metadata.resourceVersion,
      .metadata.selfLink,
      .metadata.creationTimestamp,
      .metadata.generation,
      .metadata.managedFields,
      .status
    )
    | .metadata.name = "'"${NEW_DEPLOYMENT}"'"
    | .spec.selector.matchLabels.deployment = "'"${NEW_DEPLOYMENT}"'"
    | .spec.template.metadata.labels.deployment = "'"${NEW_DEPLOYMENT}"'"' \
  > "${MANIFEST}"

# Delete the old deployment and apply the new one
oc delete deployment "${OLD_DEPLOYMENT}"
oc apply -f "${MANIFEST}"

# Clean up

# Wait for the new deployment to become available
echo "Waiting for deployment '${NEW_DEPLOYMENT}' to become available..."
if ! oc rollout status deployment/"${NEW_DEPLOYMENT}" --timeout=120s; then
  echo "Error: Deployment '${NEW_DEPLOYMENT}' did not become available in time."
  exit 3
fi

# Show matching deployments for confirmation
echo -e "\nMatching deployments after renaming:"
oc get deployments -o name | grep -iE "^deployment\.apps/(${OLD_DEPLOYMENT}|${NEW_DEPLOYMENT})$"
