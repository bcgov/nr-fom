import { check } from "k6";
import http from "k6/http";
import { Rate } from "k6/metrics";

// One VU, one pull: this is the DataBC/FME pattern, not a stampede.
// 100 VUs would recreate the outage (overlapping extracts) instead of detecting it.
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ["rate==1"],
    http_req_failed: ["rate==0"],
    http_req_duration: ["p(95)<120000"],
  },
};

const errorRate = new Rate("errors");

function isStatus200(res) {
  return res.status === 200;
}

function isJsonArray(res) {
  return typeof res.body === "string" && res.body.startsWith("[");
}

export default function bcgwExtract() {
  const base = __ENV.BACKEND_URL;
  if (!base) {
    throw new Error("BACKEND_URL is required");
  }

  const url = `${base}/spatial-feature/bcgw-extract?version=1.0-final`;
  const res = http.get(url, { timeout: "180s" });
  const ok = check(res, {
    "bcgw-extract status 200": isStatus200,
    "bcgw-extract json array": isJsonArray,
  });
  errorRate.add(!ok, { tag1: "bcgw-extract" });
}
