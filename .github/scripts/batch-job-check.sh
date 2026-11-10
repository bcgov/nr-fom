#!/usr/bin/env bash
# Checks that an OpenShift CronJob's batch is healthy: its latest Job did not
# fail and its last success is at most MAX_AGE_HOURS old. Needs a logged-in `oc`.
#
# A CronJob with no success yet passes while it is younger than MAX_AGE_HOURS
# (a new environment whose first scheduled run is still ahead) and fails after.
#
# Usage: batch-job-check.sh <cronjob-name>
# BATCH_CHECK_NOW (ISO 8601) replaces the current time; tests use it.
set -euo pipefail

MAX_AGE_HOURS=26

if [ $# -ne 1 ] || [ -z "$1" ]; then
  echo "::error::Usage: $0 <cronjob-name>"
  exit 2
fi
cronjob="$1"

epoch() { date -u -d "$1" +%s; }
age() { local s=$(( now - $(epoch "$1") )); echo "$(( s / 3600 ))h$(( s % 3600 / 60 ))m"; }
now="$(epoch "${BATCH_CHECK_NOW:-now}")"
max_age=$(( MAX_AGE_HOURS * 3600 ))

if ! cronjob_json="$(oc get cronjob "${cronjob}" -o json)"; then
  echo "::error::CronJob ${cronjob} not found"
  exit 1
fi
jobs_json="$(oc get jobs -o json)"

created="$(jq -r '.metadata.creationTimestamp' <<< "${cronjob_json}")"
last_success="$(jq -r '.status.lastSuccessfulTime // empty' <<< "${cronjob_json}")"

# Latest Job this CronJob created: name, state (failed, succeeded or running) and failure reason
latest="$(jq -r --arg cronjob "${cronjob}" '
  [.items[] | select(any(.metadata.ownerReferences[]?; .kind == "CronJob" and .name == $cronjob))]
  | sort_by(.metadata.creationTimestamp) | last // empty
  | (first(.status.conditions[]? | select(.type == "Failed" and .status == "True")) // null) as $failed
  | [ .metadata.name,
      (if $failed then "failed"
       elif any(.status.conditions[]?; .type == "Complete" and .status == "True") then "succeeded"
       else "running" end),
      ($failed.reason // "") ]
  | @tsv' <<< "${jobs_json}")"
IFS=$'\t' read -r latest_name latest_state latest_reason <<< "${latest:-}"

echo "CronJob ${cronjob}: created ${created}, last success ${last_success:-never}, latest Job ${latest_name:-none} (${latest_state:-none})"

if [ "${latest_state:-}" = "failed" ]; then
  echo "::error::Latest ${cronjob} Job ${latest_name} failed (${latest_reason:-no reason given}); last success ${last_success:-never}"
  exit 1
fi

if [ -n "${last_success}" ]; then
  if (( now - $(epoch "${last_success}") > max_age )); then
    echo "::error::${cronjob} last succeeded ${last_success}, $(age "${last_success}") ago (limit ${MAX_AGE_HOURS}h)"
    exit 1
  fi
  echo "${cronjob} last succeeded ${last_success}, $(age "${last_success}") ago"
  exit 0
fi

if (( now - $(epoch "${created}") > max_age )); then
  echo "::error::${cronjob} has no successful run, and it was created ${created}, $(age "${created}") ago (limit ${MAX_AGE_HOURS}h)"
  exit 1
fi
echo "::notice::${cronjob} was created ${created} and has not succeeded yet; its first scheduled run is still within ${MAX_AGE_HOURS}h."
