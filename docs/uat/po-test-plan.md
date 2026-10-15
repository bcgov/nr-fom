# FOM product owner test plan (TEST)

A plain-language plan for the product owner and forest client users to check FOM on TEST before a release. It is a shorter version of the full [checklist](checklist.md). Issue: #1135.

**Where to test**
- Public site: https://fom-test.apps.silver.devops.gov.bc.ca/public
- Admin site (sign in): https://fom-test.apps.silver.devops.gov.bc.ca/admin

**What you need**
- A BCeID account set up as a forest client user (to create and finalize FOMs).
- Optional: an IDIR account (for the ministry reviewer section).
- A small PDF file, and the test map file [`cutblocks-test.json`](cutblocks-test.json) from this folder.
- About 45 minutes.

**Only use TEST.** Never create, edit, comment on or upload anything on the live (PROD) site.

For each step, do what it says and compare with **Expected**. If it doesn't match, write down the step number and see [Reporting problems](#8-reporting-problems).

## 1. Sign in and sign out (BCeID)
| # | Step | Expected |
|---|---|---|
| 1.1 | Open the admin site and sign in with your BCeID. | You land on the Search page with your name at the top. |
| 1.2 | Search for FOMs. | You see only FOMs for your own company, never another company's. |
| 1.3 | Sign out. | You see a signed-out page. Going back to the admin site asks you to sign in again. |
| 1.4 | Sign in again. | You're back on Search with your name at the top. |

## 2. Create, edit and publish a FOM (BCeID)
| # | Step | Expected |
|---|---|---|
| 2.1 | Choose **Add New FOM**. Fill in name, district, FSP ID and description. Set Commenting Open at least 2 days from today and Commenting Closed at least 30 days after that. Save. | A green "saved" message. The new FOM shows as **Initial**. Write down its FOM ID. |
| 2.2 | Edit the FOM, change the description, save. | The new description shows on the FOM page. |
| 2.3 | Edit the FOM and upload a PDF as a supporting document. Save, then click it. | The file is listed and opens correctly. |
| 2.4 | Before adding the map, look at **Publish**. | Publish is not available yet. |

## 3. Upload the map (BCeID)
| # | Step | Expected |
|---|---|---|
| 3.1 | Open `cutblocks-test.json` in a text editor. Change both dates (`DEVELOPMENT_DATE` and `DEV_DATE`) to a date in the future and save. | The file ships with 2022 dates, which FOM rejects as being in the past. |
| 3.2 | On your FOM, choose the spatial upload, pick **Cut block**, and upload the file. | Two cut blocks appear on the map: a small one near Kelowna and a larger one near Anahim Lake. Both are listed with your new dates. |
| 3.3 | Try uploading a file that isn't `.json` or `.txt`. | A clear error. Nothing is saved. |
| 3.4 | Choose **Publish** and confirm. | The FOM shows as **Published**. On its Commenting Open date it opens for comments. |

## 4. Public commenting (no sign in)
Use any FOM that is **Commenting Open** (for example your own once it opens, or `/public/a/1072/details`).
| # | Step | Expected |
|---|---|---|
| 4.1 | On the public site, find the FOM on the map or in the list and open it. | The FOM details and map load. |
| 4.2 | Choose **Submit a Comment**, tick "I agree", enter a comment and choose what it's about. Submit. | "Thank you for your comment!" |
| 4.3 | Enter a bad phone number before submitting. | "Enter a valid phone number, e.g. 123-456-7890". |
| 4.4 | In admin (BCeID), open that FOM's comments. | Your comment is listed and not yet classified. |
| 4.5 | Try to respond to the comment while commenting is still open. | Responses are not available until commenting closes. |

## 5. Respond to comments (BCeID)
Use a FOM for your company that is **Commenting Closed**.
| # | Step | Expected |
|---|---|---|
| 5.1 | Open its comments. Pick a response (for example "Considered"), add a note, and save. | Saved. |
| 5.2 | Reload the page. | Your response and note are still there. *(Checklist 5.2)* |
| 5.3 | Leave at least one comment without a response. If the FOM says comment classification is **Mandatory**, try **Finalize**. | Finalize is blocked with a message that all comments must be classified. *(Checklist 5.7)* |
| 5.4 | Classify the remaining comments. | All comments now have a response. |

## 6. Finalize and the notification email (BCeID)
The FOM needs to be Commenting Closed, with the final map uploaded, a public notice, and (if Mandatory) every comment classified.
| # | Step | Expected |
|---|---|---|
| 6.1 | Choose **Finalize** and confirm. | The FOM shows as **Finalized**. *(Checklist 7.1)* |
| 6.2 | Ask the Heartwood team to check the Heartwood@gov.bc.ca inbox. | An email from "FOMDoNotReply" says the FOM was finalized. Its link opens that FOM in admin (`/admin/a/<FOM ID>`). *(Checklist 7.2)* |
| 6.3 | Try to edit the finalized FOM. | Editing is no longer available. |

TEST only emails Heartwood@gov.bc.ca, not the districts.

## 7. Ministry reviewer (IDIR, optional)
**Use a reviewer-only IDIR** (FOM reviewer role only, not an admin). A full admin IDIR, which may also hold forest client roles, *can* create, edit, publish, finalize and respond, so it will not show the read-only behaviour below. These steps match checklist 2.7, 2.8, 5.6 and 5.8.
| # | Step | Expected |
|---|---|---|
| 7.1 | Sign in to admin with IDIR and search by district. | FOMs from every company are listed. |
| 7.2 | Open a FOM. | You can view the map, public notice, comments and summary report. |
| 7.3 | Look for edit, upload, publish, finalize and comment responses. | None are available. Ministry reviewers can only change the Commenting Closed date and the Mandatory classification setting. |
| 7.4 | Go directly to `/admin/a/create`. | You can't create a FOM. |
| 7.5 | Open a **Commenting Closed** FOM (for example 100452). Under Comment Period Details, note the Comment Classification value (Mandatory or not), choose **Change to...**, then reload. | The new value is kept after reload. *(Checklist 5.6)* |
| 7.6 | Change it back to the value you noted in 7.5 and reload. | The original value is restored. Don't skip this step. |

## 8. Reporting problems
For each problem, send the Heartwood team (Heartwood@gov.bc.ca) or add a comment on issue #1135 with:
1. The step number (for example "5.2").
2. What you expected and what happened instead.
3. The FOM ID, the date and time, and whether you were signed in with BCeID or IDIR.
4. A screenshot if you can. Don't include anyone's personal details from comments.

## Behind the scenes
Some of these checks are also covered by automated API tests in `api/src/app/modules/uat/po-test-plan.approximation.spec.ts`. They don't replace this manual run.
