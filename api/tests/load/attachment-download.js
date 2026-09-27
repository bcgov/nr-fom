import { check } from "k6";
import http from "k6/http";

// Public attachment download: getFileContents buffers the whole object from
// MinIO before sending, so a large file is a heap spike. Small on purpose so it
// never stampedes MinIO. Not part of the weekly Load Test (that runs public.js).
// Manual run: BACKEND_URL=<api base> [ATTACHMENT_ID=<id>] k6 run api/tests/load/attachment-download.js
// Without ATTACHMENT_ID, setup picks the first public attachment found on a
// published project.
export const options = {
  vus: 2,
  iterations: 4,
  thresholds: {
    checks: ["rate==1"],
    http_req_failed: ["rate==0"],
  },
};

// Limit: scans at most this many published projects for an attachment; set
// ATTACHMENT_ID to target a specific (e.g. large) file instead.
const MAX_PROJECTS_SCANNED = 25;

function requireBase() {
  const base = __ENV.BACKEND_URL;
  if (!base) {
    throw new Error("BACKEND_URL is required");
  }
  return base;
}

function getJsonArray(url) {
  const res = http.get(url, { timeout: "60s" });
  if (res.status !== 200 || typeof res.body !== "string") {
    throw new Error(`GET ${url} failed: HTTP ${res.status}`);
  }
  const parsed = JSON.parse(res.body);
  if (!Array.isArray(parsed)) {
    throw new Error(`GET ${url} did not return a JSON array`);
  }
  return parsed;
}

export function setup() {
  const base = requireBase();
  if (__ENV.ATTACHMENT_ID) {
    if (!/^\d+$/.test(__ENV.ATTACHMENT_ID)) {
      throw new Error("ATTACHMENT_ID must be numeric");
    }
    return { attachmentId: Number(__ENV.ATTACHMENT_ID) };
  }

  const projects = getJsonArray(`${base}/project/publicSummary`);
  for (const project of projects.slice(0, MAX_PROJECTS_SCANNED)) {
    const attachments = getJsonArray(`${base}/attachment?projectId=${project.id}`);
    if (attachments.length) {
      return { attachmentId: attachments[0].id };
    }
  }
  throw new Error(
    `No public attachment in the first ${MAX_PROJECTS_SCANNED} published projects; set ATTACHMENT_ID`,
  );
}

export default function attachmentDownload(data) {
  const base = requireBase();
  const res = http.get(`${base}/attachment/file/${data.attachmentId}`, {
    responseType: "binary",
    timeout: "120s",
  });
  check(res, {
    "attachment status 200": (r) => r.status === 200,
    "attachment body non-empty": (r) => r.body !== null && r.body.byteLength > 0,
  });
}
