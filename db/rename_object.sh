#!/bin/bash
#
# Usage:
#   ./oc_rename.sh <resource-type> <source-object-name> [target-object-name]
#
# If [target-object-name] is not provided, defaults to <source-object-name>-prev
#
# This script renames an OpenShift object by exporting its manifest, updating the name,
# deleting the old object, and applying the new one.

# Strict mode: exit on error, unset vars, or failed pipes
set -euo pipefail

# Show usage from header if not enough arguments
if [[ $# -lt 1 ]]; then
  grep -v '^#!' "${0}" | awk '/^#/ { sub(/^# ?/, ""); print; next } NF==0 { exit }'
  exit 1
fi

OBJECT_TYPE="${1}"
OBJECT_SOURCE="${2}"
OBJECT_TARGET="${3:-${OBJECT_SOURCE}-prev}"
MANIFEST=$(mktemp "/tmp/${OBJECT_SOURCE}_$(date +%Y%m%d)_XXXXXX.json")
trap 'rm -f "${MANIFEST}"' EXIT

# Fail fast if the new object already exists
if oc get "${OBJECT_TYPE}" "${OBJECT_TARGET}" &>/dev/null; then
  echo "${OBJECT_TYPE^} '${OBJECT_TARGET}' already exists. Aborting to avoid overwrite."
  exit 2
fi

# Check if the old object exists
if ! oc get "${OBJECT_TYPE}" "${OBJECT_SOURCE}" &>/dev/null; then
  echo "${OBJECT_TYPE^} '${OBJECT_SOURCE}' not found."
  exit 0
fi

# Export, clean, and update object manifest
oc get "${OBJECT_TYPE}" "${OBJECT_SOURCE}" -o json \
  | jq 'del(
      .metadata.uid,
      .metadata.resourceVersion,
      .metadata.selfLink,
      .metadata.creationTimestamp,
      .metadata.generation,
      .metadata.managedFields,
      .status
    )
    | .metadata.name = "'"${OBJECT_TARGET}"'"
    | .spec.selector.matchLabels.deployment = "'"${OBJECT_TARGET}"'"
    | .spec.template.metadata.labels.deployment = "'"${OBJECT_TARGET}"'"' \
  > "${MANIFEST}"

# Delete the old object and apply the new one
oc delete "${OBJECT_TYPE}" "${OBJECT_SOURCE}"
oc apply -f "${MANIFEST}"

# Wait for the new object to become available
if [[ "${OBJECT_TYPE}" == "deployment" ]]; then
  echo "Waiting for ${OBJECT_TYPE^} '${OBJECT_TARGET}' to become available..."
  if ! oc rollout status "${OBJECT_TYPE}"/"${OBJECT_TARGET}" --timeout=120s; then
    echo "Error: ${OBJECT_TYPE^} '${OBJECT_TARGET}' did not become available in time."
    exit 3
  fi
fi

# Show matching objects for confirmation
echo -e "\nMatching objects after renaming:"
oc get "${OBJECT_TYPE}" -o name | grep -iE "^${OBJECT_TYPE}\.apps/(${OBJECT_SOURCE}|${OBJECT_TARGET})$"
