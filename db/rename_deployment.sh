#!/bin/bash
#
# Usage:
#   ./rename_deployment.sh <old-deployment-name> [new-deployment-name]
#
# If [new-deployment-name] is not provided, defaults to <old-deployment-name>-prev

# Strict mode with verbose output
set -euo pipefail

# Usage
if [[ $# -lt 1 ]]; then
  grep -v '^#!' "$0" | awk '/^#/ { sub(/^# ?/, ""); print; next } NF==0 { exit }'
  exit 1
fi

# Vars
OLD_DEPLOYMENT=${1}
NEW_DEPLOYMENT=${2:-${OLD_DEPLOYMENT}-prev}
MANIFEST="/tmp/${OLD_DEPLOYMENT}_$(date +%Y%m%d).json"

# Check if the old deployment exists
if ! oc get deployment "${OLD_DEPLOYMENT}" &>/dev/null; then
  echo "Deployment '${OLD_DEPLOYMENT}' not found."
  exit 0
fi

# Export the existing deployment, pare down and update name (metadata, labels)
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

# Delete the old deployment
oc delete deployment "${OLD_DEPLOYMENT}"

# Apply the new deployment
oc apply -f "${MANIFEST}"

# Clean up the temporary manifest file
rm -f "${MANIFEST}"

# Output deployment names
echo -e "\nMatching deployments after renaming:"
oc get deployments -o name | grep -iE "^deployment\.apps/(${OLD_DEPLOYMENT}|${NEW_DEPLOYMENT})$"
