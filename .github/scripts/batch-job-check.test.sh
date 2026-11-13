#!/usr/bin/env bash
# Tests batch-job-check.sh against stubbed `oc` output.
# Usage: .github/scripts/batch-job-check.test.sh
set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/batch-job-check.sh"
CRONJOB=fom-test-work-flow-state-change-batch
NOW=2026-11-06T11:30:00Z
work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT

# Stub oc: serves $work/cronjob.json (absent means NotFound) and $work/jobs.json
mkdir -p "${work}/bin"
cat > "${work}/bin/oc" <<'STUB'
#!/usr/bin/env bash
case "$1 $2" in
  "get cronjob")
    if [ -f "${STUB_DIR}/cronjob.json" ]; then cat "${STUB_DIR}/cronjob.json"; else
      echo "Error from server (NotFound): cronjobs.batch \"$3\" not found" >&2; exit 1; fi ;;
  "get jobs") cat "${STUB_DIR}/jobs.json" ;;
  *) echo "unexpected oc call: $*" >&2; exit 99 ;;
esac
STUB
chmod +x "${work}/bin/oc"

# cronjob <created> [lastSuccessfulTime]
cronjob() {
  jq -n --arg name "${CRONJOB}" --arg created "$1" --arg last "${2:-}" \
    '{metadata: {name: $name, creationTimestamp: $created},
      status: (if $last == "" then {} else {lastSuccessfulTime: $last} end)}' > "${work}/cronjob.json"
}

# jobs <owner>|<created>|<Complete|Failed|running> ...
jobs() {
  local items="[]" owner created state
  for spec in "$@"; do
    IFS='|' read -r owner created state <<< "${spec}"
    items="$(jq --arg owner "${owner}" --arg created "${created}" --arg state "${state}" \
      '. + [{metadata: {name: ($owner + "-" + $created), creationTimestamp: $created,
                        ownerReferences: [{kind: "CronJob", name: $owner}]},
             status: {conditions: (if $state == "running" then []
                                   else [{type: $state, status: "True", reason: (if $state == "Failed" then "BackoffLimitExceeded" else null end)}] end)}}]' \
      <<< "${items}")"
  done
  jq -n --argjson items "${items}" '{items: $items}' > "${work}/jobs.json"
}

failures=0
# expect <name> <exit code> <output pattern>
expect() {
  local name="$1" want_code="$2" want_output="$3" output code=0
  output="$(PATH="${work}/bin:${PATH}" STUB_DIR="${work}" BATCH_CHECK_NOW="${NOW}" "${SCRIPT}" "${CRONJOB}" 2>&1)" || code=$?
  if [ "${code}" -eq "${want_code}" ] && grep -qE -- "${want_output}" <<< "${output}"; then
    echo "ok - ${name}"
  else
    echo "not ok - ${name}: exit ${code} (want ${want_code}), output:"
    printf '    %s\n' "${output//$'\n'/$'\n'    }"
    failures=$((failures + 1))
  fi
  rm -f "${work}/cronjob.json" "${work}/jobs.json"
}

OTHER=fom-test-fc-client-data-refresh-batch

cronjob 2025-01-01T00:00:00Z 2026-11-06T08:31:00Z
jobs "${CRONJOB}|2026-11-05T08:30:00Z|Complete" "${CRONJOB}|2026-11-06T08:30:00Z|Complete"
expect "latest Job succeeded today" 0 "last succeeded 2026-11-06T08:31:00Z, 2h59m ago"

cronjob 2025-01-01T00:00:00Z 2026-11-05T08:31:00Z
jobs "${CRONJOB}|2026-11-05T08:30:00Z|Complete"
expect "last success older than 26h (no run today)" 1 "::error::.*26h59m ago \(limit 26h\)"

cronjob 2025-01-01T00:00:00Z 2026-11-05T08:31:00Z
jobs "${CRONJOB}|2026-11-05T08:30:00Z|Complete" "${CRONJOB}|2026-11-06T08:30:00Z|Failed"
expect "latest Job failed within 26h of a success" 1 "::error::Latest .* failed \(BackoffLimitExceeded\)"

cronjob 2025-01-01T00:00:00Z 2026-11-05T12:00:00Z
jobs "${CRONJOB}|2026-11-05T11:59:00Z|Complete" "${CRONJOB}|2026-11-06T08:30:00Z|running"
expect "latest Job still running, last success within 26h" 0 "last succeeded 2026-11-05T12:00:00Z, 23h30m ago"

cronjob 2025-01-01T00:00:00Z 2026-11-06T08:31:00Z
jobs "${OTHER}|2026-11-06T10:30:00Z|Failed" "${CRONJOB}|2026-11-06T08:30:00Z|Complete"
expect "another CronJob's failed Job is ignored" 0 "last succeeded"

cronjob 2026-11-06T09:00:00Z
jobs
expect "new CronJob with no Job yet passes with a notice" 0 "::notice::.*has not succeeded yet"

cronjob 2026-11-01T09:00:00Z
jobs "${CRONJOB}|2026-11-06T08:30:00Z|Failed"
expect "CronJob that never succeeded and whose latest Job failed" 1 "::error::Latest .* failed"

cronjob 2026-11-01T09:00:00Z
jobs
expect "CronJob older than 26h that never succeeded" 1 "::error::.*has no successful run.*122h30m ago"

jobs
expect "CronJob missing" 1 "::error::CronJob ${CRONJOB} not found"

if [ "${failures}" -ne 0 ]; then
  echo "::error::${failures} batch-job-check test(s) failed"
  exit 1
fi
echo "All batch-job-check tests passed"
