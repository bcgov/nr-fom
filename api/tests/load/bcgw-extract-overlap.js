import bcgwExtract, { options as single } from "./bcgw-extract.js";

// Two overlapping pulls (2 VUs x 1 iteration): the original outage shape.
// Same checks and thresholds as bcgw-extract.js; fails if either in-flight
// extract 502s, times out, or returns a truncated JSON array.
// Manual run: BACKEND_URL=<api base> k6 run api/tests/load/bcgw-extract-overlap.js
export const options = {
  scenarios: {
    overlap: {
      executor: "per-vu-iterations",
      vus: 2,
      iterations: 1,
    },
  },
  thresholds: single.thresholds,
};

export default bcgwExtract;
