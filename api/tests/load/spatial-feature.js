import { check } from "k6";
import http from "k6/http";

// Public map path: full geometries for one project, materialized in API heap
// (not the BCGW cursor). Small VUs; not part of the weekly Load Test (that job
// runs public.js). Manual run:
//   BACKEND_URL=<api base> [PROJECT_ID=<id>] k6 run api/tests/load/spatial-feature.js
// Default 100004 is the largest published FOM on TEST: "Open-2021-09-14"
// (AKIECA EXPLORERS LTD., FSP 10, Commenting Closed), 225 features / 1.84 MB,
// measured 2026-09-27 across all 3092 publicSummary projects (median 6 features
// / 3 KB). 100293 is an identical copy. Override PROJECT_ID for PR slots or if
// it is removed from TEST.
export const options = {
  vus: 2,
  iterations: 10,
  thresholds: {
    checks: ["rate==1"],
    http_req_failed: ["rate==0"],
    http_req_duration: ["p(95)<10000"],
  },
};

const projectId = __ENV.PROJECT_ID === undefined ? "100004" : __ENV.PROJECT_ID;
if (!/^\d+$/.test(projectId)) {
  throw new Error("PROJECT_ID must be numeric");
}

function requireBase() {
  const base = __ENV.BACKEND_URL;
  if (!base) {
    throw new Error("BACKEND_URL is required");
  }
  return base;
}

function isStatus200(res) {
  return res.status === 200;
}

function parseBody(res) {
  if (typeof res.body !== "string") {
    return null;
  }
  try {
    return JSON.parse(res.body);
  } catch {
    return null;
  }
}

export default function spatialFeature() {
  const base = requireBase();
  const res = http.get(`${base}/spatial-feature?projectId=${projectId}`, {
    timeout: "60s",
  });
  const body = parseBody(res);
  check(res, {
    "spatial-feature status 200": isStatus200,
    "spatial-feature json array": function isArray() {
      return Array.isArray(body);
    },
    "spatial-feature non-empty": function isNonEmpty() {
      return Array.isArray(body) && body.length > 0;
    },
  });
}
