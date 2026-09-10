import { check, sleep } from "k6";
import http from "k6/http";
import { Rate } from "k6/metrics";

// Same shape as bcgov/quickstart-openshift (100 VUs / 300s), against TEST (or
// a PR slot) public map — not BCGW extract, never PROD.
export const options = {
  vus: 100,
  duration: "300s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<10000"],
  },
};

const errorRate = new Rate("errors");

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

export function setup() {
  const base = requireBase();
  const res = http.get(`${base}/project/publicSummary`, { timeout: "60s" });
  if (!isStatus200(res) || typeof res.body !== "string") {
    throw new Error(`publicSummary setup failed: HTTP ${res.status}`);
  }
  const parsed = JSON.parse(res.body);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("publicSummary returned no projects");
  }
  const projectIds = parsed.map(function projectId(row) {
    return row.id;
  }).filter(function hasId(id) {
    return typeof id === "number";
  });
  if (!projectIds.length) {
    throw new Error("publicSummary rows had no numeric id");
  }
  return { projectIds: projectIds };
}

export default function publicMapLoad(data) {
  const base = requireBase();
  const ids = data.projectIds;
  const projectId = ids[Math.floor(Math.random() * ids.length)];

  const summary = http.get(`${base}/project/publicSummary`, { timeout: "30s" });
  const summaryOk = check(summary, {
    "publicSummary status 200": isStatus200,
  });
  errorRate.add(!summaryOk, { tag1: "publicSummary" });

  const features = http.get(`${base}/spatial-feature?projectId=${projectId}`, {
    timeout: "60s",
  });
  const featuresOk = check(features, {
    "spatial-feature status 200": isStatus200,
  });
  errorRate.add(!featuresOk, { tag1: "spatial-feature" });

  sleep(1);
}
