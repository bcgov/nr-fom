# FOM TEST manual checklist: v1.0.1 to main, plus #1155

Environment (deploys automatically on merge to main):
- Public: https://fom-test.apps.silver.devops.gov.bc.ca/public
- Admin: https://fom-test.apps.silver.devops.gov.bc.ca/admin
- API: https://fom-test.apps.silver.devops.gov.bc.ca/api

Time: about 35-45 minutes. Sections go from highest risk to lowest.
Logins: Anon = no login; IDIR = ministry user; BCeID = forest client user for the FOM's client (needed to create, publish, withdraw, finalize).
Before you start: wait for the merge deploy to go green, tail the API pod logs (`oc logs -f deploy/<fom-test-api>`), and have a small PDF, a JPG and `docs/uat/cutblocks-test.geojson` handy (Ian's two-cut-block test file, in lat/long).

## 0. Deploy and API logs (3 min)
| # | Step | Expected | If it fails |
|---|---|---|---|
| 0.1 | `oc get pods` | API, admin, public pods Ready, no restart loop | NestJS 12 / nestjs-pino 5 (#1162) or env loading without dotenv (#1149) |
| 0.2 | API startup log | "Running DB Main Migrations..." then "Done DB Migrations.", no stack trace | #1149 or #1162 |
| 0.3 | API startup log | `Successful connection to object storage. Buckets accessible = N` (N >= 1) | Object storage env, endpoint, path-style or region (#1155) |
| 0.4 | Watch logs for the rest of the run | No bearer token or Cognito config JSON printed; structured JSON request logs | Token logged: #1150 regressed. Log format changed or went silent: nestjs-pino 5 (#1162) |

## 1. API quick checks (3 min, Anon)
| # | Step | Expected | If it fails |
|---|---|---|---|
| 1.1 | Open `/api` | Swagger "FOM API" loads with every controller listed | ESM swagger under Nest 12 (#1162) |
| 1.2 | `curl -s .../api/project/publicSummary \| jq length` | About 3092 | #1162 |
| 1.3 | `curl -s .../api/awsCognitoConfig` | 200 JSON | #1150 or #1162 |
| 1.4 | `curl -sI .../api/public-notice` and `.../api/district` | 200 | #1162 |
| 1.5 | `curl -s -o /tmp/f.jpg -w '%{http_code} %{content_type}\n' .../api/attachment/file/1004` | `200 image/jpeg`, about 220 KB, file opens (first real S3 read on TEST) | S3 GetObject / streaming (#1155). Don't use seed attachments 40-42; their files are missing and they always 500 |

## 2. Admin login and auth (4 min)
| # | Step | Expected | If it fails |
|---|---|---|---|
| 2.1 | `/admin`, log in with IDIR | Back on Search with your name in the header, no Amplify console errors | aws-amplify split (#1141) |
| 2.2 | Search a district, open a FOM | Detail page with map, attachments, metrics; API calls 200 | 401s: API token guard (#1150 or #1162) |
| 2.3 | Analytics dashboard (ministry only) | Renders with data | #1162 |
| 2.4 | Optional: reload after a few minutes | Session still valid | Token refresh (#1141) |
| 2.5 | Logout, log in with BCeID | Logout page, then Search shows only that client's FOMs | #1141 |

## 3. Create and edit a FOM (5 min, BCeID)
| # | Step | Expected | If it fails |
|---|---|---|---|
| 3.1 | `/admin/a/create`: name, district, FSP, description, datepickers for Commenting Open (at least 2 days out) and Closed, Save | Green toast, new FOM in Initial state; note the ID | Nest 12 DTO/validation (#1162) or remeda to lodash (#1136) |
| 3.2 | Edit FOM, change description and a date, Save | Change shows on detail page | Same |

## 4. Attachments on real S3 (8 min, BCeID) - highest risk
Use the Initial FOM from 3.1, so deletes are allowed.
| # | Step | Expected | If it fails |
|---|---|---|---|
| 4.1 | Edit FOM, upload a PDF as Supporting Document, Save | Listed under Attachments; no attachment.service error in the log | PutObject (#1155) |
| 4.2 | Click the attachment | Downloads and opens intact | GetObject (#1155) |
| 4.3 | Upload and download a JPG | Works, correct content type | #1155 |
| 4.4 | Anonymous `curl .../api/attachment/file/<attId>` | Downloads | #1155 or auth (#1162) |
| 4.5 | Delete the PDF, confirm, reload | Gone from list; no "Unable to remove object" in log; the old file URL no longer returns the file | DeleteObject (#1155) |
| 4.6 | Add Online Public Notice with a file, then upload a second public notice file | Only one public notice listed (the second replaces the first) | Replace deletes old object first (#1155) |
| 4.7 | Spatial upload `/a/<id>/upload`, choose Cut block, upload `cutblocks-test.geojson` | Two cut blocks appear: a small one near Kelowna and a larger one west of Williams Lake (near Anahim Lake). Shape info table lists both with their dev dates (2022-03-30 and 2022-03-31) | Whole upload fails: spatial/submission API (#1162, no S3). Only block #1 rejected or missing its date: it uses `DEVELOPMENT_DATE` while block #2 uses `DEV_DATE`, so the file may be deliberately testing the alternate name; compare with what FOM accepts before calling it a regression |
| 4.8 | Optional: throwaway Initial FOM with one attachment, delete it | Deleted, no S3 errors in log | Project delete removes attachments (#1155) |

## 5. Interactions and comments (5 min, IDIR or BCeID)
| # | Step | Expected | If it fails |
|---|---|---|---|
| 5.1 | Public: open a Commenting Open FOM (e.g. `/public/a/1072/details`), Submit a Comment | Success message | #1162 |
| 5.2 | Admin: Review Comments `/comments/:id`, set a response, Save | Persists after reload | #1162 |
| 5.3 | `/interactions/:id`, Add New with a file, Save; download it; delete it | Listed, downloads, deletes | S3 for interactions (#1155) |
| 5.4 | Summary Report `/a/:id/summary` | Renders | #1162 |

## 6. Public site (6 min, Anon)
| # | Step | Expected | If it fails |
|---|---|---|---|
| 6.1 | `/public` splash/training modal and About page | External links show the inline SVG icon, no missing glyphs | Fontawesome removal (#1138) |
| 6.2 | Map: pan, zoom, clusters, click a pin, open the FOM | Clusters split, popup works, details load | #1138 |
| 6.3 | Find panel: filter by District and Commenting Open/Closed; reload; change a filter back | Results, pins and URL params update; filters restored on reload; list refreshes | object-hash replacement (#1138) |
| 6.4 | FOM details: external links and attachments | Icons render, attachment downloads | #1138, #1155 |
| 6.5 | Layers: turn on Forest Development Units, zoom to 8+ | Olive 3px outline, approved units only, only at zoom 8+; no CSP errors for openmaps.gov.bc.ca | FDU layer / CSP (#1115, #1137) |
| 6.6 | Details mini-map (public and admin) | FDU outline with white halo, if the layer is present there | #1137 |
| 6.7 | Public Notices tab | List loads; a notice opens | #1162 |

## 7. Finalize email (3-5 min, conditional, BCeID)
Needs an existing Commenting Closed FOM for your BCeID client with final spatial, a public notice, and every comment classified. If you don't have one, skip to 7.3.
| # | Step | Expected | If it fails |
|---|---|---|---|
| 7.1 | Finalize | State Finalized; log shows the "Sending FOM <id> finalized notification email to Heartwood@gov.bc.ca" line | "Problem sending notification email": nodemailer transport (#1136) or version (#1157). Note the FOM is already Finalized even if mail fails |
| 7.2 | Check the Heartwood@gov.bc.ca inbox | HTML email from FOMDoNotReply with a working `/admin/a/<id>` link | Mail relay or #1136 |
| 7.3 | Can't test end to end | API started cleanly (0.2) and SMTP env is present | - |
TEST sends real mail through the gov relay to Heartwood@gov.bc.ca only, not to districts. If mail fails with a TLS error, suspect the `secure` option order in `createMailTransporter` (#1136).

## Not testable on TEST
- Email to districts (TEST sends to Heartwood only).
- Seed attachments 40-42 (always 500; old problem).
- The Jest flag from #1162 (tests only).
- k6 scripts #1152, #1153, #1154, #1158 (optional: run attachment-download.js with ATTACHMENT_ID=1004).
- CI/deploy changes (#1161, #1147, #1145, #1144, #1143, #1140, #1139, #1132) show up only as the deploy succeeding.

## Covered PRs
#1155 S3 client, #1162 NestJS 12, #1149 dotenv removal, #1150 token logging, #1141 Amplify split, #1138 public Fontawesome and object-hash, #1136 Epic #1130 batch 1 (mailer, lodash, libs util), #1157 nodemailer override, #1115 and #1137 FDU overlay. No manual test: #1152, #1153, #1154, #1158, #1159 and the CI changes above.
